import type { Context } from 'hono'

import type { AppBindings } from '../types/hono.js'

type SessionContext = Context<AppBindings>

export const sessionController = {
  me: (c: SessionContext) => {
    const user = c.get('user')
    const session = c.get('session')

    if (!user || !session) {
      return c.json(
        {
          message: 'Authentication required.'
        },
        401
      )
    }

    return c.json({
      data: {
        user,
        session
      }
    })
  }
}
