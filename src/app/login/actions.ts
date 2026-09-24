"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?erro=Informe%20e-mail%20e%20senha.");
  }

  const sql = db();
  const [user] = await sql`
    SELECT id, password_hash
    FROM users
    WHERE email = ${email} AND active = TRUE
    LIMIT 1
  `;

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    redirect("/login?erro=E-mail%20ou%20senha%20inv%C3%A1lidos.");
  }

  await sql`
    UPDATE users
    SET last_login_at = NOW(), updated_at = NOW()
    WHERE id = ${user.id}
  `;
  await createSession(user.id);
  redirect("/dashboard");
}
