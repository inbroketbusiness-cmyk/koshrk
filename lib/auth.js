import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'ritikomal_session';
const JWT_SECRET = process.env.JWT_SECRET;

// MySQL version used PHP's server-side $_SESSION. Next.js API routes are
// stateless across requests, so we sign the user id into a JWT and store
// it in an httpOnly cookie instead — same effect, no server session store.
export function createSessionCookie(userId) {
  const token = jwt.sign({ uid: String(userId) }, JWT_SECRET, { expiresIn: '30d' });
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

// Returns the logged-in user's id (string) or null.
export function getSessionUserId() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.uid;
  } catch {
    return null;
  }
}
