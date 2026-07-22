import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "spider_vip_session";
const ADMIN_COOKIE = "spider_vip_admin";

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is missing.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSession(attendeeId: string) {
  const token = await new SignJWT({ attendeeId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());

  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
}

export async function getSessionAttendeeId() {
  try {
    const token = cookies().get(COOKIE)?.value;
    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.attendeeId === "string" ? payload.attendeeId : null;
  } catch {
    return null;
  }
}

export function destroySession() {
  cookies().delete(COOKIE);
}

export async function createAdminSession() {
  const token = await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());

  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
}

export async function isAdminSession() {
  try {
    const token = cookies().get(ADMIN_COOKIE)?.value;
    if (!token) {
      return false;
    }

    const { payload } = await jwtVerify(token, getSecret());
    return payload.admin === true;
  } catch {
    return false;
  }
}

export function destroyAdminSession() {
  cookies().delete(ADMIN_COOKIE);
}
