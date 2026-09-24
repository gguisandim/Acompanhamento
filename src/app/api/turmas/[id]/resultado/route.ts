import { NextResponse } from "next/server";
import { z } from "zod";
import { canEditClass } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getClassroom } from "@/lib/data";
import { db } from "@/lib/db";

const FinalStatusSchema = z.enum([
  "IN_PROGRESS",
  "READY_FOR_CERTIFICATION",
  "INSUFFICIENT_ATTENDANCE",
  "FINAL_WORK_PENDING",
  "NOT_COMPLETED",
  "PENDING_REVIEW"
]);

const BodySchema = z.object({
  students: z.array(z.object({
    studentId: z.string().uuid(),
    finalStatus: FinalStatusSchema.nullable(),
    observations: z.string().trim().max(2000).nullable()
  })).max(100),
  classNotes: z.string().trim().max(10000).nullable()
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
    return NextResponse.json({ error: "Dados do resultado final inválidos." }, { status: 400 });
  }

  const ids = Array.from(new Set(parsed.data.students.map((item) => item.studentId)));
  if (ids.length !== parsed.data.students.length) {
    return NextResponse.json({ error: "Há cursistas duplicados na solicitação." }, { status: 400 });
  }

  const sql = db();
  if (ids.length) {
    const valid = await sql`SELECT id FROM students WHERE classroom_id = ${id} AND id IN ${sql(ids)}`;
    if (valid.length !== ids.length) {
      return NextResponse.json({ error: "Há cursistas que não pertencem à turma." }, { status: 400 });
    }
  }

  await sql.begin(async (tx) => {
    for (const item of parsed.data.students) {
      await tx`
        UPDATE students
        SET final_status = ${item.finalStatus},
            final_observations = ${item.observations || null},
            final_review_updated_at = NOW(),
            final_review_updated_by = ${user.id},
            updated_at = NOW()
        WHERE id = ${item.studentId} AND classroom_id = ${id}
      `;
    }

    await tx`
      UPDATE classrooms
      SET final_notes = ${parsed.data.classNotes || null},
          final_notes_updated_at = NOW(),
          final_notes_updated_by = ${user.id},
          updated_at = NOW()
      WHERE id = ${id}
    `;
  });

  return NextResponse.json({ ok: true });
}
