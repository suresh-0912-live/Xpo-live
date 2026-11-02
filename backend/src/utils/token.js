import jwt from 'jsonwebtoken'
import env from '../config/env.js'

// Token payload shapes:
//   user:  { sub, type: 'user',  email }
//   admin: { sub, type: 'admin', email, role }

export function signToken(payload, { expiresIn = env.jwtExpiresIn } = {}) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn })
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret)
}

export function userTokenPayload(user) {
  return { sub: user.id, type: 'user', email: user.email, sessionVersion: user.sessionVersion ?? 0 }
}

export function adminTokenPayload(admin) {
  return { sub: admin.id, type: 'admin', email: admin.email, role: admin.role }
}
