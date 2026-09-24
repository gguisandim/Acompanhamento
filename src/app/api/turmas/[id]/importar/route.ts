import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canImportRoster } from "@/lib/access";
import { getClassroom } from "@/lib/data";
import { db } from "@/lib/db";
import type { AttendanceStatus } from "@/lib/types";

function text(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String(value.text ?? "").trim();
  if (typeof value === "object" && "result" in value) return String(value.result ?? "").trim();
  return String(value).trim();
}

function normalizePresence(value: string): AttendanceStatus | null {
  const normalized = value.trim().toUpperCase().replaceAll(" ", "");
  if (normalized === "P") return "P";
  if (normalized === "F") return "F";
  if (normalized === "N/A" || normalized === "NA") return "NA";
  return null;
}

function normalizeFinalWork(value: string): boolean | null {
  const normalized = value.trim().toUpperCase();
  if (["SIM", "S", "X", "ENTREGOU"].includes(normalized)) return true;
  if (["NÃO", "NAO", "N", "NÃO ENTREGOU", "NAO ENTREGOU"].includes(normalized)) return false;
  return null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await context.params;
  const classroom = await getClassroom(id);
  if (!classroom) return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });
  if (!canImportRoster(user, classroom)) {
    return NextResponse.json({ error: "Sem permissão para importar nesta turma." }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Envie um arquivo .xlsx válido." }, { status: 400 });
  }

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Arquivo muito grande. Limite: 8 MB." }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  const bytes = await file.arrayBuffer();
  await workbook.xlsx.load(bytes);

  const sheet = workbook.getWorksheet("1 - Acompanhamento") ?? workbook.worksheets[0];
  if (!sheet) {
    return NextResponse.json({ error: "A planilha não possui abas legíveis." }, { status: 400 });
  }

  const imported: Array<{
    position: number;
    name: string;
    municipality: string | null;
    finalWork: boolean | null;
    attendance: Array<{ module: number; slot: number; status: AttendanceStatus }>;
  }> = [];

  for (let rowNumber = 8; rowNumber <= 37; rowNumber++) {
    const name = text(sheet.getCell(rowNumber, 2).value);
    if (!name) continue;

    const municipality = text(sheet.getCell(rowNumber, 3).value) || null;
    const attendance: Array<{ module: number; slot: number; status: AttendanceStatus }> = [];

    for (let module = 1; module <= 6; module++) {
      for (let slot = 1; slot <= 6; slot++) {
        const column = 4 + (module - 1) * 6 + (slot - 1);
        const status = normalizePresence(text(sheet.getCell(rowNumber, column).value));
        if (status) attendance.push({ module, slot, status });
      }
    }

    imported.push({
      position: rowNumber - 7,
      name,
      municipality,
      finalWork: normalizeFinalWork(text(sheet.getCell(rowNumber, 40).value)),
      attendance
    });
  }

  if (imported.length === 0) {
    return NextResponse.json(
      { error: "Nenhum cursista encontrado nas linhas 8 a 37 da aba de acompanhamento." },
      { status: 400 }
    );
  }

  const sql = db();
  await sql.begin(async (tx) => {
    await tx`DELETE FROM students WHERE classroom_id = ${id}`;

    for (const item of imported) {
      const [student] = await tx`
        INSERT INTO students (classroom_id, position, name, municipality, final_work_delivered)
        VALUES (${id}, ${item.position}, ${item.name}, ${item.municipality}, ${item.finalWork})
        RETURNING id
      `;

      if (item.attendance.length) {
        const rows = item.attendance.map((attendance) => ({
          student_id: student.id,
          module: attendance.module,
          slot: attendance.slot,
          status: attendance.status
        }));
        await tx`
          INSERT INTO attendance ${tx(rows, "student_id", "module", "slot", "status")}
        `;
      }
    }
  });

  return NextResponse.json({ ok: true, students: imported.length });
}
