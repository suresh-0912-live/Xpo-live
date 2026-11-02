// Lazy Prisma singleton so the server can boot (and report db:down) even
// before `prisma generate` / `prisma migrate` have been run.
let clientPromise = null

export function getPrisma() {
  if (!clientPromise) {
    clientPromise = import('@prisma/client')
      .then(async ({ PrismaClient }) => {
        const client = new PrismaClient()
        await client.$connect()
        return client
      })
      .catch((error) => {
        clientPromise = null
        throw error
      })
  }
  return clientPromise
}

export async function pingDatabase() {
  try {
    const prisma = await getPrisma()
    await prisma.$queryRaw`SELECT 1`
    return { status: 'up' }
  } catch (error) {
    return { status: 'down', error: error.message }
  }
}
