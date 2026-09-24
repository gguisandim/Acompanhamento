import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { canAccessClass } from "@/lib/access";
import { getClassroom, getClassroomStudents } from "@/lib/data";
import { MODULES, SLOTS, attendanceFrequency, certificationResult, moduleResult, percentLabel } from "@/lib/progress";
import type { AttendanceStatus } from "@/lib/types";

export default async function ResultPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const classroom = await getClassroom(id);
  if (!classroom) notFound();
  if (!canAccessClass(user, classroom)) redirect("/dashboard");

  const students = await getClassroomStudents(id);

  return (
    <AppShell user={user}>
      <header className="page-header">
        <div>
          <p className="eyebrow">{classroom.state_name} · {classroom.name}</p>
          <h1>Resultado final</h1>
          <p className="muted">Consolidação automática a partir das presenças e do trabalho final.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" href={`/turmas/${id}`}>Voltar ao acompanhamento</Link>
          <a className="button button-primary" href={`/api/turmas/${id}/exportar`}>Exportar Excel</a>
        </div>
      </header>

      <div className="table-wrap">
        <table className="result-table">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Cursista</th>
              <th>Município</th>
              {MODULES.map((module) => <th key={module}>Mód. {module}</th>)}
              <th>Frequência geral</th>
              <th>Trabalho final</th>
              <th>Certificar</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const allStatuses = MODULES.flatMap((module) =>
                SLOTS.map((slot) => student.attendance[`${module}-${slot}`] ?? null)
              ) as Array<AttendanceStatus | null>;
              const overall = attendanceFrequency(allStatuses);
              const certified = certificationResult(allStatuses, student.finalWorkDelivered);

              return (
                <tr key={student.id}>
                  <td>{student.position}</td>
                  <td><strong>{student.name}</strong></td>
                  <td>{student.municipality || "—"}</td>
                  {MODULES.map((module) => {
                    const statuses = SLOTS.map(
                      (slot) => student.attendance[`${module}-${slot}`] ?? null
                    ) as Array<AttendanceStatus | null>;
                    const result = moduleResult(statuses);
                    return (
                      <td key={module}>
                        <span className={result === "APROVADO" ? "status ok" : result ? "status warn" : "status"}>
                          {result === "APROVADO" ? "Aprovado" : result === "ABAIXO DE 75%" ? "< 75%" : "—"}
                        </span>
                      </td>
                    );
                  })}
                  <td>{percentLabel(overall)}</td>
                  <td>
                    {student.finalWorkDelivered === null
                      ? "Pendente"
                      : student.finalWorkDelivered
                        ? "Entregou"
                        : "Não entregou"}
                  </td>
                  <td>
                    <span className={certified === true ? "status ok" : certified === false ? "status warn" : "status"}>
                      {certified === null ? "Pendente" : certified ? "SIM" : "NÃO"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
