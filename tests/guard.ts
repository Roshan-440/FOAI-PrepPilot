/** The test suite truncates tables, so refuse to run against anything not clearly a test database. */
function databaseName(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, '')
  } catch {
    throw new Error('TEST_DATABASE_URL is not a valid URL.')
  }
}

export function assertSafeTestDatabase(url: string | undefined): asserts url is string {
  if (!url) throw new Error('TEST_DATABASE_URL is not set. See .env.example.')
  const name = databaseName(url)
  if (!/test/i.test(name)) {
    throw new Error(`Refusing to run tests: database "${name}" does not look like a test database (name must contain "test").`)
  }
}
