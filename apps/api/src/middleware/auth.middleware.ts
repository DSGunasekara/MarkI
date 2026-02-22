import type { UserRole } from '@hiring-engine/db'
import { userRoleEnum } from '@hiring-engine/db'
import { HTTPException } from 'hono/http-exception'
import { createMiddleware } from 'hono/factory'

import { auth } from '../lib/auth.js'
import type { AppBindings } from '../types/hono.js'

const userRoleSet = new Set<UserRole>(userRoleEnum.enumValues)

const isUserRole = (value: unknown): value is UserRole => {
  if (typeof value !== 'string') {
    return false
  }

  return userRoleSet.has(value as UserRole)
}

/**
 * Resolves the Better-Auth session once per request and stores it in Hono context.
 *
 * Downstream handlers can safely read `c.get('session')` and `c.get('user')`
 * without re-parsing cookies or repeating auth API calls.
 */
export const authSessionMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  let sessionPayload: Awaited<ReturnType<typeof auth.api.getSession>> = null
  try {
    sessionPayload = await auth.api.getSession({
      headers: c.req.raw.headers
    })
  } catch {
    sessionPayload = null
  }

  if (!sessionPayload) {
    c.set('session', null)
    c.set('user', null)
    await next()
    return
  }

  c.set('session', sessionPayload.session)
  c.set('user', sessionPayload.user)
  await next()
})

export const requireAuth = createMiddleware<AppBindings>(async (c, next) => {
  const user = c.get('user')

  if (!user) {
    throw new HTTPException(401, {
      message: 'Authentication required.'
    })
  }

  await next()
})

export const requireRole = (allowedRoles: readonly UserRole[]) => {
  return createMiddleware<AppBindings>(async (c, next) => {
    const user = c.get('user')

    if (!user) {
      throw new HTTPException(401, {
        message: 'Authentication required.'
      })
    }

    const roleValue = user.role
    if (!isUserRole(roleValue)) {
      throw new HTTPException(403, {
        message: 'Account role is invalid.'
      })
    }

    if (!allowedRoles.includes(roleValue)) {
      throw new HTTPException(403, {
        message: 'Insufficient role permissions.'
      })
    }

    await next()
  })
}
