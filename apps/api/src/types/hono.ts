import type { AuthSession, AuthUser } from '../lib/auth.js'

export type AppBindings = {
  Variables: {
    session: AuthSession['session'] | null
    user: AuthUser | null
  }
}
