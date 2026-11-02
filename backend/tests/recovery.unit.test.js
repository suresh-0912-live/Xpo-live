// Pure recovery helpers only: this test never opens a database connection or
// changes xpo_dev records.
process.env.NODE_ENV = 'test'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSecurityAnswer } from '../src/controllers/authController.js'
import { generateTemporaryPassword } from '../src/services/notification.service.js'

test('security answers normalize case, unicode form, and whitespace', () => {
  assert.equal(normalizeSecurityAnswer('  CAFÉ   ROAD  '), 'café road')
  assert.equal(normalizeSecurityAnswer('Ａnswer'), 'answer')
})

test('temporary passwords have exactly five mixed character characters', () => {
  for (let count = 0; count < 100; count += 1) {
    const password = generateTemporaryPassword()
    assert.equal(password.length, 5)
    assert.match(password, /[A-Za-z]/)
    assert.match(password, /[0-9]/)
    assert.match(password, /[!@#$%*?]/)
  }
})
