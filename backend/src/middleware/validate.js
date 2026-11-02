import ApiError from '../utils/ApiError.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Tiny declarative body validator — avoids an extra dependency.
// Rules: { field: { required, type, min, max, pattern, email, enum } }
export function validateBody(rules) {
  return (req, res, next) => {
    const body = req.body || {}
    const errors = []

    for (const [field, rule] of Object.entries(rules)) {
      const value = body[field]

      if (value === undefined || value === null || value === '') {
        if (rule.required) errors.push(`${field} is required`)
        continue
      }

      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push(`${field} must be a string`)
        continue
      }
      if (rule.type === 'number' && typeof value !== 'number') {
        errors.push(`${field} must be a number`)
        continue
      }
      if (rule.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${field} must be a boolean`)
        continue
      }

      if (typeof value === 'string') {
        if (rule.min && value.length < rule.min) {
          errors.push(`${field} must be at least ${rule.min} characters`)
        }
        if (rule.max && value.length > rule.max) {
          errors.push(`${field} must be at most ${rule.max} characters`)
        }
        if (rule.email && !EMAIL_PATTERN.test(value)) {
          errors.push(`${field} must be a valid email`)
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${field} is invalid`)
        }
      }

      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rule.enum.join(', ')}`)
      }
    }

    if (errors.length) return next(ApiError.badRequest('Validation failed', errors))
    next()
  }
}

export default validateBody
