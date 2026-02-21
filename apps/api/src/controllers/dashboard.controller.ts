import type { Context } from 'hono'

import { dashboardService } from '../services/dashboard.service.js'
import type { AppBindings } from '../types/hono.js'

type DashboardContext = Context<AppBindings>

type DashboardOverviewQuery = {
  assignmentsLimit?: number
  submissionsLimit?: number
}

export const dashboardController = {
  overview: async (c: DashboardContext, query: DashboardOverviewQuery) => {
    const user = c.get('user')

    if (!user) {
      return c.json(
        {
          message: 'Authentication required.'
        },
        401
      )
    }

    const dashboardData = await dashboardService.getEmployerOverview(user.id, {
      assignmentsLimit: query.assignmentsLimit,
      submissionsLimit: query.submissionsLimit
    })

    return c.json({
      data: dashboardData
    })
  }
}
