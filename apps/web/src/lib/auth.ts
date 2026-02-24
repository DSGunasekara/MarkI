import { queryOptions } from "@tanstack/react-query"

import { authApi, isUnauthorizedError, type SessionState } from "@/lib/api"

export const sessionQueryOptions = queryOptions({
  queryKey: ["session"],
  queryFn: async (): Promise<SessionState | null> => {
    try {
      return await authApi.getSession()
    } catch (error) {
      if (isUnauthorizedError(error)) {
        return null
      }
      throw error
    }
  },
  staleTime: 5 * 60 * 1000,
})

export const getDefaultPathForRole = (role: string): string => {
  return role === "employer" ? "/employer/dashboard" : "/candidate/dashboard"
}
