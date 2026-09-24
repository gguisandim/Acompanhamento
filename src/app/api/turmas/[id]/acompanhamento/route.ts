import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canEditClass } from "@/lib/access";
import { getClassroom } from "@/lib/data";
import { db } from "@/lib/db";

const BodySchema = z.object({
  changes: z.array(
    z.object({
      studentId: z.string().uuid(),
      module: z.number().int().min(1).max(6),
      slot: z.number().int().min(1).max(6),
      status: z.enum(["P", "F", "NA"]).nullable()
    })
  ).max(2000),
  finalWork: z.array(
    z.object({
      studentId: z.string().uuid(),
      delivered: z.boolean().nullable()
    })
  ).max(100)
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

  const studentIds = Array.from(
    new Set([
      ...parsed.data.changes.map((item) => item.studentId),
      ...parsed.data.finalWork.map((item) => item.studentId)
    ])
  );

  const sql = db();
  if (studentIds.length) {
    const validStudents = await sql`
      SELECT id FROM students
      WHERE classroom_id = ${id} AND id IN ${sql(studentIds)}
    `;
    if (validStudents.length !== studentIds.length) {
      return NextResponse.json({ error: "Há cursistas que não pertencem à turma." }, { status: 400 });
    }
  }

  await sql.begin(async (tx) => {
    const toUpsert = parsed.data.changes
      .filter((item) => item.status !== null)
      .map((item) => ({
        student_id: item.studentId,
        module: item.module,
        slot: item.slot,
        status: item.status
      }));

    const toDelete = parsed.data.changes.filter((item) => item.status === null);

    if (toUpsert.length) {
      await tx`
        INSERT INTO attendance ${tx(toUpsert, "student_id", "module", "slot", "status")}
        ON CONFLICT (student_id, module, slot)
        DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
      `;
    }

    for (const item of toDelete) {
      await tx`
        DELETE FROM attendance
        WHERE student_id = ${item.studentId}
          AND module = ${item.module}
          AND slot = ${item.slot}
      `;
    }

    for (const item of parsed.data.finalWork) {
      await tx`
        UPDATE students
        SET final_work_delivered = ${item.delivered},
            final_work_updated_at = NOW(),
            final_work_updated_by = ${user.id},
            updated_at = NOW()
        WHERE id = ${item.studentId} AND classroom_id = ${id}
      `;
    }
  });

  return NextResponse.json({ ok: true });
}
