"use client";

import { useMemo, useState } from "react";
import { createUserAction } from "@/app/usuarios/actions";

type State = { id: string; code: string; name: string };
type Classroom = { id: string; name: string; state_id: string; state_code: string };

export default function UserCreateForm({
  states,
  classrooms
}: {
  states: State[];
  classrooms: Classroom[];
}) {
  const [role, setRole] = useState("PROFESSOR");
  const [stateId, setStateId] = useState(states[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const visibleClassrooms = useMemo(
    () => classrooms.filter((classroom) => !stateId || classroom.state_id === stateId),
    [classrooms, stateId]
  );

  async function submit(formData: FormData) {
    setPending(true);
    setMessage("");
    try {
      await createUserAction(formData);
      setMessage("Usuário criado.");
      const form = document.getElementById("create-user-form") as HTMLFormElement | null;
      form?.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar usuário.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form id="create-user-form" action={submit} className="user-form">
      <h2>Adicionar usuário</h2>
      <div className="form-grid">
        <label>
          Nome
          <input name="name" required minLength={2} />
        </label>
        <label>
          E-mail
          <input name="email" type="email" required />
        </label>
        <label>
          Senha inicial
          <input name="password" type="password" minLength={8} required />
        </label>
        <label>
          Perfil
          <select name="role" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="PROFESSOR">Professor</option>
            <option value="COORDENADOR_ESTADUAL">Coordenador estadual</option>
            <option value="COORDENADOR_GERAL">Coordenador geral</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </label>

        {(role === "PROFESSOR" || role === "COORDENADOR_ESTADUAL") ? (
          <label>
            Estado
            <select
              name="stateId"
              value={stateId}
              onChange={(event) => setStateId(event.target.value)}
              required
            >
              {states.map((state) => (
                <option value={state.id} key={state.id}>{state.code} — {state.name}</option>
              ))}
            </select>
          </label>
        ) : null}

        {role === "PROFESSOR" ? (
          <label>
            Turma
            <select name="classroomId" required>
              <option value="">Selecione</option>
              {visibleClassrooms.map((classroom) => (
                <option value={classroom.id} key={classroom.id}>{classroom.name}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {message ? <div className="alert">{message}</div> : null}
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Criando..." : "Criar usuário"}
      </button>
    </form>
  );
}
