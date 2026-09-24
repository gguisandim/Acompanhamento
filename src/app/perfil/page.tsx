import AppShell from "@/components/AppShell";
import Avatar from "@/components/Avatar";
import ProfileForms from "@/components/ProfileForms";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/types";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <AppShell user={user}>
      <header className="page-header">
        <div>
          <p className="eyebrow">CONTA</p>
          <h1>Meu perfil</h1>
          <p className="muted">Consulte seu acesso e mantenha seus dados pessoais atualizados.</p>
        </div>
      </header>

      <section className="profile-summary">
        <Avatar name={user.name} avatarUrl={user.avatarUrl} size="large" />
        <div className="profile-identity">
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <span className="status ok">Conta ativa</span>
        </div>
        <dl className="profile-facts">
          <div><dt>Perfil</dt><dd>{ROLE_LABELS[user.role]}</dd></div>
          <div><dt>Estado</dt><dd>{user.stateName ?? "Todos os estados"}</dd></div>
          <div><dt>Turma</dt><dd>{user.classroomName ?? "Não se aplica"}</dd></div>
        </dl>
      </section>

      <div className="profile-note">
        O avatar usa suas iniciais nesta etapa. Perfil, estado e turma são controlados pela administração.
      </div>

      <ProfileForms name={user.name} />
    </AppShell>
  );
}
