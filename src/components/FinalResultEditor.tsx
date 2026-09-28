"use client";

import { useMemo, useState } from "react";
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
  finalReviewJustification: string | null;
  finalWorkUpdatedAt: string | null;
  finalReviewUpdatedAt: string | null;
  finalReviewUpdatedByName: string | null;
  lastAttendanceUpdatedAt: string | null;
  attendance: Record<string, AttendanceStatus>;
};

type DirtyEntry = { work?: true; review?: true };

const statuses = Object.keys(FINAL_STATUS_LABELS) as FinalStatus[];

function isAfter(value: string | null, reference: string | null) {
  if (!value || !reference) return false;
  return new Date(value).getTime() > new Date(reference).getTime();
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

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
  const [finalWork, setFinalWork] = useState<Record<string, "" | "true" | "false">>(() =>
    Object.fromEntries(students.map((student) => [
      student.id,
      student.finalWorkDelivered === null ? "" : student.finalWorkDelivered ? "true" : "false"
    ]))
  );
  const [observations, setObservations] = useState<Record<string, string>>(() =>
    Object.fromEntries(students.map((student) => [student.id, student.finalObservations ?? ""]))
  );
  const [justifications, setJustifications] = useState<Record<string, string>>(() =>
    Object.fromEntries(students.map((student) => [student.id, student.finalReviewJustification ?? ""]))
  );
  const [classNotes, setClassNotes] = useState(initialClassNotes ?? "");
  const [dirty, setDirty] = useState<Record<string, DirtyEntry>>({});
  const [classNotesDirty, setClassNotesDirty] = useState(false);
  const [freshAfterSave, setFreshAfterSave] = useState<Record<string, true>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const metricsByStudent = useMemo(() => Object.fromEntries(students.map((student) => {
    const values = MODULES.flatMap((module) =>
      SLOTS.map((slot) => student.attendance[`${module}-${slot}`] ?? null)
    );
    return [student.id, { values, metrics: attendanceMetrics(values, MODULES.length * SLOTS.length) }];
  })), [students]);

  function markDirty(studentId: string, type: keyof DirtyEntry) {
    setDirty((current) => ({ ...current, [studentId]: { ...current[studentId], [type]: true } }));
    setMessage("");
  }

  function workValue(studentId: string) {
    return finalWork[studentId] === "" ? null : finalWork[studentId] === "true";
  }

  function stale(student: Student) {
    if (!student.finalStatus || !student.finalReviewUpdatedAt) return false;
    if (dirty[student.id]?.work) return true;
    if (freshAfterSave[student.id]) return false;
    return isAfter(student.lastAttendanceUpdatedAt, student.finalReviewUpdatedAt)
      || isAfter(student.finalWorkUpdatedAt, student.finalReviewUpdatedAt);
  }

  async function save() {
    if (!canEdit || saving) return;

    const changedStudents = students.filter((student) => dirty[student.id]?.work || dirty[student.id]?.review);
    if (!changedStudents.length && !classNotesDirty) {
      setMessage("Nenhuma alteração para salvar.");
      return;
    }

    for (const student of changedStudents) {
      if (!dirty[student.id]?.review) continue;
      const suggested = suggestFinalStatus(metricsByStudent[student.id].values, workValue(student.id));
      const selected = manual[student.id] || null;
      if (selected && selected !== suggested && !justifications[student.id]?.trim()) {
        setMessage(`Informe a justificativa da revisão de ${student.name}, pois a situação confirmada diverge da sugestão.`);
        return;
      }
    }

    setSaving(true);
    setMessage("");

    const response = await fetch(`/api/turmas/${classroomId}/resultado`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        students: changedStudents.map((student) => ({
          studentId: student.id,
          finalWorkDelivered: workValue(student.id),
          finalStatus: manual[student.id] || null,
          observations: observations[student.id]?.trim() || null,
          justification: justifications[student.id]?.trim() || null,
          finalWorkChanged: Boolean(dirty[student.id]?.work),
          reviewChanged: Boolean(dirty[student.id]?.review)
        })),
        classNotes: classNotesDirty ? (classNotes.trim() || null) : undefined
      })
    });

    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error ?? "Não foi possível salvar.");
      return;
    }

    const reviewed = changedStudents.filter((student) => dirty[student.id]?.review).map((student) => student.id);
    if (reviewed.length) {
      setFreshAfterSave((current) => ({ ...current, ...Object.fromEntries(reviewed.map((id) => [id, true])) }));
    }
    setDirty({});
    setClassNotesDirty(false);
    setMessage("Resultado final salvo.");
  }

  return (
    <section>
      <div className="result-help alert">
        A frequência e o trabalho final subsidiam a situação sugerida. A situação final pode ser revisada e confirmada por um responsável autorizado.
      </div>

      <div className="table-wrap">
        <table className="result-table final-review-table">
          <thead>
            <tr>
              <th>Nº</th><th>Cursista</th><th>Município</th><th>Frequência geral</th>
              <th>Progresso geral</th><th>Trabalho final</th><th>Sugestão</th>
              <th>Situação confirmada</th><th>Revisão</th><th>Justificativa</th><th>Observações</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const { values, metrics } = metricsByStudent[student.id];
              const currentWork = workValue(student.id);
              const suggested = suggestFinalStatus(values, currentWork);
              const chosen = manual[student.id] || null;
              const effective = effectiveFinalStatus(chosen, suggested);
              const diverges = Boolean(chosen && chosen !== suggested);
              const outdated = stale(student);

              return (
                <tr key={student.id}>
                  <td>{student.position}</td>
                  <td><strong>{student.name}</strong></td>
                  <td>{student.municipality || "—"}</td>
                  <td>{percentLabel(metrics.frequency)}</td>
                  <td>{percentLabel(metrics.progress)}</td>
                  <td>
                    <select
                      className="work-select"
                      value={finalWork[student.id]}
                      disabled={!canEdit}
                      onChange={(event) => {
                        setFinalWork((current) => ({ ...current, [student.id]: event.target.value as "" | "true" | "false" }));
                        markDirty(student.id, "work");
                      }}
                    >
                      <option value="">Pendente</option>
                      <option value="true">Entregou</option>
                      <option value="false">Não entregou</option>
                    </select>
                  </td>
                  <td><span className="status info">{FINAL_STATUS_LABELS[suggested]}</span></td>
                  <td>
                    <select
                      className="status-select"
                      value={manual[student.id]}
                      disabled={!canEdit}
                      title={`Situação exibida: ${FINAL_STATUS_LABELS[effective]}`}
                      onChange={(event) => {
                        setManual((current) => ({ ...current, [student.id]: event.target.value as FinalStatus | "" }));
                        markDirty(student.id, "review");
                      }}
                    >
                      <option value="">Usar sugestão</option>
                      {statuses.map((status) => <option key={status} value={status}>{FINAL_STATUS_LABELS[status]}</option>)}
                    </select>
                  </td>
                  <td>
                    {outdated ? <span className="status warn review-badge">Revisão desatualizada</span> : chosen && student.finalReviewUpdatedAt ? <span className="status ok review-badge">Revisado</span> : <span className="status muted-status review-badge">Não confirmado</span>}
                    <small className="review-meta">
                      {chosen && student.finalReviewUpdatedAt ? `${formatDate(student.finalReviewUpdatedAt)}${student.finalReviewUpdatedByName ? ` · ${student.finalReviewUpdatedByName}` : ""}` : "Sem situação final confirmada"}
                    </small>
                  </td>
                  <td>
                    <textarea
                      className="justification-input"
                      rows={2}
                      maxLength={1500}
                      disabled={!canEdit || !diverges}
                      placeholder={diverges ? "Obrigatória quando a decisão diverge da sugestão" : "Não necessária"}
                      value={justifications[student.id]}
                      onChange={(event) => {
                        setJustifications((current) => ({ ...current, [student.id]: event.target.value }));
                        markDirty(student.id, "review");
                      }}
                    />
                  </td>
                  <td>
                    <textarea
                      className="observation-input"
                      rows={2}
                      maxLength={2000}
                      disabled={!canEdit}
                      value={observations[student.id]}
                      onChange={(event) => {
                        setObservations((current) => ({ ...current, [student.id]: event.target.value }));
                        markDirty(student.id, "review");
                      }}
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
        <textarea
          id="class-final-notes"
          rows={6}
          maxLength={10000}
          disabled={!canEdit}
          value={classNotes}
          onChange={(event) => {
            setClassNotes(event.target.value);
            setClassNotesDirty(true);
            setMessage("");
          }}
        />
        <p className="muted">A situação sugerida é calculada; a situação confirmada só muda por revisão humana. Alterações posteriores em presença ou trabalho final sinalizam a revisão como desatualizada.</p>
      </div>

      {canEdit ? (
        <div className="save-bar">
          <span className="save-message">{message}</span>
          <button className="button button-primary" type="button" disabled={saving || (!Object.keys(dirty).length && !classNotesDirty)} onClick={save}>
            {saving ? "Salvando..." : "Salvar revisão final"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
