"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AttendanceStatus } from "@/lib/types";
import { MODULES, SLOTS, attendanceFrequency, percentLabel } from "@/lib/progress";

type Student = {
  id: string;
  position: number;
  name: string;
  municipality: string | null;
  finalWorkDelivered: boolean | null;
  attendance: Record<string, AttendanceStatus>;
};

function cellKey(studentId: string, module: number, slot: number) {
  return `${studentId}:${module}:${slot}`;
}

export default function AttendanceEditor({
  classroomId,
  students,
  canEdit
}: {
  classroomId: string;
  students: Student[];
  canEdit: boolean;
}) {
  const [module, setModule] = useState(1);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus | "">>(() => {
    const initial: Record<string, AttendanceStatus | ""> = {};
    for (const student of students) {
      for (const m of MODULES) {
        for (const slot of SLOTS) {
          initial[cellKey(student.id, m, slot)] = student.attendance[`${m}-${slot}`] ?? "";
        }
      }
    }
    return initial;
  });
  const [finalWork, setFinalWork] = useState<Record<string, "" | "true" | "false">>(() => {
    const initial: Record<string, "" | "true" | "false"> = {};
    for (const student of students) {
      initial[student.id] =
        student.finalWorkDelivered === null
          ? ""
          : student.finalWorkDelivered
            ? "true"
            : "false";
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const overallFrequency = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const student of students) {
      const statuses = MODULES.flatMap((m) =>
        SLOTS.map((slot) => attendance[cellKey(student.id, m, slot)] || null)
      ) as Array<AttendanceStatus | null>;
      result[student.id] = attendanceFrequency(statuses);
    }
    return result;
  }, [attendance, students]);

  function markSlot(slot: number, status: AttendanceStatus) {
    if (!canEdit) return;
    setAttendance((current) => {
      const next = { ...current };
      for (const student of students) {
        next[cellKey(student.id, module, slot)] = status;
      }
      return next;
    });
  }

  async function save() {
    if (!canEdit) return;
    setSaving(true);
    setMessage("");

    const changes = students.flatMap((student) =>
      MODULES.flatMap((m) =>
        SLOTS.map((slot) => ({
          studentId: student.id,
          module: m,
          slot,
          status: attendance[cellKey(student.id, m, slot)] || null
        }))
      )
    );

    const finalWorkPayload = students.map((student) => ({
      studentId: student.id,
      delivered:
        finalWork[student.id] === "" ? null : finalWork[student.id] === "true"
    }));

    const response = await fetch(`/api/turmas/${classroomId}/acompanhamento`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ changes, finalWork: finalWorkPayload })
    });

    const data = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(response.ok ? "Alterações salvas." : data.error ?? "Não foi possível salvar.");
  }

  if (students.length === 0) {
    return (
      <div className="empty-state">
        <h2>Turma sem cursistas</h2>
        <p>Importe a planilha da turma antes de iniciar o acompanhamento.</p>
      </div>
    );
  }

  return (
    <section>
      <div className="module-tabs" role="tablist" aria-label="Módulos">
        {MODULES.map((item) => (
          <button
            key={item}
            type="button"
            className={item === module ? "module-tab active" : "module-tab"}
            onClick={() => setModule(item)}
          >
            Módulo {item}
          </button>
        ))}
        <Link className="module-tab result-tab" href={`/turmas/${classroomId}/resultado`}>
          Resultado final
        </Link>
      </div>

      <div className="table-wrap">
        <table className="attendance-table">
          <thead>
            <tr>
              <th className="sticky-col index">Nº</th>
              <th className="sticky-col name">Cursista</th>
              <th>Município</th>
              {SLOTS.map((slot) => (
                <th key={slot}>
                  <span>Presença {slot}</span>
                  {canEdit ? (
                    <button
                      type="button"
                      className="mini-action"
                      title={`Marcar todos como presentes na presença ${slot}`}
                      onClick={() => markSlot(slot, "P")}
                    >
                      todos P
                    </button>
                  ) : null}
                </th>
              ))}
              <th>Freq. módulo</th>
              <th>Freq. geral</th>
              <th>Trabalho final</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const moduleStatuses = SLOTS.map(
                (slot) => attendance[cellKey(student.id, module, slot)] || null
              ) as Array<AttendanceStatus | null>;
              const moduleFrequency = attendanceFrequency(moduleStatuses);

              return (
                <tr key={student.id}>
                  <td className="sticky-col index">{student.position}</td>
                  <td className="sticky-col name"><strong>{student.name}</strong></td>
                  <td>{student.municipality || "—"}</td>
                  {SLOTS.map((slot) => {
                    const key = cellKey(student.id, module, slot);
                    return (
                      <td key={slot}>
                        <select
                          className="presence-select"
                          value={attendance[key]}
                          disabled={!canEdit}
                          onChange={(event) =>
                            setAttendance((current) => ({
                              ...current,
                              [key]: event.target.value as AttendanceStatus | ""
                            }))
                          }
                        >
                          <option value="">—</option>
                          <option value="P">P</option>
                          <option value="F">F</option>
                          <option value="NA">N/A</option>
                        </select>
                      </td>
                    );
                  })}
                  <td><span className="frequency">{percentLabel(moduleFrequency)}</span></td>
                  <td><span className="frequency">{percentLabel(overallFrequency[student.id])}</span></td>
                  <td>
                    <select
                      className="work-select"
                      value={finalWork[student.id]}
                      disabled={!canEdit}
                      onChange={(event) =>
                        setFinalWork((current) => ({ ...current, [student.id]: event.target.value as "" | "true" | "false" }))
                      }
                    >
                      <option value="">Pendente</option>
                      <option value="true">Entregou</option>
                      <option value="false">Não entregou</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="save-bar">
        <div>
          <strong>Regra:</strong> frequência = P ÷ (P + F). N/A e campos vazios não entram no cálculo.
          <br />
          <strong>Certificação:</strong> frequência geral ≥ 75% + trabalho final entregue.
        </div>
        <div className="save-actions">
          {message ? <span className="save-message">{message}</span> : null}
          {canEdit ? (
            <button className="button button-primary" type="button" disabled={saving} onClick={save}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
