import { NextResponse } from "next/server";
import { z } from "zod";
import { canEditClass } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getClassroom } from "@/lib/data";
import { db } from "@/lib/db";
import { suggestFinalStatus } from "@/lib/progress";
import type { AttendanceStatus } from "@/lib/types";

const FinalStatusSchema = z.enum([
  "IN_PROGRESS",
  "READY_FOR_CERTIFICATION",
  "INSUFFICIENT_ATTENDANCE",
  "FINAL_WORK_PENDING",
  "NOT_COMPLETED",
  "PENDING_REVIEW"
]);

const StudentSchema = z.object({
  studentId: z.string().uuid(),
  finalWorkDelivered: z.boolean().nullable(),
  finalStatus: FinalStatusSchema.nullable(),
  observations: z.string().trim().max(2000).nullable(),
  justification: z.string().trim().max(1500).nullable(),
  finalWorkChanged: z.boolean(),
  reviewChanged: z.boolean()
});

const BodySchema = z.object({
  students: z.array(StudentSchema).max(100),
  classNotes: z.string().trim().max(10000).nullable().optional()
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

  const reviewItems = parsed.data.students.filter((item) => item.reviewChanged);
  const suggestedByStudent = new Map<string, string>();
  if (reviewItems.length) {
    const reviewIds = reviewItems.map((item) => item.studentId);
    const attendanceRows = await sql`
      SELECT student_id, module, slot, status
      FROM attendance
      WHERE student_id IN ${sql(reviewIds)}
    `;
    const statuses = new Map<string, Array<AttendanceStatus | null>>();
    for (const item of reviewItems) statuses.set(item.studentId, Array(36).fill(null));
    for (const row of attendanceRows) {
      const index = (Number(row.module) - 1) * 6 + (Number(row.slot) - 1);
      const current = statuses.get(String(row.student_id));
      if (current) current[index] = row.status as AttendanceStatus;
    }

    for (const item of reviewItems) {
      const suggested = suggestFinalStatus(statuses.get(item.studentId) ?? [], item.finalWorkDelivered);
      suggestedByStudent.set(item.studentId, suggested);
      if (item.finalStatus && item.finalStatus !== suggested && !item.justification?.trim()) {
        return NextResponse.json({
          error: "Quando a situação confirmada diverge da sugestão, informe uma justificativa."
        }, { status: 400 });
      }
    }
  }

  await sql.begin(async (tx) => {
    const workItems = parsed.data.students
      .filter((item) => item.finalWorkChanged)
      .map((item) => ({ student_id: item.studentId, delivered: item.finalWorkDelivered }));

    if (workItems.length) {
      const workJson = JSON.stringify(workItems);
      await tx`
        UPDATE students st
        SET final_work_delivered = x.delivered,
            final_work_updated_at = NOW(),
            final_work_updated_by = ${user.id},
            updated_at = NOW()
        FROM jsonb_to_recordset(${workJson}::jsonb)
          AS x(student_id uuid, delivered boolean)
        WHERE st.id = x.student_id AND st.classroom_id = ${id}
      `;
    }

    const reviews = parsed.data.students
      .filter((item) => item.reviewChanged)
      .map((item) => ({
        student_id: item.studentId,
        final_status: item.finalStatus,
        observations: item.observations,
        justification: item.finalStatus && item.finalStatus !== suggestedByStudent.get(item.studentId)
          ? item.justification
          : null
      }));

    if (reviews.length) {
      const reviewJson = JSON.stringify(reviews);
      await tx`
        UPDATE students st
        SET final_status = x.final_status,
            final_observations = x.observations,
            final_review_justification = x.justification,
            final_review_updated_at = NOW(),
            final_review_updated_by = ${user.id},
            updated_at = NOW()
        FROM jsonb_to_recordset(${reviewJson}::jsonb)
          AS x(student_id uuid, final_status text, observations text, justification text)
        WHERE st.id = x.student_id AND st.classroom_id = ${id}
      `;
    }

    if (Object.prototype.hasOwnProperty.call(parsed.data, "classNotes")) {
      await tx`
        UPDATE classrooms
        SET final_notes = ${parsed.data.classNotes ?? null},
            final_notes_updated_at = NOW(),
            final_notes_updated_by = ${user.id},
            updated_at = NOW()
        WHERE id = ${id}
      `;
    }
  });

  return NextResponse.json({ ok: true });
}
