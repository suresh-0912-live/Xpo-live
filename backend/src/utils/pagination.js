// Clamp list query params: ?page=1&pageSize=25 (max 100).
export function getPagination(query, { defaultSize = 25, maxSize = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const pageSize = Math.min(
    maxSize,
    Math.max(1, Number.parseInt(query.pageSize, 10) || defaultSize),
  )
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}
