"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const NameSchema = z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres.").max(120);
const PasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres."),
  confirmation: z.string()
}).refine((data) => data.newPassword === data.confirmation, {
  message: "A confirmação da nova senha não confere.",
  path: ["confirmation"]
});

export type ProfileActionResult = { ok: boolean; message: string };

export async function updateProfileAction(name: string): Promise<ProfileActionResult> {
  const user = await requireUser();
  const parsed = NameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Nome inválido." };

  const sql = db();
  await sql`
    UPDATE users
    SET name = ${parsed.data}, updated_at = NOW()
    WHERE id = ${user.id} AND active = TRUE
  `;
  revalidatePath("/perfil");
  revalidatePath("/dashboard");
  return { ok: true, message: "Perfil atualizado." };
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
}): Promise<ProfileActionResult> {
  const user = await requireUser();
  const parsed = PasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Senhas inválidas." };
  }

  const sql = db();
  const [account] = await sql`SELECT password_hash FROM users WHERE id = ${user.id} AND active = TRUE`;
  if (!account || !(await bcrypt.compare(parsed.data.currentPassword, account.password_hash))) {
    return { ok: false, message: "A senha atual está incorreta." };
  }

  const hash = await bcrypt.hash(parsed.data.newPassword, 12);
  await sql`UPDATE users SET password_hash = ${hash}, updated_at = NOW() WHERE id = ${user.id}`;
  return { ok: true, message: "Senha alterada com segurança." };
}
