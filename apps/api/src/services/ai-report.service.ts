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

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
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

const getOpenAiModel = (): string => {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini'
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

const callOpenAi = async (input: {
  messages: AiMessage[]
  expectJsonSchema: boolean
}): Promise<string> => {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    console.error('[callOpenAi] OPENAI_API_KEY is not configured.')
    throw new Error('OPENAI_API_KEY is not configured.')
  }

  console.log(`[callOpenAi] Making request to OpenAI using model: ${getOpenAiModel()}`);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      temperature: 0.1,
      messages: input.messages,
      response_format: input.expectJsonSchema
        ? {
            type: 'json_schema',
            json_schema: {
              name: 'candidate_performance_report',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  projectOverview: { type: 'string' },
                  notableStructure: { type: 'string' },
                  engineeringStrengths: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  risksOrConcerns: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  suggestedInterviewQuestions: {
                    type: 'array',
                    items: { type: 'string' }
                  }
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
          }
        : undefined
    })
  })

  const payloadText = await response.text()
  console.log(`[callOpenAi] Response status: ${response.status}`);
  console.log(`[callOpenAi] Response payload: ${payloadText}`);

  if (!response.ok) {
    console.error(`[callOpenAi] Request failed: ${response.status} ${payloadText}`);
    throw new Error(`OpenAI API request failed: ${response.status} ${payloadText}`)
  }

  const payload = parseJsonSafe(payloadText) as ChatCompletionsResponse | null
  const content = payload?.choices?.[0]?.message?.content

  if (!content || content.trim().length === 0) {
    throw new Error('OpenAI API returned an empty response.')
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
  const files: Array<{ path: string; excerpt: string }> = []

  const walk = async (directoryPath: string) => {
    if (files.length >= MAX_SOURCE_FILES) {
      return
    }

    const entries = await readdir(directoryPath, { withFileTypes: true })

    for (const entry of entries) {
      if (files.length >= MAX_SOURCE_FILES) {
        return
      }

      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) {
          continue
        }

        await walk(path.join(directoryPath, entry.name))
        continue
      }

      const extension = path.extname(entry.name).toLowerCase()
      if (!INCLUDE_EXTENSIONS.has(extension)) {
        continue
      }

      const absoluteFilePath = path.join(directoryPath, entry.name)
      const relativeFilePath = path.relative(repositoryDirectory, absoluteFilePath)
      const rawFileContent = await readFile(absoluteFilePath, 'utf8')

      files.push({
        path: relativeFilePath,
        excerpt: truncateText(normalizeText(rawFileContent), MAX_FILE_CHARS)
      })
    }
  }

  await walk(repositoryDirectory)
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
  const rawContext = JSON.stringify(context, null, 2)
  return truncateText(rawContext, MAX_CONTEXT_CHARS)
}

const generateReportWithLlm = async (context: RepositoryContext): Promise<AiPerformanceReport> => {
  const promptContext = formatContextForPrompt(context)

  const content = await callOpenAi({
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
  const content = await callOpenAi({
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
    const model = getOpenAiModel()

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
