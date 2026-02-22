import type { NewAssignment } from '@hiring-engine/db'
import type { Context } from 'hono'

import { assignmentService } from '../services/assignment.service.js'
import type { AppBindings } from '../types/hono.js'

type AssignmentContext = Context<AppBindings>

export const assignmentController = {
  create: async (c: AssignmentContext, payload: NewAssignment) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          message: 'Authentication required.'
        },
        401
      )
    }

    const assignment = await assignmentService.createAssignment({
      title: payload.title,
      instructions: payload.instructions,
      employerId: user.id
    })

    return c.json(
      {
        data: assignment
      },
      201
    )
  }
}
