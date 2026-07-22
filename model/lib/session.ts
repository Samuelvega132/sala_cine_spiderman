import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "spider_vip_session";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET);
export async function createSession(attendeeId: string) {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is missing.");
  const token = await new SignJWT({ attendeeId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("12h").sign(secret());
  cookies().set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 12, path: "/" });
}
export async function getSessionAttendeeId() {
  try { const token = cookies().get(COOKIE)?.value; if (!token) return null; const { payload } = await jwtVerify(token, secret()); return typeof payload.attendeeId === "string" ? payload.attendeeId : null; } catch { return null; }
}
