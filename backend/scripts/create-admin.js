// One-time admin creation script for Render production.
//
// Usage (Render shell or local with DATABASE_URL pointing to production):
//
//   ADMIN_EMAIL=wps.xpo@proton.me ADMIN_PASSWORD='<your-production-password>' \
//   DATABASE_URL=<render-production-database-url> \
//   node scripts/create-admin.js
//
// Safety properties:
//   - Only creates an Admin row when none exists for the given email.
//   - Never updates/overwrites an existing admin's password.
//   - Never prints the password or token to stdout.
//   - Exits non-zero if required env vars are missing or invalid.

import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    console.error('[create-admin] ADMIN_EMAIL and ADMIN_PASSWORD must be set.')
    process.exit(1)
  }

  if (password.length < 8) {
    console.error('[create-admin] ADMIN_PASSWORD must be at least 8 characters.')
    process.exit(1)
  }

  const normalizedEmail = email.toLowerCase().trim()

  const existing = await prisma.admin.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    console.log(`[create-admin] Admin already exists: ${normalizedEmail}. Password not touched.`)
    return
  }

  // Same hashing parameters as prisma/seed.js (10 salt rounds).
  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.admin.create({
    data: {
      email: normalizedEmail,
      password: passwordHash,
      name: 'Administrator',
      role: 'superadmin',
      status: 'active',
    },
  })

  console.log(`[create-admin] Admin created: ${normalizedEmail}`)
}

main()
  .catch((error) => {
    console.error('[create-admin] Failed:', error.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
