import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";
import { db } from "./db";
import type { CurrentUser, Role } from "./types";

const COOKIE_NAME = "acompanhamento_session";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET deve ter pelo menos 32 caracteres.");
  }
  return new TextEncoder().encode(value);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, secret());
    const userId = verified.payload.sub;
    if (!userId) return null;

    const sql = db();
    const [row] = await sql`
      SELECT u.id, u.name, u.email, u.role, u.state_id, u.classroom_id,
             u.avatar_url, u.active,
             s.code AS state_code, s.name AS state_name,
             c.name AS classroom_name
      FROM users u
      LEFT JOIN states s ON s.id = u.state_id
      LEFT JOIN classrooms c ON c.id = u.classroom_id
      WHERE u.id = ${userId} AND u.active = TRUE
      LIMIT 1
    `;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as Role,
      stateId: row.state_id,
      classroomId: row.classroom_id,
      stateCode: row.state_code,
      stateName: row.state_name,
      classroomName: row.classroom_name,
      avatarUrl: row.avatar_url,
      active: Boolean(row.active)
    };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
