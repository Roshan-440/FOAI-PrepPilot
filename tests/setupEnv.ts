import 'dotenv/config'
import { assertSafeTestDatabase } from './guard'

// Runs before every test file, before any application module reads process.env.
assertSafeTestDatabase(process.env.TEST_DATABASE_URL)
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
