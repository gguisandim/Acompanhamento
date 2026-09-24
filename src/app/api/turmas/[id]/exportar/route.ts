import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { canAccessClass } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getClassroom, getClassroomStudents } from "@/lib/data";
import { MODULES, SLOTS, attendanceMetrics, effectiveFinalStatus, suggestFinalStatus } from "@/lib/progress";
import { FINAL_STATUS_LABELS, type AttendanceStatus } from "@/lib/types";

const templatePath = path.join(process.cwd(), "assets", "Modelo_Planilhas_de_Acompanhamento_2026-compat.xlsx");

function percentText(value: number | null) {
  return value === null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });
  const { id } = await context.params;
  const classroom = await getClassroom(id);
  if (!classroom) return new Response("Turma não encontrada.", { status: 404 });
  if (!canAccessClass(user, classroom)) return new Response("Sem permissão.", { status: 403 });

  const students = await getClassroomStudents(id);
  const byPosition = new Map(students.map((student) => [student.position, student]));
  const workbook = new ExcelJS.Workbook();
  const template = await readFile(templatePath);
  // ExcelJS expects Node's Buffer at runtime; its bundled type targets an older Buffer shape.
  await workbook.xlsx.load(template as never);
  workbook.creator = "Acompanhamento 2026";
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const tracking = workbook.getWorksheet("1 - Acompanhamento");
  const result = workbook.getWorksheet("2 - Resultado Final");
  if (!tracking || !result) return new Response("Template de exportação inválido.", { status: 500 });

  tracking.getCell("C3").value = classroom.name;
  tracking.getCell("I3").value = classroom.state_code;
  for (let position = 1; position <= 30; position++) {
    const row = position + 7;
    const student = byPosition.get(position);
    tracking.getCell(row, 1).value = position;
    tracking.getCell(row, 2).value = student?.name ?? "";
    tracking.getCell(row, 3).value = student?.municipality ?? "";
    const statuses: Array<AttendanceStatus | null> = [];
    for (const module of MODULES) {
      for (const slot of SLOTS) {
        const status = student?.attendance[`${module}-${slot}`] ?? null;
        statuses.push(status);
        tracking.getCell(row, 4 + (module - 1) * 6 + slot - 1).value = status === "NA" ? "N/A" : status ?? "";
      }
    }
    tracking.getCell(row, 40).value = !student || student.finalWorkDelivered === null ? "" : student.finalWorkDelivered ? "SIM" : "NÃO";
    const metrics = attendanceMetrics(statuses, 36);
    tracking.getCell(row, 41).value = metrics.frequency === null ? "" : metrics.frequency / 100;
    tracking.getCell(row, 41).numFmt = "0.0%";
    tracking.getCell(row, 42).value = metrics.frequency === null ? "SEM DADOS" : metrics.frequency < 75 ? "FREQUÊNCIA < 75%" : "EM ACOMPANHAMENTO";
  }

  result.getCell("C3").value = classroom.name;
  result.getCell("I3").value = classroom.state_code;
  const resultHeaderStyle = { ...result.getCell("D6").style };
  for (const range of ["A6:A7", "B6:B7", "C6:C7", "D6:I6", "J6:K6", "L6:M6"]) {
    result.unMergeCells(range);
  }
  const headers = ["Nº", "CURSISTA", "MUNICÍPIO", "MÓD. 1\nFREQ. / PROGRESSO", "MÓD. 2\nFREQ. / PROGRESSO", "MÓD. 3\nFREQ. / PROGRESSO", "MÓD. 4\nFREQ. / PROGRESSO", "MÓD. 5\nFREQ. / PROGRESSO", "MÓD. 6\nFREQ. / PROGRESSO", "TRABALHO FINAL", "FREQUÊNCIA GERAL", "PROGRESSO GERAL", "SITUAÇÃO FINAL", "OBSERVAÇÕES"];
  headers.forEach((header, index) => {
    const cell = result.getCell(6, index + 1);
    cell.style = { ...resultHeaderStyle };
    cell.value = header;
    cell.alignment = { ...cell.alignment, horizontal: "center", vertical: "middle", wrapText: true };
    result.mergeCells(6, index + 1, 7, index + 1);
  });
  result.getColumn(14).width = 32;

  for (let position = 1; position <= 30; position++) {
    const row = position + 7;
    const student = byPosition.get(position);
    result.getCell(row, 1).value = position;
    result.getCell(row, 2).value = student?.name ?? "";
    result.getCell(row, 3).value = student?.municipality ?? "";
    const all: Array<AttendanceStatus | null> = [];
    for (const module of MODULES) {
      const values = SLOTS.map((slot) => student?.attendance[`${module}-${slot}`] ?? null);
      all.push(...values);
      const metrics = attendanceMetrics(values, 6);
      result.getCell(row, 3 + module).value = student ? `${percentText(metrics.frequency)} / ${percentText(metrics.progress)}` : "";
    }
    const overall = attendanceMetrics(all, 36);
    result.getCell(row, 10).value = !student || student.finalWorkDelivered === null ? "PENDENTE" : student.finalWorkDelivered ? "ENTREGOU" : "NÃO ENTREGOU";
    result.getCell(row, 11).value = student && overall.frequency !== null ? overall.frequency / 100 : "";
    result.getCell(row, 11).numFmt = "0.0%";
    result.getCell(row, 12).value = student ? overall.progress / 100 : "";
    result.getCell(row, 12).numFmt = "0.0%";
    result.getCell(row, 14).style = { ...result.getCell(row, 13).style };
    result.getCell(row, 14).alignment = { vertical: "top", wrapText: true };
    if (student) {
      const suggested = suggestFinalStatus(all, student.finalWorkDelivered);
      result.getCell(row, 13).value = FINAL_STATUS_LABELS[effectiveFinalStatus(student.finalStatus, suggested)].toUpperCase();
      result.getCell(row, 14).value = student.finalObservations ?? "";
    } else {
      result.getCell(row, 13).value = "";
      result.getCell(row, 14).value = "";
    }
  }
  if (classroom.finalNotes) result.getCell("A40").value = classroom.finalNotes;

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${classroom.name}-acompanhamento-2026.xlsx"`
    }
  });
}
