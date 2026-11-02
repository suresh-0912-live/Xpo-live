// User-initiated WhatsApp support links. This module only formats values the
// current user already has and never includes secrets, tokens, passwords, or
// bank details. `wa.me` opens a draft; WhatsApp still requires the user to
// review and press Send.

export const XPO_ADMIN_WHATSAPP = '919306037772'

function line(label, value) {
  return value === undefined || value === null || value === '' ? null : `${label}: ${value}`
}

function formatDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString('en-IN')
}

export function whatsappLink(lines) {
  return `https://wa.me/${XPO_ADMIN_WHATSAPP}?text=${encodeURIComponent(lines.filter(Boolean).join('\n'))}`
}

export function recoveryWhatsAppLink(email) {
  return whatsappLink([
    'XPO support request',
    line('Request type', 'Forgot password'),
    line('Email', email),
    line('Status', 'Submitted for admin review'),
    line('Submitted', formatDate(new Date())),
  ])
}

export function transactionWhatsAppLink({ user, transaction }) {
  const requestType = transaction.type === 'withdrawal' ? 'Withdrawal request' : 'Deposit request'
  return whatsappLink([
    'XPO support request',
    line('Name', user?.name),
    line('Email', user?.email),
    line('Request type', requestType),
    line('Request ID', transaction.reference || transaction.id),
    line('Amount', `₹${Number(transaction.amount).toFixed(2)}`),
    line('Status', transaction.status),
    line('Submitted', formatDate(transaction.createdAt)),
  ])
}

export function generalSupportWhatsAppLink(user) {
  return whatsappLink([
    'XPO support request',
    line('Name', user?.name),
    line('Email', user?.email),
    line('Request type', 'General support'),
  ])
}
