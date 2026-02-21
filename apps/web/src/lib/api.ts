export type UserRole = "employer" | "candidate"

export type SessionUser = {
  id: string
  name: string
  email: string
  role: UserRole
}

export type SessionState = {
  user: SessionUser
  sessionId: string
}

export type CreateAssignmentInput = {
  title: string
  instructions: string
}

export type AssignmentRecord = {
  id: string
  title: string
  instructions: string
  joinCode: string
  employerId: string
  createdAt: string
  updatedAt: string
}

export type DashboardAssignment = {
  id: string
  title: string
  joinCode: string
  createdAt: string
  updatedAt: string
  submissionCount: number
  latestSubmissionAt: string | null
}

export type DashboardSubmissionStatus = "pending" | "building" | "deployed" | "failed"

export type DashboardSubmission = {
  id: string
  assignmentId: string
  assignmentTitle: string
  candidateId: string
  repositoryUrl: string
  status: DashboardSubmissionStatus
  createdAt: string
  updatedAt: string
}

export type DashboardOverview = {
  metrics: {
    assignmentCount: number
    submissionCount: number
    pendingCount: number
    buildingCount: number
    deployedCount: number
    failedCount: number
  }
  recentAssignments: DashboardAssignment[]
  recentSubmissions: DashboardSubmission[]
}

type SessionEnvelope = {
  data: {
    user: {
      id: string
      name: string
      email: string
      role?: string
    }
    session: {
      id: string
    }
  }
}

type AssignmentEnvelope = {
  data: AssignmentRecord
}

type DashboardOverviewEnvelope = {
  data: DashboardOverview
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"

class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null
}

const extractMessage = (payload: unknown): string | null => {
  if (!isRecord(payload)) {
    return null
  }

  const message = payload.message
  if (typeof message === "string") {
    return message
  }

  const error = payload.error
  if (isRecord(error) && typeof error.message === "string") {
    return error.message
  }

  return null
}

const resolveUrl = (path: string): string => {
  return new URL(path, apiBaseUrl).toString()
}

const parseJsonPayload = (rawPayload: string): unknown => {
  if (rawPayload.length === 0) {
    return null
  }

  try {
    return JSON.parse(rawPayload) as unknown
  } catch {
    return null
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(resolveUrl(path), {
    ...init,
    credentials: "include",
    headers
  })

  const textPayload = await response.text()
  const payload = parseJsonPayload(textPayload)

  if (!response.ok) {
    const errorMessage = extractMessage(payload) ?? `${response.status} ${response.statusText}`
    throw new ApiError(response.status, errorMessage)
  }

  return payload as T
}

const toRole = (roleValue: string | undefined): UserRole => {
  return roleValue === "employer" ? "employer" : "candidate"
}

export const authApi = {
  signUpWithEmail: async (input: {
    name: string
    email: string
    password: string
    role: UserRole
  }): Promise<void> => {
    await request<unknown>("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify(input)
    })
  },
  signInWithEmail: async (input: { email: string; password: string }): Promise<void> => {
    await request<unknown>("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify(input)
    })
  },
  signOut: async (): Promise<void> => {
    await request<unknown>("/api/auth/sign-out", {
      method: "POST"
    })
  },
  getSession: async (): Promise<SessionState> => {
    const payload = await request<SessionEnvelope>("/api/session/me")

    return {
      user: {
        id: payload.data.user.id,
        name: payload.data.user.name,
        email: payload.data.user.email,
        role: toRole(payload.data.user.role)
      },
      sessionId: payload.data.session.id
    }
  }
}

export const assignmentApi = {
  create: async (input: CreateAssignmentInput): Promise<AssignmentRecord> => {
    const payload = await request<AssignmentEnvelope>("/api/assignments", {
      method: "POST",
      body: JSON.stringify(input)
    })

    return payload.data
  }
}

export const dashboardApi = {
  getOverview: async (input?: {
    assignmentsLimit?: number
    submissionsLimit?: number
  }): Promise<DashboardOverview> => {
    const query = new URLSearchParams()

    if (typeof input?.assignmentsLimit === "number") {
      query.set("assignmentsLimit", String(input.assignmentsLimit))
    }

    if (typeof input?.submissionsLimit === "number") {
      query.set("submissionsLimit", String(input.submissionsLimit))
    }

    const queryString = query.toString()
    const path =
      queryString.length > 0 ? `/api/dashboard/overview?${queryString}` : "/api/dashboard/overview"
    const payload = await request<DashboardOverviewEnvelope>(path)
    return payload.data
  }
}

export const isUnauthorizedError = (error: unknown): boolean => {
  return error instanceof ApiError && error.status === 401
}

export const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  return "Unexpected error. Please try again."
}
