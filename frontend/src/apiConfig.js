/** Default backend for local `npm run dev` when no URL is stored yet. */
export const DEV_DEFAULT_API_BASE = 'http://localhost:3001'

/**
 * Encode a plain origin string for the login field (UTF-8 safe).
 * Use when generating the value you share with deployed users.
 */
export function encodeApiBaseForLogin(plainUrl) {
  const bytes = new TextEncoder().encode(String(plainUrl).trim())
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/** Base64 (UTF-8) of `DEV_DEFAULT_API_BASE` — default content of the dev login field. */
export const DEV_DEFAULT_API_BASE_B64 = encodeApiBaseForLogin(DEV_DEFAULT_API_BASE)

/**
 * Decode login paste (whitespace stripped) to the plain URL string before normalization.
 */
export function decodeApiBaseFromLogin(base64Input) {
  const t = String(base64Input ?? '').trim().replace(/\s/g, '')
  if (!t) throw new Error('API key is required')
  try {
    const binary = atob(t)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const decoded = new TextDecoder().decode(bytes).trim()
    if (!decoded) throw new Error('API key is empty')
    return decoded
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message === 'API key is required' || e.message === 'API key is empty')
    ) {
      throw e
    }
    throw new Error('Invalid API key')
  }
}

/**
 * Normalize decoded input to an origin string (no trailing slash, no path).
 */
export function normalizeApiBase(raw) {
  const t = String(raw ?? '').trim()
  if (!t) {
    throw new Error('API key is required')
  }
  let s = t.replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(s)) {
    const lower = s.toLowerCase()
    const isLocal =
      lower.startsWith('localhost') ||
      lower.startsWith('127.0.0.1') ||
      lower.startsWith('[::1]')
    s = `${isLocal ? 'http' : 'https'}://${s}`
  }
  let u
  try {
    u = new URL(s)
  } catch {
    throw new Error('Invalid API key')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Invalid API key')
  }
  return u.origin
}
