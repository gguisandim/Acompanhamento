import { NextResponse } from "next/server";
import { z } from "zod";
import { canEditClass } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getClassroom } from "@/lib/data";
import { db } from "@/lib/db";

const BodySchema = z.object({
  changes: z.array(z.object({
    studentId: z.string().uuid(),
    module: z.number().int().min(1).max(6),
    slot: z.number().int().min(1).max(6),
    status: z.enum(["P", "F", "NA"]).nullable()
  })).max(1080)
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  const classroom = await getClassroom(id);
  if (!classroom) return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });
  if (!canEditClass(user, classroom)) {
    return NextResponse.json({ error: "Sem permissão para editar esta turma." }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados de acompanhamento inválidos." }, { status: 400 });
  }

  const uniqueChanges = new Map<string, (typeof parsed.data.changes)[number]>();
  for (const item of parsed.data.changes) {
    uniqueChanges.set(`${item.studentId}:${item.module}:${item.slot}`, item);
  }
  const changes = Array.from(uniqueChanges.values());

  if (!changes.length) return NextResponse.json({ ok: true, changed: 0 });

  const studentIds = Array.from(new Set(changes.map((item) => item.studentId)));
  const sql = db();
  const validStudents = await sql`
    SELECT id FROM students
    WHERE classroom_id = ${id} AND id IN ${sql(studentIds)}
  `;
  if (validStudents.length !== studentIds.length) {
    return NextResponse.json({ error: "Há cursistas que não pertencem à turma." }, { status: 400 });
  }

  await sql.begin(async (tx) => {
    const toUpsert = changes
      .filter((item) => item.status !== null)
      .map((item) => ({
        student_id: item.studentId,
        module: item.module,
        slot: item.slot,
        status: item.status
      }));

    const toDelete = changes
      .filter((item) => item.status === null)
      .map((item) => ({
        student_id: item.studentId,
        module: item.module,
        slot: item.slot
      }));

    if (toUpsert.length) {
      await tx`
        INSERT INTO attendance ${tx(toUpsert, "student_id", "module", "slot", "status")}
        ON CONFLICT (student_id, module, slot)
        DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
      `;
    }

    if (toDelete.length) {
      const deleteJson = JSON.stringify(toDelete);
      await tx`
        DELETE FROM attendance a
        USING jsonb_to_recordset(${deleteJson}::jsonb)
          AS d(student_id uuid, module int, slot int)
        WHERE a.student_id = d.student_id
          AND a.module = d.module
          AND a.slot = d.slot
      `;
    }
  });

  return NextResponse.json({ ok: true, changed: changes.length });
}
