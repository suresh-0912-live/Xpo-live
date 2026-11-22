// CORS middleware tests — node:test, no extra dependencies.
// Sets CORS_ORIGIN before importing the app so the env module reads it.

process.env.CORS_ORIGIN =
  'http://localhost:5173,http://localhost:5174,https://xpo-live.vercel.app'
process.env.NODE_ENV = 'test'

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

const { default: app } = await import('../src/app.js')

let server
let base = ''

before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
})

async function request(path, { method = 'GET', origin, headers = {} } = {}) {
  const fetchHeaders = { ...headers }
  if (origin) fetchHeaders.origin = origin
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: fetchHeaders,
  })
  return {
    status: response.status,
    headers: response.headers,
    data: await response.json().catch(() => null),
  }
}

// ------------------------------------------------------------------ allowed --

test('CORS allows the production Vercel origin', async () => {
  const { status, headers } = await request('/auth/register', {
    method: 'OPTIONS',
    origin: 'https://xpo-live.vercel.app',
    headers: {
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type, authorization',
    },
  })
  assert.equal(status, 204)
  assert.equal(
    headers.get('access-control-allow-origin'),
    'https://xpo-live.vercel.app',
  )
  assert.ok(headers.get('access-control-allow-methods'), 'allow methods set')
})

test('CORS allows localhost development origin', async () => {
  const { status, headers } = await request('/auth/login', {
    method: 'OPTIONS',
    origin: 'http://localhost:5173',
    headers: {
      'access-control-request-method': 'POST',
    },
  })
  assert.equal(status, 204)
  assert.equal(headers.get('access-control-allow-origin'), 'http://localhost:5173')
})

// ------------------------------------------------------------------- denied --

test('CORS rejects a disallowed origin', async () => {
  const { status, headers, data } = await request('/auth/register', {
    method: 'POST',
    origin: 'https://evil.example.com',
    headers: { 'content-type': 'application/json' },
    body: {
      email: 'cors-test@example.com',
      password: 'password123',
      securityQuestion: 'Q?',
      securityAnswer: 'A',
    },
  })
  assert.equal(status, 403)
  assert.equal(data.error, 'Origin not allowed: https://evil.example.com')
  // No CORS headers must be echoed for a disallowed origin.
  assert.equal(headers.get('access-control-allow-origin'), null)
})

// ------------------------------------------------------------------ preflight --

test('OPTIONS preflight returns 204 with CORS headers for allowed origin', async () => {
  const { status, headers } = await request('/auth/register', {
    method: 'OPTIONS',
    origin: 'https://xpo-live.vercel.app',
    headers: {
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type, authorization',
    },
  })
  assert.equal(status, 204)
  assert.equal(
    headers.get('access-control-allow-origin'),
    'https://xpo-live.vercel.app',
  )
  const methods = headers.get('access-control-allow-methods') || ''
  assert.ok(methods.includes('POST'), 'POST allowed in preflight')
  const allowedHeaders = headers.get('access-control-allow-headers') || ''
  assert.ok(
    allowedHeaders.includes('content-type') || allowedHeaders.includes('*'),
    'content-type allowed in preflight',
  )
})

test('OPTIONS preflight is rejected for disallowed origin', async () => {
  const { status, headers } = await request('/auth/register', {
    method: 'OPTIONS',
    origin: 'https://evil.example.com',
    headers: {
      'access-control-request-method': 'POST',
    },
  })
  // CORS middleware rejects before reaching routes; no CORS headers set.
  assert.equal(status, 403)
  assert.equal(headers.get('access-control-allow-origin'), null)
})

// ------------------------------------------------------ vercel preview origin --

test('CORS allows a Vercel preview deployment origin (*.vercel.app)', async () => {
  const { status, headers } = await request('/auth/login', {
    method: 'OPTIONS',
    origin: 'https://xpo-live-pr-123.vercel.app',
    headers: {
      'access-control-request-method': 'POST',
    },
  })
  assert.equal(status, 204)
  assert.equal(
    headers.get('access-control-allow-origin'),
    'https://xpo-live-pr-123.vercel.app',
  )
})

test('CORS rejects non-vercel.app subdomains that look similar', async () => {
  const { status, headers } = await request('/auth/login', {
    method: 'OPTIONS',
    origin: 'https://evil-vercel.app.evil.com',
    headers: {
      'access-control-request-method': 'POST',
    },
  })
  assert.equal(status, 403)
  assert.equal(headers.get('access-control-allow-origin'), null)
})
