const { execSync } = require('child_process')

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' })
}

try {
  // Always generate Prisma client
  run('npx prisma generate')

  // Conditionally run migrations + seed only when a DB URL is available
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    console.log('\nDATABASE_URL detected -> running migrations and seed...')
    try {
      run('npx prisma migrate deploy')
    } catch (err) {
      console.error('Migration failed:', err?.message || err)
      console.log('Attempting to continue build without migrations...')
      // Don't exit - allow build to continue even if migrations fail
      // This handles cases where migrations are already applied
    }
    try {
      run('npx prisma db seed')
    } catch (err) {
      console.warn('Seeding failed, continuing build. Ensure DATABASE_URL is correct.\n', err?.message || err)
    }
  } else {
    console.log('\nNo DATABASE_URL found -> skipping migrations and seed. Build will succeed, but data-dependent features will be empty until DB is configured.')
  }

  // Build Next.js app
  run('next build')
} catch (err) {
  console.error(err)
  process.exit(1)
}


