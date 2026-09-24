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

function normalizeIdentity(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
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
  const existing = await sql`
    SELECT id, position, name, municipality
    FROM students
    WHERE classroom_id = ${id}
    ORDER BY position
  `;

  const importedKeys = new Map<string, number>();
  const conflicts: string[] = [];
  for (const item of imported) {
    const key = `${normalizeIdentity(item.name)}|${normalizeIdentity(item.municipality ?? "")}`;
    if (importedKeys.has(key)) conflicts.push(`Linhas ${importedKeys.get(key)} e ${item.position}: cursista duplicado (${item.name}).`);
    importedKeys.set(key, item.position);
  }

  const matchByItem = new Map<number, (typeof existing)[number]>();
  const matchedIds = new Set<string>();
  for (const item of imported) {
    const sameName = existing.filter((student) => normalizeIdentity(String(student.name)) === normalizeIdentity(item.name));
    let match = sameName.length === 1 ? sameName[0] : undefined;
    if (sameName.length > 1) {
      const sameMunicipality = sameName.filter((student) =>
        normalizeIdentity(student.municipality == null ? "" : String(student.municipality)) === normalizeIdentity(item.municipality ?? "")
      );
      if (sameMunicipality.length === 1) match = sameMunicipality[0];
      else conflicts.push(`Linha ${item.position}: há mais de um cadastro compatível com ${item.name}; revise o município.`);
    }
    if (match) {
      const matchId = String(match.id);
      if (matchedIds.has(matchId)) conflicts.push(`Linha ${item.position}: ${item.name} corresponde a um cursista já associado nesta importação.`);
      matchedIds.add(matchId);
      matchByItem.set(item.position, match);
    }
  }

  const occupiedPositions = new Map(
    existing.map((student) => [Number(student.position), String(student.name)])
  );
  for (const item of imported) {
    if (!matchByItem.has(item.position) && occupiedPositions.has(item.position)) {
      conflicts.push(`Linha ${item.position}: a posição já pertence a ${occupiedPositions.get(item.position)}. Nenhum cadastro foi substituído.`);
    }
  }

  if (conflicts.length) {
    return NextResponse.json({
      error: "A importação foi bloqueada para preservar o acompanhamento existente.",
      conflicts
    }, { status: 409 });
  }

  const resultSheet = workbook.getWorksheet("2 - Resultado Final");
  const noteParts: string[] = [];
  if (resultSheet) {
    for (let row = 40; row <= 45; row++) {
      const value = text(resultSheet.getCell(row, 1).value);
      if (value && !/anota[cç][oõ]es/i.test(value)) noteParts.push(value);
    }
  }
  const importedNotes = noteParts.join("\n").trim() || null;

  let inserted = 0;
  let updated = 0;
  let attendanceUpserted = 0;
  await sql.begin(async (tx) => {
    for (const item of imported) {
      const matched = matchByItem.get(item.position);
      let studentId: string;
      if (matched) {
        studentId = String(matched.id);
        if (item.finalWork === null) {
          await tx`UPDATE students SET name = ${item.name}, municipality = ${item.municipality}, updated_at = NOW() WHERE id = ${studentId} AND classroom_id = ${id}`;
        } else {
          await tx`
            UPDATE students
            SET name = ${item.name}, municipality = ${item.municipality},
                final_work_delivered = ${item.finalWork}, final_work_updated_at = NOW(),
                final_work_updated_by = ${user.id}, updated_at = NOW()
            WHERE id = ${studentId} AND classroom_id = ${id}
          `;
        }
        updated += 1;
      } else {
        const [student] = await tx`
          INSERT INTO students (
            classroom_id, position, name, municipality, final_work_delivered,
            final_work_updated_at, final_work_updated_by
          )
          VALUES (
            ${id}, ${item.position}, ${item.name}, ${item.municipality}, ${item.finalWork},
            ${item.finalWork === null ? null : new Date()}, ${item.finalWork === null ? null : user.id}
          )
          RETURNING id
        `;
        studentId = String(student.id);
        inserted += 1;
      }

      if (item.attendance.length) {
        const rows = item.attendance.map((attendance) => ({
          student_id: studentId,
          module: attendance.module,
          slot: attendance.slot,
          status: attendance.status
        }));
        await tx`
          INSERT INTO attendance ${tx(rows, "student_id", "module", "slot", "status")}
          ON CONFLICT (student_id, module, slot)
          DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
        `;
        attendanceUpserted += rows.length;
      }
    }

    if (importedNotes) {
      await tx`
        UPDATE classrooms
        SET final_notes = ${importedNotes}, final_notes_updated_at = NOW(),
            final_notes_updated_by = ${user.id}, updated_at = NOW()
        WHERE id = ${id}
      `;
    }
  });

  return NextResponse.json({
    ok: true,
    students: imported.length,
    inserted,
    updated,
    attendanceUpserted,
    preservedStudents: existing.length - matchedIds.size
  });
}
