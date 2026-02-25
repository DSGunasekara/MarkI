import {
  aiReportMessages,
  aiReports,
  assignments,
  db,
  submissions
} from '@hiring-engine/db'
import { and, desc, eq } from 'drizzle-orm'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

type GenerateReportInput = {
  submissionId: string
  buildRunId: string
  repositoryDirectory: string
}

type AiPerformanceReport = {
  projectOverview: string
  notableStructure: string
  engineeringStrengths: string[]
  risksOrConcerns: string[]
  suggestedInterviewQuestions: string[]
}

type RepositoryContext = {
  submission: {
    assignmentTitle: string
    repositoryUrl: string
    repositoryFullName: string | null
  }
  packageJson: {
    name: string | null
    scripts: Record<string, string>
    dependencies: string[]
    devDependencies: string[]
  } | null
  topLevelEntries: string[]
  sourceFiles: Array<{
    path: string
    excerpt: string
  }>
}

type AiMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type GenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

const MAX_SOURCE_FILES = 24
const MAX_FILE_CHARS = 1800
const MAX_CONTEXT_CHARS = 48_000

const INCLUDE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.css',
  '.scss'
])

const SKIP_DIRECTORIES = new Set([
  '.git',
  '.next',
  'node_modules',
  'dist',
  'build',
  'coverage'
])

const normalizeText = (value: string): string => {
  return value.replace(/\u0000/g, '').trim()
}

const truncateText = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}\n...[truncated]`
}

const parseJsonSafe = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

const getGeminiModel = (): string => {
  return process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash'
}

const serializeContext = (context: RepositoryContext): string => {
  return JSON.stringify(context)
}

const toPerformanceReport = (value: unknown): AiPerformanceReport | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>

  const projectOverview = typeof record.projectOverview === 'string' ? record.projectOverview.trim() : ''
  const notableStructure =
    typeof record.notableStructure === 'string' ? record.notableStructure.trim() : ''
  const engineeringStrengths = Array.isArray(record.engineeringStrengths)
    ? record.engineeringStrengths.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter((item) => item.length > 0)
    : []
  const risksOrConcerns = Array.isArray(record.risksOrConcerns)
    ? record.risksOrConcerns.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter((item) => item.length > 0)
    : []
  const suggestedInterviewQuestions = Array.isArray(record.suggestedInterviewQuestions)
    ? record.suggestedInterviewQuestions
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : []

  if (
    projectOverview.length === 0 ||
    notableStructure.length === 0 ||
    engineeringStrengths.length === 0 ||
    risksOrConcerns.length === 0 ||
    suggestedInterviewQuestions.length === 0
  ) {
    return null
  }

  return {
    projectOverview,
    notableStructure,
    engineeringStrengths,
    risksOrConcerns,
    suggestedInterviewQuestions
  }
}

const callGemini = async (input: {
  messages: AiMessage[]
  expectJsonSchema: boolean
}): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    console.error('[callGemini] GEMINI_API_KEY is not configured.')
    throw new Error('GEMINI_API_KEY is not configured.')
  }

  const model = getGeminiModel()
  console.log(`[callGemini] Making request to Gemini using model: ${model}`);

  const systemMessage = input.messages.find(m => m.role === 'system')?.content
  const systemInstruction = systemMessage ? { parts: [{ text: systemMessage }] } : undefined

  const contents = input.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))

  const requestBody: any = {
    systemInstruction,
    contents,
    generationConfig: {
      temperature: 0.1,
    }
  }

  if (input.expectJsonSchema) {
    requestBody.generationConfig.responseMimeType = 'application/json'
    requestBody.generationConfig.responseSchema = {
      type: 'OBJECT',
      properties: {
        projectOverview: { type: 'STRING' },
        notableStructure: { type: 'STRING' },
        engineeringStrengths: { type: 'ARRAY', items: { type: 'STRING' } },
        risksOrConcerns: { type: 'ARRAY', items: { type: 'STRING' } },
        suggestedInterviewQuestions: { type: 'ARRAY', items: { type: 'STRING' } }
      },
      required: [
        'projectOverview',
        'notableStructure',
        'engineeringStrengths',
        'risksOrConcerns',
        'suggestedInterviewQuestions'
      ]
    }
  }

  console.log(`[callGemini] Request body:`, JSON.stringify(requestBody, null, 2));

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  const payloadText = await response.text()
  console.log(`[callGemini] Response status: ${response.status}`);
  console.log(`[callGemini] Response payload: ${payloadText}`);

  if (!response.ok) {
    console.error(`[callGemini] Request failed: ${response.status} ${payloadText}`);
    throw new Error(`Gemini API request failed: ${response.status} ${payloadText}`)
  }

  const payload = parseJsonSafe(payloadText) as GenerateContentResponse | null
  const content = payload?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!content || content.trim().length === 0) {
    throw new Error('Gemini API returned an empty response.')
  }

  return content
}

const buildFallbackReport = (context: RepositoryContext): AiPerformanceReport => {
  const packageName = context.packageJson?.name ?? 'Unnamed project'
  const scriptNames = Object.keys(context.packageJson?.scripts ?? {})
  const dependencyCount = context.packageJson?.dependencies.length ?? 0
  const fileCount = context.sourceFiles.length

  return {
    projectOverview: `${packageName} appears to be a Next.js project with ${fileCount} key files sampled for review.`,
    notableStructure: `Top-level layout includes ${context.topLevelEntries.slice(0, 8).join(', ') || 'standard project files'}. Build scripts: ${scriptNames.join(', ') || 'not declared'}.`,
    engineeringStrengths: [
      'Project compiles and builds successfully in pipeline.',
      `Dependency declaration is explicit (${dependencyCount} production dependencies listed).`,
      'Repository uses a predictable framework structure, making code navigation straightforward.'
    ],
    risksOrConcerns: [
      'Automated fallback analysis was used because LLM configuration failed; deeper semantic review may be incomplete.',
      'Potential runtime and security concerns still require manual verification of critical paths.',
      'No automated confidence scoring is emitted; employer should validate findings with targeted interview questions.'
    ],
    suggestedInterviewQuestions: [
      'Walk through how data flows from the main page entry point to the core business logic.',
      'Which tradeoffs did you make around performance, and what metrics would you monitor in production?',
      'If you had another day, what refactor would you prioritize and why?'
    ]
  }
}

const listSourceFiles = async (
  repositoryDirectory: string
): Promise<Array<{ path: string; excerpt: string }>> => {
  const discoveredPaths: string[] = []
  const MAX_DISCOVERY = 1000

  const walk = async (directoryPath: string) => {
    if (discoveredPaths.length >= MAX_DISCOVERY) return

    const entries = await readdir(directoryPath, { withFileTypes: true })

    for (const entry of entries) {
      if (discoveredPaths.length >= MAX_DISCOVERY) return

      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue
        await walk(path.join(directoryPath, entry.name))
        continue
      }

      const extension = path.extname(entry.name).toLowerCase()
      if (!INCLUDE_EXTENSIONS.has(extension)) continue

      const absoluteFilePath = path.join(directoryPath, entry.name)
      const relativeFilePath = path.relative(repositoryDirectory, absoluteFilePath)
      discoveredPaths.push(relativeFilePath)
    }
  }

  await walk(repositoryDirectory)

  const groups: Record<string, string[]> = {}
  for (const filePath of discoveredPaths) {
    const parts = filePath.split(path.sep)
    const topLevelDir = parts.length > 1 ? parts[0] : '[root]'
    
    if (!groups[topLevelDir]) {
      groups[topLevelDir] = []
    }
    groups[topLevelDir].push(filePath)
  }

  const selectedPaths = new Set<string>()
  const groupKeys = Object.keys(groups)
  let changed = true

  while (selectedPaths.size < MAX_SOURCE_FILES && changed) {
    changed = false
    for (const key of groupKeys) {
      if (selectedPaths.size >= MAX_SOURCE_FILES) break
      
      const groupFiles = groups[key]
      if (groupFiles.length > 0) {
        const fileToSelect = groupFiles.shift()
        if (fileToSelect) {
          selectedPaths.add(fileToSelect)
          changed = true
        }
      }
    }
  }

  const files: Array<{ path: string; excerpt: string }> = []
  for (const relativeFilePath of selectedPaths) {
    try {
      const absoluteFilePath = path.join(repositoryDirectory, relativeFilePath)
      const rawFileContent = await readFile(absoluteFilePath, 'utf8')
      files.push({
        path: relativeFilePath,
        excerpt: truncateText(normalizeText(rawFileContent), MAX_FILE_CHARS)
      })
    } catch {
      // Ignore read errors
    }
  }

  return files
}

const buildRepositoryContext = async (
  repositoryDirectory: string,
  submissionId: string
): Promise<RepositoryContext> => {
  const [submissionRecord] = await db
    .select({
      repositoryUrl: submissions.repositoryUrl,
      repositoryFullName: submissions.repositoryFullName,
      assignmentTitle: assignments.title
    })
    .from(submissions)
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(eq(submissions.id, submissionId))
    .limit(1)

  if (!submissionRecord) {
    throw new Error('Submission not found while building AI analysis context.')
  }

  const topLevelEntries = await readdir(repositoryDirectory)
  const sourceFiles = await listSourceFiles(repositoryDirectory)

  let packageJsonContext: RepositoryContext['packageJson'] = null
  const packageJsonPath = path.join(repositoryDirectory, 'package.json')
  try {
    const packageJsonRaw = await readFile(packageJsonPath, 'utf8')
    const parsedPackageJson = parseJsonSafe(packageJsonRaw) as Record<string, unknown> | null

    if (parsedPackageJson && typeof parsedPackageJson === 'object') {
      const scriptsRecord =
        parsedPackageJson.scripts && typeof parsedPackageJson.scripts === 'object'
          ? Object.fromEntries(
              Object.entries(parsedPackageJson.scripts as Record<string, unknown>)
                .filter(([, value]) => typeof value === 'string')
                .map(([key, value]) => [key, String(value)])
            )
          : {}

      const dependencies = parsedPackageJson.dependencies && typeof parsedPackageJson.dependencies === 'object'
        ? Object.keys(parsedPackageJson.dependencies as Record<string, unknown>).slice(0, 60)
        : []
      const devDependencies =
        parsedPackageJson.devDependencies && typeof parsedPackageJson.devDependencies === 'object'
          ? Object.keys(parsedPackageJson.devDependencies as Record<string, unknown>).slice(0, 60)
          : []

      packageJsonContext = {
        name: typeof parsedPackageJson.name === 'string' ? parsedPackageJson.name : null,
        scripts: scriptsRecord,
        dependencies,
        devDependencies
      }
    }
  } catch {
    packageJsonContext = null
  }

  return {
    submission: {
      assignmentTitle: submissionRecord.assignmentTitle,
      repositoryUrl: submissionRecord.repositoryUrl,
      repositoryFullName: submissionRecord.repositoryFullName
    },
    packageJson: packageJsonContext,
    topLevelEntries: topLevelEntries.slice(0, 40),
    sourceFiles
  }
}

const formatContextForPrompt = (context: RepositoryContext): string => {
  let md = `# Repository Context\n\n`
  
  md += `## Submission Info\n`
  md += `- Assignment: ${context.submission.assignmentTitle}\n`
  md += `- URL: ${context.submission.repositoryUrl}\n`
  if (context.submission.repositoryFullName) {
    md += `- Full Name: ${context.submission.repositoryFullName}\n`
  }
  md += `\n`

  if (context.packageJson) {
    md += `## Package Information\n`
    if (context.packageJson.name) {
      md += `- Name: ${context.packageJson.name}\n`
    }
    
    const scripts = Object.entries(context.packageJson.scripts)
    if (scripts.length > 0) {
      md += `- Scripts:\n`
      for (const [key, value] of scripts) {
        md += `  - ${key}: \`${value}\`\n`
      }
    }

    if (context.packageJson.dependencies.length > 0) {
      md += `- Dependencies: ${context.packageJson.dependencies.join(', ')}\n`
    }
    
    if (context.packageJson.devDependencies.length > 0) {
      md += `- Dev Dependencies: ${context.packageJson.devDependencies.join(', ')}\n`
    }
    md += `\n`
  }

  if (context.topLevelEntries.length > 0) {
    md += `## Top Level Entries\n`
    md += `${context.topLevelEntries.join(', ')}\n\n`
  }

  if (context.sourceFiles.length > 0) {
    md += `## Source Files\n\n`
    for (const file of context.sourceFiles) {
      md += `### File: ${file.path}\n`
      
      let lang = ''
      if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) lang = 'typescript'
      else if (file.path.endsWith('.js') || file.path.endsWith('.jsx')) lang = 'javascript'
      else if (file.path.endsWith('.json')) lang = 'json'
      else if (file.path.endsWith('.css') || file.path.endsWith('.scss')) lang = 'css'
      
      md += `\`\`\`${lang}\n`
      md += file.excerpt
      md += `\n\`\`\`\n\n`
    }
  }

  return truncateText(md.trim(), MAX_CONTEXT_CHARS)
}

const generateReportWithLlm = async (context: RepositoryContext): Promise<AiPerformanceReport> => {
  const promptContext = formatContextForPrompt(context)

  const content = await callGemini({
    expectJsonSchema: true,
    messages: [
      {
        role: 'system',
        content:
          'You are a senior engineering reviewer. Analyze the repository context and produce a clear, explainable hiring performance report. No numeric scoring. Ground all claims in the provided context.'
      },
      {
        role: 'user',
        content: `Generate a human-readable report with these sections:
1) projectOverview
2) notableStructure
3) engineeringStrengths (array of bullet points)
4) risksOrConcerns (array of bullet points)
5) suggestedInterviewQuestions (array of bullet points)

Repository context:
${promptContext}`
      }
    ]
  })

  const parsedReport = toPerformanceReport(parseJsonSafe(content))
  if (!parsedReport) {
    throw new Error('Model response did not match report schema.')
  }

  return parsedReport
}

const answerQuestionWithLlm = async (input: {
  question: string
  context: RepositoryContext
  report: AiPerformanceReport
  priorMessages: Array<{ role: 'employer' | 'assistant'; message: string }>
}): Promise<string> => {
  const promptContext = formatContextForPrompt(input.context)
  const priorMessagesText = input.priorMessages
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${message.message}`)
    .join('\n')

  const reportText = JSON.stringify(input.report, null, 2)
  const content = await callGemini({
    expectJsonSchema: false,
    messages: [
      {
        role: 'system',
        content:
          'You assist employers evaluating candidate submissions. Answer only using provided repository context and report content. If uncertain, say what is missing.'
      },
      {
        role: 'user',
        content: `Repository context:
${promptContext}

Generated report:
${reportText}

Prior Q&A:
${priorMessagesText || 'None'}

Employer question:
${input.question}

Provide a concise, reasoned answer grounded in the code and report.`
      }
    ]
  })

  return normalizeText(content)
}

const getLatestReportForSubmission = async (submissionId: string) => {
  const [reportRecord] = await db
    .select()
    .from(aiReports)
    .where(eq(aiReports.submissionId, submissionId))
    .orderBy(desc(aiReports.createdAt))
    .limit(1)

  return reportRecord ?? null
}

export const aiReportService = {
  generateReportForSubmission: async (input: GenerateReportInput) => {
    const context = await buildRepositoryContext(input.repositoryDirectory, input.submissionId)
    const model = getGeminiModel()

    const [reportRecord] = await db
      .insert(aiReports)
      .values({
        submissionId: input.submissionId,
        buildRunId: input.buildRunId,
        status: 'pending',
        model,
        analysisContext: serializeContext(context)
      })
      .returning({
        id: aiReports.id
      })

    if (!reportRecord) {
      throw new Error('Unable to create AI report record.')
    }

    try {
      let report: AiPerformanceReport

      try {
        console.log(`[aiReportService] Generating report with LLM for submission: ${input.submissionId}`);
        report = await generateReportWithLlm(context)
        console.log(`[aiReportService] Successfully generated report with LLM!`);
      } catch (error) {
        console.error(`[aiReportService] LLM report generation failed, falling back to basic report. Error:`, error);
        report = buildFallbackReport(context)
      }

      await db
        .update(aiReports)
        .set({
          status: 'completed',
          projectOverview: report.projectOverview,
          notableStructure: report.notableStructure,
          engineeringStrengths: report.engineeringStrengths,
          risksOrConcerns: report.risksOrConcerns,
          suggestedQuestions: report.suggestedInterviewQuestions,
          rawResponse: JSON.stringify(report),
          failureReason: null,
          updatedAt: new Date()
        })
        .where(eq(aiReports.id, reportRecord.id))

      return reportRecord.id
    } catch (error: unknown) {
      const failureReason =
        error instanceof Error ? error.message : 'Unable to generate AI report.'

      await db
        .update(aiReports)
        .set({
          status: 'failed',
          failureReason,
          updatedAt: new Date()
        })
        .where(eq(aiReports.id, reportRecord.id))

      throw error
    }
  },

  getEmployerSubmissionReport: async (employerId: string, submissionId: string) => {
    const [submissionRecord] = await db
      .select({
        submissionId: submissions.id,
        assignmentTitle: assignments.title,
        repositoryUrl: submissions.repositoryUrl
      })
      .from(submissions)
      .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
      .where(and(eq(submissions.id, submissionId), eq(assignments.employerId, employerId)))
      .limit(1)

    if (!submissionRecord) {
      return null
    }

    const reportRecord = await getLatestReportForSubmission(submissionId)
    if (!reportRecord) {
      return {
        submission: submissionRecord,
        report: null,
        messages: []
      }
    }

    const messages = await db
      .select({
        id: aiReportMessages.id,
        role: aiReportMessages.role,
        message: aiReportMessages.message,
        createdAt: aiReportMessages.createdAt
      })
      .from(aiReportMessages)
      .where(eq(aiReportMessages.aiReportId, reportRecord.id))
      .orderBy(aiReportMessages.createdAt)

    return {
      submission: submissionRecord,
      report: reportRecord,
      messages
    }
  },

  answerEmployerQuestion: async (input: {
    employerId: string
    submissionId: string
    question: string
  }) => {
    const reportView = await aiReportService.getEmployerSubmissionReport(
      input.employerId,
      input.submissionId
    )

    if (!reportView) {
      return null
    }

    if (!reportView.report || reportView.report.status !== 'completed') {
      throw new Error('AI report is not ready yet for this submission.')
    }

    const contextValue = reportView.report.analysisContext
    const parsedContext = contextValue
      ? (parseJsonSafe(contextValue) as RepositoryContext | null)
      : null

    if (!parsedContext) {
      throw new Error('AI report context is unavailable.')
    }

    const report: AiPerformanceReport = {
      projectOverview: reportView.report.projectOverview ?? '',
      notableStructure: reportView.report.notableStructure ?? '',
      engineeringStrengths: reportView.report.engineeringStrengths,
      risksOrConcerns: reportView.report.risksOrConcerns,
      suggestedInterviewQuestions: reportView.report.suggestedQuestions
    }

    await db.insert(aiReportMessages).values({
      aiReportId: reportView.report.id,
      role: 'employer',
      message: input.question
    })

    let answer = ''
    try {
      console.log(`[aiReportService] Answering employer question with LLM for submission: ${input.submissionId}`);
      answer = await answerQuestionWithLlm({
        question: input.question,
        context: parsedContext,
        report,
        priorMessages: reportView.messages.map((message) => ({
          role: message.role,
          message: message.message
        }))
      })
      console.log(`[aiReportService] Successfully answered question with LLM`);
    } catch (error) {
      console.error(`[aiReportService] Answering employer question failed. Error:`, error);
      answer =
        'Unable to run LLM reasoning at this moment. Review the report sections and repository evidence directly for this question.'
    }

    const [assistantMessage] = await db
      .insert(aiReportMessages)
      .values({
        aiReportId: reportView.report.id,
        role: 'assistant',
        message: answer
      })
      .returning({
        id: aiReportMessages.id,
        role: aiReportMessages.role,
        message: aiReportMessages.message,
        createdAt: aiReportMessages.createdAt
      })

    return {
      answer: assistantMessage?.message ?? answer
    }
  }
}
