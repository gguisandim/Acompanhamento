import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import { canAccessClass } from "@/lib/access";
import { getClassroom, getClassroomStudents } from "@/lib/data";
import {
  MODULES,
  SLOTS,
  attendanceFrequency,
  certificationResult,
  moduleResult
} from "@/lib/progress";
import type { AttendanceStatus } from "@/lib/types";

const titleFill = "1F4E78";
const headerFill = "D9EAF7";
const accentFill = "EAF3E2";

function setBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: "FFB8C2CC" } },
    left: { style: "thin", color: { argb: "FFB8C2CC" } },
    bottom: { style: "thin", color: { argb: "FFB8C2CC" } },
    right: { style: "thin", color: { argb: "FFB8C2CC" } }
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });

  const { id } = await context.params;
  const classroom = await getClassroom(id);
  if (!classroom) return new Response("Turma não encontrada.", { status: 404 });
  if (!canAccessClass(user, classroom)) return new Response("Sem permissão.", { status: 403 });

  const students = await getClassroomStudents(id);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Acompanhamento 2026";
  workbook.created = new Date();

  const tracking = workbook.addWorksheet("1 - Acompanhamento", {
    views: [{ state: "frozen", ySplit: 7, xSplit: 3 }]
  });

  tracking.mergeCells("A1:AP1");
  tracking.getCell("A1").value = "CURSO 2026 — PLANILHA DE ACOMPANHAMENTO DE CURSISTAS";
  tracking.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14 };
  tracking.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${titleFill}` } };
  tracking.getCell("A1").alignment = { horizontal: "center" };

  tracking.getCell("A2").value = "CURSO";
  tracking.getCell("C2").value = "Curso 2026";
  tracking.getCell("N2").value = "FORMADOR(A)";
  tracking.getCell("Q2").value = "Conforme cadastro da plataforma";
  tracking.getCell("A3").value = "TURMA";
  tracking.getCell("C3").value = classroom.name;
  tracking.getCell("G3").value = "ESTADO";
  tracking.getCell("I3").value = classroom.state_code;
  tracking.getCell("N3").value = "PERÍODO";
  tracking.getCell("Q3").value = "2026";

  const firstHeader = ["Nº", "CURSISTA", "MUNICÍPIO"];
  for (const value of firstHeader) tracking.getRow(6).getCell(firstHeader.indexOf(value) + 1).value = value;

  let col = 4;
  for (const module of MODULES) {
    for (const _slot of SLOTS) tracking.getRow(6).getCell(col++).value = `MÓDULO ${module}`;
  }
  tracking.getRow(6).getCell(40).value = "TRABALHO FINAL";
  tracking.getRow(6).getCell(41).value = "FREQUÊNCIA";
  tracking.getRow(6).getCell(42).value = "SITUAÇÃO";

  for (let c = 4; c <= 39; c++) tracking.getRow(7).getCell(c).value = ((c - 4) % 6) + 1;
  tracking.getRow(7).getCell(40).value = "SIM/NÃO";
  tracking.getRow(7).getCell(41).value = "FREQUÊNCIA";
  tracking.getRow(7).getCell(42).value = "SITUAÇÃO";

  for (let row = 6; row <= 7; row++) {
    for (let c = 1; c <= 42; c++) {
      const cell = tracking.getRow(row).getCell(c);
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${headerFill}` } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      setBorder(cell);
    }
  }

  for (let index = 0; index < 30; index++) {
    const rowNumber = 8 + index;
    const student = students.find((item) => item.position === index + 1);
    tracking.getCell(rowNumber, 1).value = index + 1;

    if (student) {
      tracking.getCell(rowNumber, 2).value = student.name;
      tracking.getCell(rowNumber, 3).value = student.municipality ?? "";

      const statuses: Array<AttendanceStatus | null> = [];
      let currentCol = 4;
      for (const module of MODULES) {
        for (const slot of SLOTS) {
          const status = student.attendance[`${module}-${slot}`] ?? null;
          statuses.push(status);
          tracking.getCell(rowNumber, currentCol++).value = status === "NA" ? "N/A" : status ?? "";
        }
      }

      tracking.getCell(rowNumber, 40).value =
        student.finalWorkDelivered === null ? "" : student.finalWorkDelivered ? "SIM" : "NÃO";
      const frequency = attendanceFrequency(statuses);
      tracking.getCell(rowNumber, 41).value = frequency ?? "";
      tracking.getCell(rowNumber, 41).numFmt = "0%";
      tracking.getCell(rowNumber, 42).value =
        frequency === null ? "" : frequency >= 0.75 ? "APTO" : "ABAIXO DE 75%";
    }

    for (let c = 1; c <= 42; c++) {
      const cell = tracking.getCell(rowNumber, c);
      setBorder(cell);
      cell.alignment = { vertical: "middle", horizontal: c >= 4 ? "center" : "left" };
    }
  }

  tracking.getColumn(1).width = 6;
  tracking.getColumn(2).width = 28;
  tracking.getColumn(3).width = 20;
  for (let c = 4; c <= 39; c++) tracking.getColumn(c).width = 9;
  tracking.getColumn(40).width = 14;
  tracking.getColumn(41).width = 12;
  tracking.getColumn(42).width = 18;

  const result = workbook.addWorksheet("2 - Resultado Final", {
    views: [{ state: "frozen", ySplit: 7 }]
  });
  result.mergeCells("A1:M1");
  result.getCell("A1").value = "CURSO 2026 — PLANILHA DE RESULTADO FINAL";
  result.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 14 };
  result.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${titleFill}` } };
  result.getCell("A1").alignment = { horizontal: "center" };

  result.getCell("A3").value = "TURMA";
  result.getCell("C3").value = classroom.name;
  result.getCell("G3").value = "ESTADO";
  result.getCell("I3").value = classroom.state_code;

  const headers = [
    "Nº", "CURSISTA", "MUNICÍPIO",
    "MÓD. 1", "MÓD. 2", "MÓD. 3", "MÓD. 4", "MÓD. 5", "MÓD. 6",
    "TRABALHO FINAL", "FREQUÊNCIA GERAL", "CERTIFICAR", "OBS."
  ];
  headers.forEach((header, index) => {
    const cell = result.getCell(6, index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${accentFill}` } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    setBorder(cell);
  });

  students.forEach((student, index) => {
    const row = 7 + index;
    result.getCell(row, 1).value = student.position;
    result.getCell(row, 2).value = student.name;
    result.getCell(row, 3).value = student.municipality ?? "";

    const all: Array<AttendanceStatus | null> = [];
    for (const module of MODULES) {
      const statuses = SLOTS.map(
        (slot) => student.attendance[`${module}-${slot}`] ?? null
      ) as Array<AttendanceStatus | null>;
      all.push(...statuses);
      result.getCell(row, 3 + module).value = moduleResult(statuses) ?? "";
    }

    const frequency = attendanceFrequency(all);
    const certified = certificationResult(all, student.finalWorkDelivered);
    result.getCell(row, 10).value =
      student.finalWorkDelivered === null ? "" : student.finalWorkDelivered ? "SIM" : "NÃO";
    result.getCell(row, 11).value = frequency ?? "";
    result.getCell(row, 11).numFmt = "0%";
    result.getCell(row, 12).value = certified === null ? "" : certified ? "SIM" : "NÃO";
    result.getCell(row, 13).value = "";

    for (let c = 1; c <= 13; c++) {
      const cell = result.getCell(row, c);
      setBorder(cell);
      cell.alignment = { vertical: "middle", horizontal: c >= 4 ? "center" : "left", wrapText: true };
    }
  });

  result.getColumn(1).width = 6;
  result.getColumn(2).width = 28;
  result.getColumn(3).width = 20;
  for (let c = 4; c <= 9; c++) result.getColumn(c).width = 18;
  result.getColumn(10).width = 16;
  result.getColumn(11).width = 16;
  result.getColumn(12).width = 14;
  result.getColumn(13).width = 22;

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${classroom.name}-acompanhamento-2026.xlsx"`
    }
  });
}
