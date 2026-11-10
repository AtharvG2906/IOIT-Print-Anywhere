import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import argon2 from "argon2";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hmacSha256Hex, randomToken } from "@/lib/crypto";

const SESSION_COOKIE = "pa_session";
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours without activity
const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000; // hard cap per login
const TOUCH_EVERY_MS = 60 * 1000;

export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id });
export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password).catch(() => false);

const tokenHash = (token: string) => hmacSha256Hex(env.sessionSecret(), `session:${token}`);

/**
 * Creates a session and sets a browser-session cookie (no Max-Age), so closing
 * the browser logs the student out. Call only from a Server Action or Route Handler.
 */
export async function createSession(userId: string) {
  const token = randomToken();
  await db.session.create({
    data: { userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + ABSOLUTE_TIMEOUT_MS) },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  jar.delete(SESSION_COOKIE);
}

export function isAdminUser(user: { role: string; email: string }) {
  return user.role === "ADMIN" || env.adminEmails().includes(user.email.toLowerCase());
}

/** The logged-in user for this request, or null. Deduplicated per request. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() < now || session.lastSeenAt.getTime() < now - IDLE_TIMEOUT_MS || session.user.blocked) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (now - session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } }).catch(() => {});
  }

  const u = session.user;
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    prn: u.prn,
    phone: u.phone,
    department: u.department,
    academicYear: u.academicYear,
    className: u.className,
    batch: u.batch,
    hasCollegeId: Boolean(u.collegeIdKey),
    isAdmin: isAdminUser(u),
  };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** For pages: redirects to login if nobody is logged in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Where a logged-in person's "home" is: the desk for admins, the dashboard for students. */
export const homePathFor = (user: { isAdmin: boolean }) => (user.isAdmin ? "/admin" : "/dashboard");

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}
