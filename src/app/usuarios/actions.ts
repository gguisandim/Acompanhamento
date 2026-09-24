"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/access";
import { db } from "@/lib/db";
import type { Role } from "@/lib/types";

const RoleSchema = z.enum(["PROFESSOR", "COORDENADOR_ESTADUAL", "COORDENADOR_GERAL", "ADMIN"]);
const UserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  role: RoleSchema,
  stateId: z.string().uuid().nullable(),
  classroomId: z.string().uuid().nullable()
});
const UpdateSchema = UserSchema.omit({ password: true }).extend({
  id: z.string().uuid(),
  active: z.boolean()
});

async function administrativeScope(
  role: Role,
  stateId: string | null,
  classroomId: string | null,
  excludedUserId?: string,
  active = true
) {
  const sql = db();
  if (role === "PROFESSOR") {
    if (!classroomId) throw new Error("Professor precisa de uma turma.");
    const [classroom] = await sql`SELECT state_id FROM classrooms WHERE id = ${classroomId}`;
    if (!classroom) throw new Error("Turma inválida.");
    if (active) {
      const [assigned] = await sql`
        SELECT id FROM users
        WHERE classroom_id = ${classroomId}
          AND role = 'PROFESSOR'
          AND active = TRUE
          AND (${excludedUserId ?? null}::uuid IS NULL OR id <> ${excludedUserId ?? null}::uuid)
        LIMIT 1
      `;
      if (assigned) throw new Error("Esta turma já possui professor ativo.");
    }
    return { stateId: String(classroom.state_id), classroomId };
  }
  if (role === "COORDENADOR_ESTADUAL") {
    if (!stateId) throw new Error("Coordenador estadual precisa de um estado.");
    const [state] = await sql`SELECT id FROM states WHERE id = ${stateId}`;
    if (!state) throw new Error("Estado inválido.");
    return { stateId, classroomId: null };
  }
  return { stateId: null, classroomId: null };
}

export async function createUserAction(formData: FormData) {
  const current = await requireUser();
  if (!canManageUsers(current)) throw new Error("Sem permissão.");

  const parsed = UserSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? ""),
    stateId: String(formData.get("stateId") ?? "") || null,
    classroomId: String(formData.get("classroomId") ?? "") || null
  });
  if (!parsed.success) throw new Error("Dados do usuário inválidos.");

  const scope = await administrativeScope(parsed.data.role, parsed.data.stateId, parsed.data.classroomId);
  const hash = await bcrypt.hash(parsed.data.password, 12);
  const sql = db();
  try {
    await sql`
      INSERT INTO users (name, email, password_hash, role, state_id, classroom_id, active, updated_at)
      VALUES (${parsed.data.name}, ${parsed.data.email}, ${hash}, ${parsed.data.role}, ${scope.stateId}, ${scope.classroomId}, TRUE, NOW())
    `;
  } catch (error) {
    if (error instanceof Error && /unique|duplicate/i.test(error.message)) throw new Error("E-mail ou turma já vinculados a outro usuário ativo.");
    throw error;
  }
  revalidatePath("/usuarios");
  revalidatePath("/dashboard");
}

export async function updateUserAction(input: z.input<typeof UpdateSchema>) {
  const current = await requireUser();
  if (!canManageUsers(current)) throw new Error("Sem permissão.");
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) throw new Error("Dados do usuário inválidos.");

  const sql = db();
  const [target] = await sql`SELECT id, role, active FROM users WHERE id = ${parsed.data.id}`;
  if (!target) throw new Error("Usuário não encontrado.");
  if (target.id === current.id && (!parsed.data.active || parsed.data.role !== current.role)) {
    throw new Error("Você não pode remover o próprio acesso administrativo.");
  }

  const scope = await administrativeScope(
    parsed.data.role,
    parsed.data.stateId,
    parsed.data.classroomId,
    parsed.data.id,
    parsed.data.active
  );
  try {
    await sql`
      UPDATE users
      SET name = ${parsed.data.name}, email = ${parsed.data.email}, role = ${parsed.data.role},
          state_id = ${scope.stateId}, classroom_id = ${scope.classroomId},
          active = ${parsed.data.active}, updated_at = NOW()
      WHERE id = ${parsed.data.id}
    `;
  } catch (error) {
    if (error instanceof Error && /unique|duplicate/i.test(error.message)) throw new Error("E-mail ou turma já vinculados a outro usuário ativo.");
    throw error;
  }
  revalidatePath("/usuarios");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function resetUserPasswordAction(input: { id: string; password: string }) {
  const current = await requireUser();
  if (!canManageUsers(current)) throw new Error("Sem permissão.");
  const parsed = z.object({ id: z.string().uuid(), password: z.string().min(8) }).safeParse(input);
  if (!parsed.success) throw new Error("A senha deve ter pelo menos 8 caracteres.");

  const hash = await bcrypt.hash(parsed.data.password, 12);
  const sql = db();
  const result = await sql`
    UPDATE users SET password_hash = ${hash}, updated_at = NOW()
    WHERE id = ${parsed.data.id}
    RETURNING id
  `;
  if (!result.length) throw new Error("Usuário não encontrado.");
  return { ok: true };
}
