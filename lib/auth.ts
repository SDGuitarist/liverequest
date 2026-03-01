import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { requireEnv } from '@/lib/env'

const SECRET = new TextEncoder().encode(requireEnv('COOKIE_SECRET'))
const SESSION_DURATION = 24 * 60 * 60 // 24 hours in seconds

export async function signSessionCookie(): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION * 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(SECRET)
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const auth = cookieStore.get('performer_auth')
  if (!auth) return false

  try {
    await jwtVerify(auth.value, SECRET, { algorithms: ['HS256'] })
    return true
  } catch {
    return false
  }
}
