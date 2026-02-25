import { useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"

import { authApi } from "@/lib/api"
import { sessionQueryOptions } from "@/lib/auth"

export function useSignOut() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return async () => {
    await authApi.signOut()
    queryClient.setQueryData(sessionQueryOptions.queryKey, null)
    await navigate({ to: "/" })
  }
}
