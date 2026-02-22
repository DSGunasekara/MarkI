import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import "dotenv/config";

import * as schema from './schema.js'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required to initialize the database client.')
}

const queryClient = postgres(connectionString, {
  max: 1
})

export const db = drizzle(queryClient, {
  schema
})

export { queryClient }
