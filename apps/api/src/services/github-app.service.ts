import { createHmac, createSign, timingSafeEqual } from 'node:crypto'

type GitHubAppPublicConfig = {
  isConfigured: boolean
  appSlug: string | null
  appId: string | null
  installUrl: string | null
}

type RepositoryIntegrationResult = {
  isConfigured: boolean
  isInstalled: boolean
  repositoryFullName: string
  repositoryHtmlUrl: string | null
  repositoryCloneUrl: string | null
  defaultBranch: string | null
  githubInstallationId: string | null
}

type GitHubInstallationLookupResponse = {
  id: number
}

type GitHubInstallationAccessTokenResponse = {
  token: string
}

type GitHubRepositoryResponse = {
  full_name: string
  name: string
  private: boolean
  owner: {
    login: string
  }
  html_url: string
  clone_url: string
  default_branch: string
}

type GitHubInstallationRepositoriesResponse = {
  repositories: GitHubRepositoryResponse[]
}

type GitHubInstallationRepositorySummary = {
  fullName: string
  name: string
  owner: string
  isPrivate: boolean
  htmlUrl: string
  cloneUrl: string
  defaultBranch: string
}

export class GitHubApiError extends Error {
  readonly status: number
  readonly responseBody: string

  constructor(status: number, responseBody: string, message: string) {
    super(message)
    this.name = 'GitHubApiError'
    this.status = status
    this.responseBody = responseBody
  }
}

const base64UrlEncode = (value: string): string => {
  return Buffer.from(value, 'utf8').toString('base64url')
}

const decodeBase64 = (value: string): string | null => {
  try {
    const normalizedValue = value
      .trim()
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const paddingLength = normalizedValue.length % 4
    const paddedValue =
      paddingLength === 0 ? normalizedValue : `${normalizedValue}${'='.repeat(4 - paddingLength)}`

    return Buffer.from(paddedValue, 'base64').toString('utf8')
  } catch {
    return null
  }
}

const getConfiguredPrivateKey = (): string | null => {
  const base64PrivateKey = process.env.GITHUB_APP_PRIVATE_KEY_BASE64
  if (base64PrivateKey && base64PrivateKey.trim().length > 0) {
    const decodedPrivateKey = decodeBase64(base64PrivateKey)
    if (decodedPrivateKey && decodedPrivateKey.trim().length > 0) {
      return decodedPrivateKey
    }
  }
  return null

  // const rawPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY
  // if (!rawPrivateKey || rawPrivateKey.trim().length === 0) {
  //   return null
  // }

  // return rawPrivateKey.replace(/\\n/g, '\n')
}

const getInstallUrl = (appSlug: string | null): string | null => {
  if (!appSlug) {
    return null
  }

  return `https://github.com/apps/${appSlug}/installations/new`
}

const getGitHubApiHeaders = (authorizationValue: string): HeadersInit => {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: authorizationValue,
    'X-GitHub-Api-Version': '2022-11-28'
  }
}

const resolvePublicConfig = (): GitHubAppPublicConfig => {
  const appId = process.env.GITHUB_APP_ID?.trim() ?? null
  const appSlug = process.env.GITHUB_APP_SLUG?.trim() ?? null
  const privateKey = getConfiguredPrivateKey()

  const isConfigured = Boolean(appId && privateKey)

  return {
    isConfigured,
    appSlug,
    appId,
    installUrl: getInstallUrl(appSlug)
  }
}

const createAppJwt = (): string => {
  const appId = process.env.GITHUB_APP_ID?.trim()
  const privateKey = getConfiguredPrivateKey()

  if (!appId || !privateKey) {
    throw new Error(
      'GitHub App is not configured. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY_BASE64 (preferred) or GITHUB_APP_PRIVATE_KEY.'
    )
  }

  const nowInSeconds = Math.floor(Date.now() / 1000)
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  }
  const payload = {
    iat: nowInSeconds - 60,
    exp: nowInSeconds + 9 * 60,
    iss: appId
  }

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsignedToken)
  signer.end()

  const signature = signer.sign(privateKey, 'base64url')
  return `${unsignedToken}.${signature}`
}

const gitHubRequest = async <T>(input: {
  path: string
  method?: 'GET' | 'POST'
  authorizationValue: string
  body?: Record<string, unknown>
}): Promise<T> => {
  const response = await fetch(`https://api.github.com${input.path}`, {
    method: input.method ?? 'GET',
    headers: getGitHubApiHeaders(input.authorizationValue),
    body: input.body ? JSON.stringify(input.body) : undefined
  })

  if (!response.ok) {
    const responseBody = await response.text()
    throw new GitHubApiError(
      response.status,
      responseBody,
      `GitHub API request failed with status ${response.status}.`
    )
  }

  return (await response.json()) as T
}

const getInstallationAccessToken = async (installationId: number): Promise<string> => {
  const appJwt = createAppJwt()
  const response = await gitHubRequest<GitHubInstallationAccessTokenResponse>({
    path: `/app/installations/${installationId}/access_tokens`,
    method: 'POST',
    authorizationValue: `Bearer ${appJwt}`
  })

  return response.token
}

const toRepositoryPath = (repositoryFullName: string): string => {
  const normalized = repositoryFullName.trim().toLowerCase()
  const parts = normalized.split('/').filter((part) => part.length > 0)
  if (parts.length !== 2) {
    throw new Error('Repository full name must be in owner/repo format.')
  }

  return `/repos/${parts[0]}/${parts[1]}`
}

const toNumericInstallationId = (installationId: string): number => {
  const normalized = installationId.trim()
  if (!/^\d+$/.test(normalized)) {
    throw new Error('Installation ID must be numeric.')
  }

  const asNumber = Number(normalized)
  if (!Number.isSafeInteger(asNumber) || asNumber <= 0) {
    throw new Error('Installation ID is invalid.')
  }

  return asNumber
}

const mapRepositorySummary = (
  repository: GitHubRepositoryResponse
): GitHubInstallationRepositorySummary => {
  return {
    fullName: repository.full_name.toLowerCase(),
    name: repository.name,
    owner: repository.owner.login,
    isPrivate: repository.private,
    htmlUrl: repository.html_url,
    cloneUrl: repository.clone_url,
    defaultBranch: repository.default_branch
  }
}

export const githubAppService = {
  getPublicConfig: (): GitHubAppPublicConfig => {
    return resolvePublicConfig()
  },

  isValidWebhookSignature: (rawBody: string, providedSignature: string | null): boolean => {
    const webhookSecret =
      process.env.GITHUB_APP_WEBHOOK_SECRET ?? process.env.GITHUB_WEBHOOK_SECRET

    if (!webhookSecret || webhookSecret.trim().length === 0) {
      return true
    }

    if (!providedSignature || !providedSignature.startsWith('sha256=')) {
      return false
    }

    const expectedSignature = `sha256=${createHmac('sha256', webhookSecret).update(rawBody).digest('hex')}`
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8')
    const providedBuffer = Buffer.from(providedSignature, 'utf8')

    if (expectedBuffer.length !== providedBuffer.length) {
      return false
    }

    return timingSafeEqual(expectedBuffer, providedBuffer)
  },

  resolveRepositoryIntegration: async (repositoryFullName: string): Promise<RepositoryIntegrationResult> => {
    const publicConfig = resolvePublicConfig()

    if (!publicConfig.isConfigured) {
      return {
        isConfigured: false,
        isInstalled: false,
        repositoryFullName: repositoryFullName.toLowerCase(),
        repositoryHtmlUrl: null,
        repositoryCloneUrl: null,
        defaultBranch: null,
        githubInstallationId: null
      }
    }

    const repositoryPath = toRepositoryPath(repositoryFullName)
    const appJwt = createAppJwt()

    let installationLookup: GitHubInstallationLookupResponse
    try {
      installationLookup = await gitHubRequest<GitHubInstallationLookupResponse>({
        path: `${repositoryPath}/installation`,
        authorizationValue: `Bearer ${appJwt}`
      })
    } catch (error: unknown) {
      if (error instanceof GitHubApiError && error.status === 404) {
        return {
          isConfigured: true,
          isInstalled: false,
          repositoryFullName: repositoryFullName.toLowerCase(),
          repositoryHtmlUrl: null,
          repositoryCloneUrl: null,
          defaultBranch: null,
          githubInstallationId: null
        }
      }

      throw error
    }

    const installationAccessToken = await getInstallationAccessToken(installationLookup.id)
    const repository = await gitHubRequest<GitHubRepositoryResponse>({
      path: repositoryPath,
      authorizationValue: `Bearer ${installationAccessToken}`
    })

    return {
      isConfigured: true,
      isInstalled: true,
      repositoryFullName: repositoryFullName.toLowerCase(),
      repositoryHtmlUrl: repository.html_url,
      repositoryCloneUrl: repository.clone_url,
      defaultBranch: repository.default_branch,
      githubInstallationId: String(installationLookup.id)
    }
  },

  listInstallationRepositories: async (installationId: string) => {
    const normalizedInstallationId = String(toNumericInstallationId(installationId))
    const installationAccessToken = await getInstallationAccessToken(
      Number(normalizedInstallationId)
    )

    const response = await gitHubRequest<GitHubInstallationRepositoriesResponse>({
      path: '/installation/repositories?per_page=100',
      authorizationValue: `Bearer ${installationAccessToken}`
    })

    const repositories = response.repositories
      .map((repository) => mapRepositorySummary(repository))
      .sort((left, right) => left.fullName.localeCompare(right.fullName))

    return {
      installationId: normalizedInstallationId,
      repositories
    }
  },

  getInstallationRepository: async (installationId: string, repositoryFullName: string) => {
    const normalizedInstallationId = String(toNumericInstallationId(installationId))
    const repositoryPath = toRepositoryPath(repositoryFullName)
    const installationAccessToken = await getInstallationAccessToken(
      Number(normalizedInstallationId)
    )

    const repository = await gitHubRequest<GitHubRepositoryResponse>({
      path: repositoryPath,
      authorizationValue: `Bearer ${installationAccessToken}`
    })

    return {
      installationId: normalizedInstallationId,
      repository: mapRepositorySummary(repository)
    }
  },

  getAuthenticatedCloneUrl: async (installationId: string, repositoryFullName: string) => {
    const normalizedInstallationId = String(toNumericInstallationId(installationId))
    const installationAccessToken = await getInstallationAccessToken(
      Number(normalizedInstallationId)
    )
    const repositoryPath = toRepositoryPath(repositoryFullName)

    const repository = await gitHubRequest<GitHubRepositoryResponse>({
      path: repositoryPath,
      authorizationValue: `Bearer ${installationAccessToken}`
    })

    const url = new URL(repository.clone_url)
    url.username = 'x-access-token'
    url.password = installationAccessToken

    return {
      cloneUrl: url.toString(),
      repository: mapRepositorySummary(repository)
    }
  }
}
