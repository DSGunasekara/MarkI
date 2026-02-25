import {
  assignments,
  buildLogs,
  buildRuns,
  db,
  submissions
} from '@hiring-engine/db'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { randomInt } from 'node:crypto'
import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { aiReportService } from './ai-report.service.js'
import { githubAppService } from './github-app.service.js'
import { pipelineEvents } from './pipeline-events.js'

type PipelineTrigger = 'submission' | 'push'
type PipelineRunStatus = 'queued' | 'running' | 'deployed' | 'failed'
type PipelineLogStage = 'system' | 'clone' | 'validate' | 'install' | 'build' | 'deploy' | 'analyze'
type PipelineLogLevel = 'info' | 'warn' | 'error'

type RepositoryMetadata = {
  repositoryFullName: string
  repositoryCloneUrl: string
  repositoryHtmlUrl: string
}

type BuildCommandContext = {
  stage: PipelineLogStage
  runId: string
  cwd: string
  command: string
  args: string[]
  logCommand?: string
  signal?: AbortSignal
}

type TriggerPipelineInput = {
  submissionId: string
  trigger: PipelineTrigger
  branch?: string | null
  commitSha?: string | null
  previewBaseUrl?: string
}

type GitHubPushEventInput = {
  repositoryFullName: string
  repositoryDefaultBranch: string | null
  branch: string | null
  commitSha: string | null
}

type SubmissionPipelineView = {
  submission: {
    id: string
    assignmentId: string
    assignmentTitle: string
    repositoryUrl: string
    status: 'pending' | 'building' | 'deployed' | 'failed'
    deployedUrl: string | null
    latestCommitSha: string | null
    lastBuildAt: Date | null
  }
  selectedRun: {
    id: string
    trigger: PipelineTrigger
    status: PipelineRunStatus
    branch: string | null
    commitSha: string | null
    deploymentUrl: string | null
    startedAt: Date | null
    finishedAt: Date | null
    createdAt: Date
  } | null
  runs: Array<{
    id: string
    trigger: PipelineTrigger
    status: PipelineRunStatus
    branch: string | null
    commitSha: string | null
    deploymentUrl: string | null
    startedAt: Date | null
    finishedAt: Date | null
    createdAt: Date
  }>
  logs: Array<{
    id: string
    stage: PipelineLogStage
    level: PipelineLogLevel
    message: string
    createdAt: Date
  }>
}

type PackageManager = 'pnpm' | 'yarn' | 'npm'
type PreviewExposureMode = 'port' | 'subdomain'

type PackageJsonShape = {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

class PipelineExecutionError extends Error {
  readonly stage: PipelineLogStage

  constructor(stage: PipelineLogStage, message: string) {
    super(message)
    this.name = 'PipelineExecutionError'
    this.stage = stage
  }
}

const runQueue: string[] = []
const queuedRunIdSet = new Set<string>()
const queuedRunPreviewBaseUrl = new Map<string, string>()
const activeRunControllers = new Map<string, AbortController>()
let isRunWorkerActive = false

const toLowerCaseFullName = (value: string): string => {
  return value.trim().toLowerCase()
}

const withNoTrailingSlash = (value: string): string => {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

const lineLimit = 120
const lineLengthLimit = 400

const redactSecrets = (value: string): string => {
  return value.replace(/x-access-token:[^@\s]+@/g, 'x-access-token:***@')
}

const toLogPayload = (value: string): string => {
  const lines = redactSecrets(value)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(0, lineLimit)
    .map((line) => (line.length > lineLengthLimit ? `${line.slice(0, lineLengthLimit)}…` : line))

  return lines.join('\n')
}

const normalizeIdentifier = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

const toContainerName = (submissionId: string): string => {
  const suffix = normalizeIdentifier(submissionId).slice(0, 28)
  return `hiring-engine-preview-${suffix}`
}

const toImageTag = (runId: string): string => {
  const suffix = normalizeIdentifier(runId).slice(0, 28)
  return `hiring-engine-preview:${suffix}`
}

const tryAccess = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

const parsePortFromUrl = (value: string | null): number | null => {
  if (!value) {
    return null
  }

  try {
    const parsedUrl = new URL(value)
    if (!parsedUrl.port) {
      return null
    }

    const port = Number(parsedUrl.port)
    if (!Number.isInteger(port) || port <= 0) {
      return null
    }

    return port
  } catch {
    return null
  }
}

const toNormalizedOrigin = (value: string): string | null => {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

const parseOriginFromUrl = (value: string | null): string | null => {
  if (!value) {
    return null
  }

  return toNormalizedOrigin(value)
}

const isPortAvailable = async (port: number): Promise<boolean> => {
  return await new Promise<boolean>((resolve) => {
    const server = createServer()

    server.once('error', () => {
      resolve(false)
    })

    server.once('listening', () => {
      server.close(() => {
        resolve(true)
      })
    })

    server.listen(port, '0.0.0.0')
  })
}

const pickPreviewPort = async (preferredPort: number | null): Promise<number> => {
  const minPort = Number(process.env.PIPELINE_PREVIEW_PORT_MIN ?? '4500')
  const maxPort = Number(process.env.PIPELINE_PREVIEW_PORT_MAX ?? '5500')

  if (!Number.isInteger(minPort) || !Number.isInteger(maxPort) || minPort <= 0 || maxPort <= 0) {
    throw new PipelineExecutionError('deploy', 'Invalid preview port range configuration.')
  }

  if (minPort > maxPort) {
    throw new PipelineExecutionError('deploy', 'Preview minimum port cannot exceed maximum port.')
  }

  if (preferredPort && preferredPort >= minPort && preferredPort <= maxPort) {
    const isPreferredPortAvailable = await isPortAvailable(preferredPort)
    if (isPreferredPortAvailable) {
      return preferredPort
    }
  }

  const attemptCount = 40

  for (let attemptIndex = 0; attemptIndex < attemptCount; attemptIndex += 1) {
    const candidatePort = randomInt(minPort, maxPort + 1)
    // eslint-disable-next-line no-await-in-loop
    const isCandidatePortAvailable = await isPortAvailable(candidatePort)
    if (isCandidatePortAvailable) {
      return candidatePort
    }
  }

  throw new PipelineExecutionError('deploy', 'Unable to allocate a preview port.')
}

const detectPackageManager = async (repositoryDirectory: string): Promise<PackageManager> => {
  if (await tryAccess(path.join(repositoryDirectory, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }

  if (await tryAccess(path.join(repositoryDirectory, 'yarn.lock'))) {
    return 'yarn'
  }

  return 'npm'
}

const resolveInstallArgs = async (
  packageManager: PackageManager,
  repositoryDirectory: string
): Promise<string[]> => {
  if (packageManager === 'pnpm') {
    return ['install', '--frozen-lockfile']
  }

  if (packageManager === 'yarn') {
    return ['install', '--frozen-lockfile']
  }

  if (await tryAccess(path.join(repositoryDirectory, 'package-lock.json'))) {
    return ['ci']
  }

  return ['install']
}

const resolveBuildArgs = (packageManager: PackageManager): string[] => {
  if (packageManager === 'yarn') {
    return ['build']
  }

  return ['run', 'build']
}

const resolveStartCommand = (packageManager: PackageManager): string => {
  if (packageManager === 'pnpm') {
    return 'pnpm run start'
  }

  if (packageManager === 'yarn') {
    return 'yarn start'
  }

  return 'npm run start'
}

const getPreviewExposureMode = (): PreviewExposureMode => {
  const configuredValue = (process.env.PIPELINE_PREVIEW_EXPOSURE_MODE ?? 'port')
    .trim()
    .toLowerCase()

  if (configuredValue === 'port' || configuredValue === 'subdomain') {
    return configuredValue
  }

  throw new PipelineExecutionError(
    'deploy',
    'PIPELINE_PREVIEW_EXPOSURE_MODE must be either "port" or "subdomain".'
  )
}

const getPreviewBaseDomain = (): string => {
  const configuredValue = (process.env.PIPELINE_PREVIEW_BASE_DOMAIN ?? '').trim().toLowerCase()
  const normalizedDomain = configuredValue.replace(/^\*\./, '')

  if (!normalizedDomain) {
    throw new PipelineExecutionError(
      'deploy',
      'PIPELINE_PREVIEW_BASE_DOMAIN is required when PIPELINE_PREVIEW_EXPOSURE_MODE=subdomain.'
    )
  }

  if (!/^[a-z0-9.-]+$/.test(normalizedDomain) || normalizedDomain.includes('..')) {
    throw new PipelineExecutionError('deploy', 'PIPELINE_PREVIEW_BASE_DOMAIN is invalid.')
  }

  return normalizedDomain
}

const getPreviewSubdomainUrl = (submissionId: string): string => {
  const baseDomain = getPreviewBaseDomain()
  const submissionSuffix = normalizeIdentifier(submissionId).slice(0, 32)

  if (submissionSuffix.length === 0) {
    throw new PipelineExecutionError('deploy', 'Unable to derive preview subdomain from submission.')
  }

  return `https://preview-${submissionSuffix}.${baseDomain}`
}

const getBooleanEnvValue = (input: {
  key: string
  defaultValue: boolean
}): boolean => {
  const rawValue = process.env[input.key]
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return input.defaultValue
  }

  const normalizedValue = rawValue.trim().toLowerCase()
  if (normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'yes') {
    return true
  }

  if (normalizedValue === 'false' || normalizedValue === '0' || normalizedValue === 'no') {
    return false
  }

  throw new PipelineExecutionError(
    'deploy',
    `${input.key} must be a boolean value (true/false).`
  )
}

const getConfiguredPreviewBaseUrl = (): URL => {
  const configuredValue =
    process.env.PIPELINE_PREVIEW_BASE_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost'
  const normalizedOrigin = toNormalizedOrigin(configuredValue)

  if (!normalizedOrigin) {
    throw new PipelineExecutionError(
      'deploy',
      'PIPELINE_PREVIEW_BASE_URL (or BETTER_AUTH_URL fallback) is not a valid URL.'
    )
  }

  return new URL(normalizedOrigin)
}

const buildPreviewUrl = (
  port: number,
  input?: {
    queuedPreviewBaseUrl?: string | null
    previousDeploymentUrl?: string | null
  }
): string => {
  const baseOrigin =
    input?.queuedPreviewBaseUrl ??
    parseOriginFromUrl(input?.previousDeploymentUrl ?? null) ??
    getConfiguredPreviewBaseUrl().toString()

  const baseUrl = new URL(baseOrigin)
  baseUrl.port = String(port)
  return withNoTrailingSlash(baseUrl.toString())
}

const runCommandAllowFailure = async (input: BuildCommandContext): Promise<void> => {
  try {
    await runCommand(input)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Command failed.'
    await appendBuildLog(input.runId, input.stage, 'warn', message)
  }
}

const ensureDockerIgnore = async (repositoryDirectory: string): Promise<void> => {
  const dockerIgnorePath = path.join(repositoryDirectory, '.dockerignore')
  const requiredPatterns = [
    '.git',
    '.next',
    'node_modules',
    'dist',
    'coverage',
    '*.log',
    '*.tsbuildinfo'
  ]

  let existingLines: string[] = []
  if (await tryAccess(dockerIgnorePath)) {
    const existingContent = await readFile(dockerIgnorePath, 'utf8')
    existingLines = existingContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  }

  const lineSet = new Set(existingLines)
  for (const pattern of requiredPatterns) {
    lineSet.add(pattern)
  }

  const nextContent = `${Array.from(lineSet).join('\n')}\n`
  await writeFile(dockerIgnorePath, nextContent, 'utf8')
}

const createDockerfileContent = (startCommand: string): string => {
  return `FROM node:20-alpine
WORKDIR /app
ENV CI=true
COPY . .
RUN corepack enable || true
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; elif [ -f package-lock.json ]; then npm ci; else npm install; fi
RUN if [ -f pnpm-lock.yaml ]; then pnpm run build; elif [ -f yarn.lock ]; then yarn build; else npm run build; fi
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["sh","-c","${startCommand}"]`
}

const appendBuildLog = async (
  runId: string,
  stage: PipelineLogStage,
  level: PipelineLogLevel,
  message: string
): Promise<void> => {
  const normalizedMessage = message.trim()
  if (normalizedMessage.length === 0) {
    return
  }

  const [inserted] = await db.insert(buildLogs).values({
    buildRunId: runId,
    stage,
    level,
    message: normalizedMessage
  }).returning({
    id: buildLogs.id,
    createdAt: buildLogs.createdAt
  })

  if (inserted) {
    pipelineEvents.emitLog({
      runId,
      log: {
        id: inserted.id,
        stage,
        level,
        message: normalizedMessage,
        createdAt: inserted.createdAt.toISOString()
      }
    })
  }
}

const updateSubmissionStatus = async (
  submissionId: string,
  status: 'pending' | 'building' | 'deployed' | 'failed',
  input?: {
    latestCommitSha?: string | null
    deployedUrl?: string | null
    lastBuildAt?: Date | null
  }
): Promise<void> => {
  await db
    .update(submissions)
    .set({
      status,
      latestCommitSha: input?.latestCommitSha,
      deployedUrl: input?.deployedUrl,
      lastBuildAt: input?.lastBuildAt ?? null,
      updatedAt: new Date()
    })
    .where(eq(submissions.id, submissionId))
}

const runCommand = async (input: BuildCommandContext): Promise<{ stdout: string; stderr: string }> => {
  const commandLabel = input.logCommand ?? `${input.command} ${input.args.join(' ')}`.trim()

  await appendBuildLog(input.runId, input.stage, 'info', `Running: ${commandLabel}`)

  const timeoutMs = Number(process.env.PIPELINE_COMMAND_TIMEOUT_MS ?? '600000')

  const commandResult = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const childProcess = spawn(input.command, input.args, {
      cwd: input.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: input.signal
    })

    const stdoutChunks: string[] = []
    const stderrChunks: string[] = []
    let didTimeout = false

    const timeoutId = setTimeout(() => {
      didTimeout = true
      childProcess.kill('SIGTERM')
    }, timeoutMs)

    childProcess.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk.toString('utf8'))
    })

    childProcess.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk.toString('utf8'))
    })

    childProcess.on('error', (error) => {
      clearTimeout(timeoutId)
      if (input.signal?.aborted) {
        reject(new PipelineExecutionError(input.stage, 'Command aborted by user.'))
        return
      }
      reject(new PipelineExecutionError(input.stage, error.message))
    })

    childProcess.on('close', (exitCode) => {
      clearTimeout(timeoutId)
      const stdout = stdoutChunks.join('')
      const stderr = stderrChunks.join('')

      if (didTimeout) {
        reject(new PipelineExecutionError(input.stage, `Command timed out after ${timeoutMs}ms.`))
        return
      }

      if (exitCode !== 0) {
        const stderrSummary = toLogPayload(stderr)
        const details = stderrSummary.length > 0 ? `\n${stderrSummary}` : ''
        reject(
          new PipelineExecutionError(
            input.stage,
            `Command failed (${commandLabel}) with exit code ${exitCode}.${details}`
          )
        )
        return
      }

      resolve({
        stdout,
        stderr
      })
    })
  })

  const stdoutPayload = toLogPayload(commandResult.stdout)
  if (stdoutPayload.length > 0) {
    await appendBuildLog(input.runId, input.stage, 'info', stdoutPayload)
  }

  const stderrPayload = toLogPayload(commandResult.stderr)
  if (stderrPayload.length > 0) {
    await appendBuildLog(input.runId, input.stage, 'warn', stderrPayload)
  }

  return commandResult
}

const ensureNextJsProject = (packageJson: PackageJsonShape): boolean => {
  const dependencies = packageJson.dependencies ?? {}
  const devDependencies = packageJson.devDependencies ?? {}

  return typeof dependencies.next === 'string' || typeof devDependencies.next === 'string'
}

const runPipeline = async (runId: string): Promise<void> => {
  const queuedPreviewBaseUrlForRun = queuedRunPreviewBaseUrl.get(runId) ?? null
  queuedRunPreviewBaseUrl.delete(runId)

  const [runRecord] = await db
    .select({
      id: buildRuns.id,
      submissionId: buildRuns.submissionId,
      trigger: buildRuns.trigger,
      runStatus: buildRuns.status,
      branch: buildRuns.branch,
      commitSha: buildRuns.commitSha,
      submissionRepositoryUrl: submissions.repositoryUrl,
      submissionRepositoryDefaultBranch: submissions.repositoryDefaultBranch,
      submissionDeployedUrl: submissions.deployedUrl,
      submissionRepositoryFullName: submissions.repositoryFullName,
      submissionGithubInstallationId: submissions.githubInstallationId
    })
    .from(buildRuns)
    .innerJoin(submissions, eq(buildRuns.submissionId, submissions.id))
    .where(eq(buildRuns.id, runId))
    .limit(1)

  if (!runRecord || runRecord.runStatus !== 'queued') {
    return
  }

  let tempRootPath: string | null = null
  let repositoryDirectory: string | null = null
  let resolvedCommitSha = runRecord.commitSha ?? null
  let didAttemptAiReport = false
  const runAbortController = new AbortController()
  activeRunControllers.set(runId, runAbortController)

  await db
    .update(buildRuns)
    .set({
      status: 'running',
      startedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(buildRuns.id, runId))

  pipelineEvents.emitRunStatus({ runId, status: 'running' })

  await updateSubmissionStatus(runRecord.submissionId, 'building', {
    latestCommitSha: runRecord.commitSha ?? null,
    deployedUrl: null,
    lastBuildAt: null
  })
  await appendBuildLog(runId, 'system', 'info', `Pipeline started. Trigger: ${runRecord.trigger}.`)

  try {
    tempRootPath = await mkdtemp(path.join(tmpdir(), 'hiring-engine-run-'))
    repositoryDirectory = path.join(tempRootPath, 'repo')
    const cloneTargetBranch = runRecord.branch ?? runRecord.submissionRepositoryDefaultBranch
    let cloneSource = runRecord.submissionRepositoryUrl
    let cloneSourceLabel = runRecord.submissionRepositoryUrl

    if (runRecord.submissionGithubInstallationId && runRecord.submissionRepositoryFullName) {
      const authenticatedClone = await githubAppService.getAuthenticatedCloneUrl(
        runRecord.submissionGithubInstallationId,
        runRecord.submissionRepositoryFullName
      )
      cloneSource = authenticatedClone.cloneUrl
      cloneSourceLabel = authenticatedClone.repository.htmlUrl
    }

    const cloneArgs = ['clone', '--depth', '1']
    if (cloneTargetBranch) {
      cloneArgs.push('--branch', cloneTargetBranch)
    }
    cloneArgs.push(cloneSource, repositoryDirectory)

    await runCommand({
      stage: 'clone',
      runId,
      cwd: tempRootPath,
      command: 'git',
      args: cloneArgs,
      logCommand: `git clone --depth 1${cloneTargetBranch ? ` --branch ${cloneTargetBranch}` : ''} ${cloneSourceLabel} ${repositoryDirectory}`,
      signal: runAbortController.signal
    })

    const revisionResult = await runCommand({
      stage: 'clone',
      runId,
      cwd: repositoryDirectory,
      command: 'git',
      args: ['rev-parse', 'HEAD'],
      signal: runAbortController.signal
    })

    const normalizedCommitSha = revisionResult.stdout.trim()
    if (normalizedCommitSha.length > 0) {
      resolvedCommitSha = normalizedCommitSha
    }

    const packageJsonFile = path.join(repositoryDirectory, 'package.json')
    const packageJsonRaw = await readFile(packageJsonFile, 'utf8')
    const packageJson = JSON.parse(packageJsonRaw) as PackageJsonShape

    if (!ensureNextJsProject(packageJson)) {
      throw new PipelineExecutionError(
        'validate',
        'Build rejected. Only Next.js repositories are supported.'
      )
    }

    if (!packageJson.scripts || typeof packageJson.scripts.build !== 'string') {
      throw new PipelineExecutionError(
        'validate',
        'Build rejected. package.json must include a build script.'
      )
    }

    await appendBuildLog(runId, 'validate', 'info', 'Next.js project validation passed.')

    const packageManager = await detectPackageManager(repositoryDirectory)
    await appendBuildLog(runId, 'install', 'info', `Detected package manager: ${packageManager}`)

    await runCommand({
      stage: 'install',
      runId,
      cwd: repositoryDirectory,
      command: packageManager,
      args: await resolveInstallArgs(packageManager, repositoryDirectory)
    })

    await runCommand({
      stage: 'build',
      runId,
      cwd: repositoryDirectory,
      command: packageManager,
      args: resolveBuildArgs(packageManager)
    })

    if (!packageJson.scripts || typeof packageJson.scripts.start !== 'string') {
      throw new PipelineExecutionError(
        'validate',
        'Build rejected. package.json must include a start script for deployment.'
      )
    }

    let deploymentUrl = ''
    const deploymentMode = (process.env.PIPELINE_DEPLOYMENT_MODE ?? 'docker').toLowerCase()
    const previewExposureMode = getPreviewExposureMode()

    if (deploymentMode === 'docker') {
      const containerName = toContainerName(runRecord.submissionId)
      const imageTag = toImageTag(runId)
      const dockerfilePath = path.join(repositoryDirectory, '.hiring-engine.Dockerfile')

      await ensureDockerIgnore(repositoryDirectory)
      await writeFile(dockerfilePath, createDockerfileContent(resolveStartCommand(packageManager)), 'utf8')

      await runCommand({
        stage: 'deploy',
        runId,
        cwd: repositoryDirectory,
        command: 'docker',
        args: ['version', '--format', '{{.Server.Version}}']
      })

      await runCommand({
        stage: 'deploy',
        runId,
        cwd: repositoryDirectory,
        command: 'docker',
        args: ['build', '-f', '.hiring-engine.Dockerfile', '-t', imageTag, '.']
      })

      await runCommandAllowFailure({
        stage: 'deploy',
        runId,
        cwd: repositoryDirectory,
        command: 'docker',
        args: ['rm', '-f', containerName]
      })

      if (previewExposureMode === 'subdomain') {
        const deploymentSubdomainUrl = getPreviewSubdomainUrl(runRecord.submissionId)
        const deploymentHost = new URL(deploymentSubdomainUrl).host
        const routeSuffix = normalizeIdentifier(runRecord.submissionId).slice(0, 20)
        const routerName = `he-preview-${routeSuffix}`
        const serviceName = `he-preview-svc-${routeSuffix}`
        const traefikEntrypoints =
          (process.env.PIPELINE_PREVIEW_TRAEFIK_ENTRYPOINTS ?? 'web').trim() || 'web'
        const isTraefikTlsEnabled = getBooleanEnvValue({
          key: 'PIPELINE_PREVIEW_TRAEFIK_TLS',
          defaultValue: false
        })
        const previewDockerNetwork = process.env.PIPELINE_PREVIEW_DOCKER_NETWORK?.trim()
        if (!previewDockerNetwork) {
          throw new PipelineExecutionError(
            'deploy',
            'PIPELINE_PREVIEW_DOCKER_NETWORK is required when PIPELINE_PREVIEW_EXPOSURE_MODE=subdomain.'
          )
        }

        const dockerRunArgs = ['run', '-d', '--name', containerName, '-e', 'PORT=3000']
        dockerRunArgs.push('--network', previewDockerNetwork)
        dockerRunArgs.push('--label', `traefik.docker.network=${previewDockerNetwork}`)

        dockerRunArgs.push(
          '--label',
          'traefik.enable=true',
          '--label',
          `traefik.http.routers.${routerName}.rule=Host(\`${deploymentHost}\`)`,
          '--label',
          `traefik.http.routers.${routerName}.entrypoints=${traefikEntrypoints}`,
          '--label',
          `traefik.http.routers.${routerName}.service=${serviceName}`,
          '--label',
          `traefik.http.services.${serviceName}.loadbalancer.server.port=3000`,
          imageTag
        )

        if (isTraefikTlsEnabled) {
          dockerRunArgs.splice(dockerRunArgs.length - 1, 0, '--label')
          dockerRunArgs.splice(dockerRunArgs.length - 1, 0, `traefik.http.routers.${routerName}.tls=true`)
        }

        await runCommand({
          stage: 'deploy',
          runId,
          cwd: repositoryDirectory,
          command: 'docker',
          args: dockerRunArgs
        })

        deploymentUrl = deploymentSubdomainUrl
        await appendBuildLog(
          runId,
          'deploy',
          'info',
          `Docker deployment started in container ${containerName} with hostname ${deploymentHost} (entrypoints=${traefikEntrypoints}, tls=${isTraefikTlsEnabled ? 'enabled' : 'disabled'}).`
        )
      } else {
        const preferredPort = parsePortFromUrl(runRecord.submissionDeployedUrl)
        const hostPort = await pickPreviewPort(preferredPort)

        await runCommand({
          stage: 'deploy',
          runId,
          cwd: repositoryDirectory,
          command: 'docker',
          args: [
            'run',
            '-d',
            '--name',
            containerName,
            '-e',
            'PORT=3000',
            '-p',
            `${hostPort}:3000`,
            imageTag
          ]
        })

        deploymentUrl = buildPreviewUrl(hostPort, {
          queuedPreviewBaseUrl: queuedPreviewBaseUrlForRun,
          previousDeploymentUrl: runRecord.submissionDeployedUrl
        })
        await appendBuildLog(
          runId,
          'deploy',
          'info',
          `Docker deployment started in container ${containerName} on port ${hostPort}.`
        )
      }
    } else {
      const deploymentBaseUrl = withNoTrailingSlash(
        process.env.PIPELINE_DEPLOYMENT_BASE_URL ?? 'https://preview.hiring-engine.local'
      )
      deploymentUrl = `${deploymentBaseUrl}/submission/${runRecord.submissionId}/run/${runId}`
      await appendBuildLog(
        runId,
        'deploy',
        'warn',
        `PIPELINE_DEPLOYMENT_MODE is "${deploymentMode}". Falling back to simulated deployment URL.`
      )
    }

    await appendBuildLog(runId, 'deploy', 'info', `Deployment ready at ${deploymentUrl}`)

    await appendBuildLog(runId, 'analyze', 'info', 'Generating AI performance report...')
    didAttemptAiReport = true
    try {
      await aiReportService.generateReportForSubmission({
        submissionId: runRecord.submissionId,
        buildRunId: runId,
        repositoryDirectory
      })
      await appendBuildLog(runId, 'analyze', 'info', 'AI performance report generated.')
    } catch (error: unknown) {
      const reportErrorMessage =
        error instanceof Error ? error.message : 'Unknown AI report error.'
      await appendBuildLog(
        runId,
        'analyze',
        'warn',
        `AI report generation failed: ${reportErrorMessage}`
      )
    }

    const completedAt = new Date()

    await db
      .update(buildRuns)
      .set({
        status: 'deployed',
        deploymentUrl,
        commitSha: resolvedCommitSha,
        finishedAt: completedAt,
        updatedAt: completedAt
      })
      .where(eq(buildRuns.id, runId))

    pipelineEvents.emitRunStatus({ runId, status: 'deployed' })

    await updateSubmissionStatus(runRecord.submissionId, 'deployed', {
      latestCommitSha: resolvedCommitSha,
      deployedUrl: deploymentUrl,
      lastBuildAt: completedAt
    })
  } catch (error: unknown) {
    const failedAt = new Date()
    const stage = error instanceof PipelineExecutionError ? error.stage : 'system'
    const message =
      error instanceof Error ? error.message : 'Unexpected pipeline failure.'

    await appendBuildLog(runId, stage, 'error', message)

    if (repositoryDirectory && !didAttemptAiReport) {
      await appendBuildLog(
        runId,
        'analyze',
        'info',
        'Attempting AI performance report despite pipeline failure...'
      )
      didAttemptAiReport = true

      try {
        await aiReportService.generateReportForSubmission({
          submissionId: runRecord.submissionId,
          buildRunId: runId,
          repositoryDirectory
        })
        await appendBuildLog(
          runId,
          'analyze',
          'info',
          'AI performance report generated for failed pipeline run.'
        )
      } catch (aiError: unknown) {
        const aiErrorMessage =
          aiError instanceof Error ? aiError.message : 'Unknown AI report error.'
        await appendBuildLog(
          runId,
          'analyze',
          'warn',
          `AI report generation failed after pipeline failure: ${aiErrorMessage}`
        )
      }
    }

    await db
      .update(buildRuns)
      .set({
        status: 'failed',
        commitSha: resolvedCommitSha,
        finishedAt: failedAt,
        updatedAt: failedAt
      })
      .where(eq(buildRuns.id, runId))

    pipelineEvents.emitRunStatus({ runId, status: 'failed' })

    await updateSubmissionStatus(runRecord.submissionId, 'failed', {
      latestCommitSha: resolvedCommitSha,
      deployedUrl: null,
      lastBuildAt: failedAt
    })
  } finally {
    if (tempRootPath) {
      await rm(tempRootPath, { recursive: true, force: true })
    }
    activeRunControllers.delete(runId)
  }
}

const cancelPipelineRun = async (runId: string): Promise<boolean> => {
  if (queuedRunIdSet.has(runId)) {
    queuedRunIdSet.delete(runId)
    const index = runQueue.indexOf(runId)
    if (index !== -1) runQueue.splice(index, 1)

    // Mark failed instantly
    await db
      .update(buildRuns)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(buildRuns.id, runId))
      
    await appendBuildLog(runId, 'system', 'warn', 'Pipeline canceled while queued.')
    pipelineEvents.emitRunStatus({ runId, status: 'failed' })
    return true
  }

  const controller = activeRunControllers.get(runId)
  if (controller) {
    controller.abort('Canceled by user')
    return true
  }

  return false
}

const processRunQueue = async (): Promise<void> => {
  if (isRunWorkerActive) {
    return
  }

  isRunWorkerActive = true

  try {
    while (runQueue.length > 0) {
      const runId = runQueue.shift()
      if (!runId) {
        continue
      }

      queuedRunIdSet.delete(runId)
      await runPipeline(runId)
    }
  } finally {
    isRunWorkerActive = false
  }
}

const enqueueRun = (runId: string): void => {
  if (queuedRunIdSet.has(runId)) {
    return
  }

  queuedRunIdSet.add(runId)
  runQueue.push(runId)
  void processRunQueue()
}

const loadSubmissionPipelineView = async (
  submissionId: string,
  requestedRunId?: string
): Promise<Omit<SubmissionPipelineView, 'submission'> | null> => {
  const runs = await db
    .select({
      id: buildRuns.id,
      trigger: buildRuns.trigger,
      status: buildRuns.status,
      branch: buildRuns.branch,
      commitSha: buildRuns.commitSha,
      deploymentUrl: buildRuns.deploymentUrl,
      startedAt: buildRuns.startedAt,
      finishedAt: buildRuns.finishedAt,
      createdAt: buildRuns.createdAt
    })
    .from(buildRuns)
    .where(eq(buildRuns.submissionId, submissionId))
    .orderBy(desc(buildRuns.createdAt))
    .limit(20)

  const selectedRun = requestedRunId
    ? runs.find((run) => run.id === requestedRunId) ?? null
    : runs[0] ?? null

  if (!selectedRun) {
    return {
      selectedRun: null,
      runs,
      logs: []
    }
  }

  const logs = await db
    .select({
      id: buildLogs.id,
      stage: buildLogs.stage,
      level: buildLogs.level,
      message: buildLogs.message,
      createdAt: buildLogs.createdAt
    })
    .from(buildLogs)
    .where(eq(buildLogs.buildRunId, selectedRun.id))
    .orderBy(buildLogs.createdAt)
    .limit(1000)

  return {
    selectedRun,
    runs,
    logs
  }
}

export const pipelineService = {
  parseGitHubRepositoryMetadata: (repositoryUrl: string): RepositoryMetadata => {
    const parsedUrl = new URL(repositoryUrl)
    const hostname = parsedUrl.hostname.replace(/^www\./i, '').toLowerCase()

    if (hostname !== 'github.com') {
      throw new Error('Repository URL must be hosted on github.com.')
    }

    const pathParts = parsedUrl.pathname.split('/').filter((part) => part.length > 0)
    if (pathParts.length < 2) {
      throw new Error('Repository URL must include an owner and repository name.')
    }

    const owner = pathParts[0]
    const repository = pathParts[1].replace(/\.git$/i, '')

    if (!owner || !repository) {
      throw new Error('Repository URL must include a valid owner and repository name.')
    }

    const repositoryFullName = toLowerCaseFullName(`${owner}/${repository}`)

    return {
      repositoryFullName,
      repositoryCloneUrl: `https://github.com/${owner}/${repository}.git`,
      repositoryHtmlUrl: `https://github.com/${owner}/${repository}`
    }
  },

  enqueuePipelineRun: async (input: TriggerPipelineInput) => {
    const [createdRun] = await db
      .insert(buildRuns)
      .values({
        submissionId: input.submissionId,
        trigger: input.trigger,
        branch: input.branch ?? null,
        commitSha: input.commitSha ?? null,
        status: 'queued'
      })
      .returning({
        id: buildRuns.id,
        submissionId: buildRuns.submissionId
      })

    if (!createdRun) {
      throw new Error('Unable to enqueue a pipeline run.')
    }

    const normalizedPreviewBaseUrl =
      typeof input.previewBaseUrl === 'string'
        ? toNormalizedOrigin(input.previewBaseUrl)
        : null

    if (normalizedPreviewBaseUrl) {
      queuedRunPreviewBaseUrl.set(createdRun.id, normalizedPreviewBaseUrl)
    } else if (input.previewBaseUrl) {
      await appendBuildLog(
        createdRun.id,
        'system',
        'warn',
        'Provided preview base URL was invalid. Falling back to deployment defaults.'
      )
    }

    await appendBuildLog(
      createdRun.id,
      'system',
      'info',
      `Pipeline queued. Trigger: ${input.trigger}.`
    )

    enqueueRun(createdRun.id)

    return createdRun
  },

  enqueueRunsForGitHubPush: async (input: GitHubPushEventInput) => {
    const normalizedFullName = toLowerCaseFullName(input.repositoryFullName)

    const matchingSubmissions = await db
      .select({
        id: submissions.id,
        deployedUrl: submissions.deployedUrl
      })
      .from(submissions)
      .where(eq(submissions.repositoryFullName, normalizedFullName))

    if (matchingSubmissions.length === 0) {
      return {
        repositoryFullName: normalizedFullName,
        matchedSubmissions: 0,
        queuedRuns: 0
      }
    }

    const now = new Date()
    const submissionIds = matchingSubmissions.map((record) => record.id)

    await db
      .update(submissions)
      .set({
        repositoryFullName: normalizedFullName,
        repositoryDefaultBranch: input.repositoryDefaultBranch,
        latestCommitSha: input.commitSha,
        deployedUrl: null,
        lastBuildAt: null,
        status: 'pending',
        updatedAt: now
      })
      .where(inArray(submissions.id, submissionIds))

    let queuedRuns = 0

    for (const submissionRecord of matchingSubmissions) {
      await pipelineService.enqueuePipelineRun({
        submissionId: submissionRecord.id,
        trigger: 'push',
        branch: input.branch,
        commitSha: input.commitSha,
        previewBaseUrl: submissionRecord.deployedUrl ?? undefined
      })
      queuedRuns += 1
    }

    return {
      repositoryFullName: normalizedFullName,
      matchedSubmissions: matchingSubmissions.length,
      queuedRuns
    }
  },

  getCandidateSubmissionPipeline: async (
    candidateId: string,
    submissionId: string,
    requestedRunId?: string
  ): Promise<SubmissionPipelineView | null> => {
    const [submissionRecord] = await db
      .select({
        id: submissions.id,
        assignmentId: submissions.assignmentId,
        assignmentTitle: assignments.title,
        repositoryUrl: submissions.repositoryUrl,
        status: submissions.status,
        deployedUrl: submissions.deployedUrl,
        latestCommitSha: submissions.latestCommitSha,
        lastBuildAt: submissions.lastBuildAt
      })
      .from(submissions)
      .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
      .where(and(eq(submissions.id, submissionId), eq(submissions.candidateId, candidateId)))
      .limit(1)

    if (!submissionRecord) {
      return null
    }

    const pipelineView = await loadSubmissionPipelineView(submissionRecord.id, requestedRunId)
    if (!pipelineView) {
      return null
    }

    return {
      submission: submissionRecord,
      ...pipelineView
    }
  },

  getEmployerSubmissionPipeline: async (
    employerId: string,
    submissionId: string,
    requestedRunId?: string
  ): Promise<SubmissionPipelineView | null> => {
    const [submissionRecord] = await db
      .select({
        id: submissions.id,
        assignmentId: submissions.assignmentId,
        assignmentTitle: assignments.title,
        repositoryUrl: submissions.repositoryUrl,
        status: submissions.status,
        deployedUrl: submissions.deployedUrl,
        latestCommitSha: submissions.latestCommitSha,
        lastBuildAt: submissions.lastBuildAt
      })
      .from(submissions)
      .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
      .where(and(eq(submissions.id, submissionId), eq(assignments.employerId, employerId)))
      .limit(1)

    if (!submissionRecord) {
      return null
    }

    const pipelineView = await loadSubmissionPipelineView(submissionRecord.id, requestedRunId)
    if (!pipelineView) {
      return null
    }

    return {
      submission: submissionRecord,
      ...pipelineView
    }
  },

  cancelPipelineRun
}
