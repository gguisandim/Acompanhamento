"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { resetUserPasswordAction, updateUserAction } from "@/app/usuarios/actions";
import { ROLE_LABELS, type Role } from "@/lib/types";

type StateOption = { id: string; code: string; name: string };
type ClassroomOption = { id: string; name: string; state_id: string };
export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  stateId: string | null;
  stateCode: string | null;
  stateName: string | null;
  classroomId: string | null;
  classroomName: string | null;
  lastLoginAt: string | null;
};

function UserEditor({ user, states, classrooms, isCurrent }: {
  user: ManagedUser;
  states: StateOption[];
  classrooms: ClassroomOption[];
  isCurrent: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(user.role);
  const [stateId, setStateId] = useState(user.stateId ?? states[0]?.id ?? "");
  const [active, setActive] = useState(user.active);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const visibleClassrooms = useMemo(() => classrooms.filter((item) => item.state_id === stateId), [classrooms, stateId]);

  async function save(formData: FormData) {
    setPending(true);
    setMessage("");
    try {
      await updateUserAction({
        id: user.id,
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        role,
        stateId: role === "PROFESSOR" || role === "COORDENADOR_ESTADUAL" ? stateId : null,
        classroomId: role === "PROFESSOR" ? String(formData.get("classroomId") ?? "") || null : null,
        active
      });
      setMessage("Usuário atualizado.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar.");
    } finally {
      setPending(false);
    }
  }

  async function resetPassword(formData: FormData) {
    setPending(true);
    setMessage("");
    try {
      await resetUserPasswordAction({ id: user.id, password: String(formData.get("password") ?? "") });
      setMessage("Senha redefinida.");
      const form = document.getElementById(`reset-${user.id}`) as HTMLFormElement | null;
      form?.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível redefinir a senha.");
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="user-editor">
      <summary>Editar</summary>
      <div className="user-editor-panel">
        <form action={save} className="compact-form">
          <div className="editor-grid">
            <label>Nome<input name="name" defaultValue={user.name} minLength={2} required /></label>
            <label>E-mail<input name="email" type="email" defaultValue={user.email} required /></label>
            <label>Perfil
              <select value={role} onChange={(event) => setRole(event.target.value as Role)} disabled={isCurrent}>
                {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {role === "PROFESSOR" || role === "COORDENADOR_ESTADUAL" ? (
              <label>Estado
                <select value={stateId} onChange={(event) => setStateId(event.target.value)} required>
                  {states.map((state) => <option key={state.id} value={state.id}>{state.code} — {state.name}</option>)}
                </select>
              </label>
            ) : null}
            {role === "PROFESSOR" ? (
              <label>Turma
                <select name="classroomId" defaultValue={user.classroomId ?? ""} required>
                  <option value="">Selecione</option>
                  {visibleClassrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
                </select>
              </label>
            ) : null}
            <label className="check-label">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} disabled={isCurrent} />
              Usuário ativo
            </label>
          </div>
          <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar alterações"}</button>
        </form>
        <form id={`reset-${user.id}`} action={resetPassword} className="password-reset">
          <label>Nova senha<input name="password" type="password" minLength={8} placeholder="Mínimo de 8 caracteres" required /></label>
          <button className="button button-secondary" type="submit" disabled={pending}>Redefinir senha</button>
        </form>
        {message ? <p className="form-feedback">{message}</p> : null}
      </div>
    </details>
  );
}

export default function UserManagement({ users, states, classrooms, currentUserId }: {
  users: ManagedUser[];
  states: StateOption[];
  classrooms: ClassroomOption[];
  currentUserId: string;
}) {
  return (
    <div className="table-wrap users-table-wrap">
      <table className="summary-table users-table">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Estado</th><th>Turma</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td><strong>{user.name}</strong>{user.id === currentUserId ? <small className="current-user-label">Você</small> : null}</td>
              <td>{user.email}</td>
              <td>{ROLE_LABELS[user.role]}</td>
              <td>{user.stateCode ?? "Todos"}</td>
              <td>{user.classroomName ?? "—"}</td>
              <td><span className={user.active ? "status ok" : "status muted-status"}>{user.active ? "Ativo" : "Inativo"}</span></td>
              <td><UserEditor user={user} states={states} classrooms={classrooms} isCurrent={user.id === currentUserId} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
