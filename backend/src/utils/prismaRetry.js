// Prisma loads to-one relations (e.g. transaction.user) in a SECOND query
// after the main rows. Under concurrent deletes (test-fixture cleanup, direct
// DB operations) the relation can come back null mid-read and the whole call
// fails with "Inconsistent query result". Production never deletes users that
// have transactions (admin deletion policy), so this only fires under
// concurrency — one retry re-runs both queries after the delete committed.
export async function retryOnInconsistentResult(fn) {
  try {
    return await fn()
  } catch (error) {
    const inconsistent =
      error?.name === 'PrismaClientUnknownRequestError' &&
      String(error.message).includes('Inconsistent query result')
    if (inconsistent) return fn()
    throw error
  }
}