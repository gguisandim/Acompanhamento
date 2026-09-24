import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import UserCreateForm from "@/components/UserCreateForm";
import UserManagement from "@/components/UserManagement";
import { requireUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/access";
import { getStatesAndClassrooms, getUsers } from "@/lib/data";
import type { Role } from "@/lib/types";

export default async function UsersPage() {
  const user = await requireUser();
  if (!canManageUsers(user)) redirect("/dashboard");

  const [{ states, classrooms }, users] = await Promise.all([
    getStatesAndClassrooms(),
    getUsers()
  ]);

  return (
    <AppShell user={user}>
      <header className="page-header">
        <div>
          <p className="eyebrow">ADMINISTRAÇÃO</p>
          <h1>Usuários e acessos</h1>
          <p className="muted">Professor visualiza o estado e edita 1 turma; coordenador estadual edita as 6 turmas do estado.</p>
        </div>
      </header>

      <UserCreateForm
        states={states.map((item) => ({ id: item.id, code: item.code, name: item.name }))}
        classrooms={classrooms.map((item) => ({
          id: item.id,
          name: item.name,
          state_id: item.state_id,
          state_code: item.state_code
        }))}
      />

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Usuários cadastrados</h2>
            <p>Edite o perfil, o escopo, o status da conta ou redefina a senha.</p>
          </div>
          <span>{users.length} usuário(s)</span>
        </div>
        <UserManagement
          currentUserId={user.id}
          states={states.map((item) => ({ id: String(item.id), code: String(item.code), name: String(item.name) }))}
          classrooms={classrooms.map((item) => ({ id: String(item.id), name: String(item.name), state_id: String(item.state_id) }))}
          users={users.map((item) => ({
            id: String(item.id),
            name: String(item.name),
            email: String(item.email),
            role: item.role as Role,
            active: Boolean(item.active),
            stateId: item.state_id == null ? null : String(item.state_id),
            stateCode: item.state_code == null ? null : String(item.state_code),
            stateName: item.state_name == null ? null : String(item.state_name),
            classroomId: item.classroom_id == null ? null : String(item.classroom_id),
            classroomName: item.classroom_name == null ? null : String(item.classroom_name),
            lastLoginAt: item.last_login_at == null ? null : String(item.last_login_at)
          }))}
        />
      </section>
    </AppShell>
  );
}
