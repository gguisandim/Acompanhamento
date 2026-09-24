"use client";

import { useState } from "react";
import {
  MODULES,
  SLOTS,
  attendanceMetrics,
  effectiveFinalStatus,
  percentLabel,
  suggestFinalStatus
} from "@/lib/progress";
import { FINAL_STATUS_LABELS, type AttendanceStatus, type FinalStatus } from "@/lib/types";

type Student = {
  id: string;
  position: number;
  name: string;
  municipality: string | null;
  finalWorkDelivered: boolean | null;
  finalStatus: FinalStatus | null;
  finalObservations: string | null;
  attendance: Record<string, AttendanceStatus>;
};

const statuses = Object.keys(FINAL_STATUS_LABELS) as FinalStatus[];

export default function FinalResultEditor({
  classroomId,
  students,
  initialClassNotes,
  canEdit
}: {
  classroomId: string;
  students: Student[];
  initialClassNotes: string | null;
  canEdit: boolean;
}) {
  const [manual, setManual] = useState<Record<string, FinalStatus | "">>(() =>
    Object.fromEntries(students.map((student) => [student.id, student.finalStatus ?? ""]))
  );
  const [observations, setObservations] = useState<Record<string, string>>(() =>
    Object.fromEntries(students.map((student) => [student.id, student.finalObservations ?? ""]))
  );
  const [classNotes, setClassNotes] = useState(initialClassNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/turmas/${classroomId}/resultado`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        students: students.map((student) => ({
          studentId: student.id,
          finalStatus: manual[student.id] || null,
          observations: observations[student.id]?.trim() || null
        })),
        classNotes: classNotes.trim() || null
      })
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(response.ok ? "Resultado final salvo." : data.error ?? "Não foi possível salvar.");
  }

  return (
    <section>
      <div className="table-wrap">
        <table className="result-table final-review-table">
          <thead>
            <tr>
              <th>Nº</th><th>Cursista</th><th>Município</th><th>Frequência geral</th>
              <th>Progresso geral</th><th>Trabalho final</th><th>Sugestão</th>
              <th>Situação confirmada</th><th>Observações</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const values = MODULES.flatMap((module) =>
                SLOTS.map((slot) => student.attendance[`${module}-${slot}`] ?? null)
              );
              const metrics = attendanceMetrics(values, MODULES.length * SLOTS.length);
              const suggested = suggestFinalStatus(values, student.finalWorkDelivered);
              const chosen = manual[student.id] || null;
              const effective = effectiveFinalStatus(chosen, suggested);
              return (
                <tr key={student.id}>
                  <td>{student.position}</td>
                  <td><strong>{student.name}</strong></td>
                  <td>{student.municipality || "—"}</td>
                  <td>{percentLabel(metrics.frequency)}</td>
                  <td>{percentLabel(metrics.progress)}</td>
                  <td>{student.finalWorkDelivered === null ? "Pendente" : student.finalWorkDelivered ? "Entregou" : "Não entregou"}</td>
                  <td><span className="status info">{FINAL_STATUS_LABELS[suggested]}</span></td>
                  <td>
                    <select
                      className="status-select"
                      value={manual[student.id]}
                      disabled={!canEdit}
                      title={`Situação exibida: ${FINAL_STATUS_LABELS[effective]}`}
                      onChange={(event) => setManual((current) => ({
                        ...current,
                        [student.id]: event.target.value as FinalStatus | ""
                      }))}
                    >
                      <option value="">Usar sugestão</option>
                      {statuses.map((status) => <option key={status} value={status}>{FINAL_STATUS_LABELS[status]}</option>)}
                    </select>
                  </td>
                  <td>
                    <textarea
                      className="observation-input"
                      rows={2}
                      maxLength={2000}
                      disabled={!canEdit}
                      value={observations[student.id]}
                      onChange={(event) => setObservations((current) => ({ ...current, [student.id]: event.target.value }))}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="final-notes-card">
        <label htmlFor="class-final-notes"><strong>Anotações da turma / resultado final</strong></label>
        <textarea id="class-final-notes" rows={6} maxLength={10000} disabled={!canEdit} value={classNotes} onChange={(event) => setClassNotes(event.target.value)} />
        <p className="muted">A situação sugerida é calculada; a situação confirmada só muda por revisão humana.</p>
      </div>

      {canEdit ? (
        <div className="save-bar">
          <span className="save-message">{message}</span>
          <button className="button button-primary" type="button" disabled={saving} onClick={save}>
            {saving ? "Salvando..." : "Salvar revisão final"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
