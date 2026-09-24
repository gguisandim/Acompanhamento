import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { ROLE_LABELS, type CurrentUser } from "@/lib/types";
import Avatar from "./Avatar";

function userContext(user: CurrentUser) {
  const parts = [ROLE_LABELS[user.role]];
  if (user.stateName) parts.push(user.stateName);
  if (user.classroomName) parts.push(user.classroomName);
  return parts.join(" • ");
}

function Icon({ name }: { name: "home" | "class" | "result" | "users" | "profile" }) {
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9h13v-9" /></>,
    class: <><path d="M4 5.5h16v13H4z" /><path d="M8 9h8M8 13h5" /></>,
    result: <><path d="M5 19V9m7 10V5m7 14v-7" /></>,
    users: <><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function AppShell({
  user,
  children
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-main">
          <Link href="/dashboard" className="brand">
            <span className="brand-symbol">A26</span>
            <span>
              <strong>Acompanhamento</strong>
              <small>Formação 2026</small>
            </span>
          </Link>

          <nav className="nav" aria-label="Navegação principal">
            <Link href="/dashboard"><Icon name="home" />Visão geral</Link>
            <p className="nav-label">Acompanhamento</p>
            <Link href="/dashboard#turmas"><Icon name="class" />Turmas</Link>
            <Link href="/dashboard#resultados"><Icon name="result" />Resultados</Link>
            {user.role === "ADMIN" ? (
              <>
                <p className="nav-label">Gestão</p>
                <Link href="/usuarios"><Icon name="users" />Usuários</Link>
              </>
            ) : null}
            <p className="nav-label">Conta</p>
            <Link href="/perfil"><Icon name="profile" />Meu perfil</Link>
          </nav>
        </div>

        <div className="sidebar-user">
          <Avatar name={user.name} avatarUrl={user.avatarUrl} size="small" />
          <div>
            <strong>{user.name}</strong>
            <span>{ROLE_LABELS[user.role]}</span>
          </div>
          <form action={logoutAction}>
            <button className="link-button" type="submit">Sair</button>
          </form>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="topbar-context">Região Norte · Curso 2026</span>
          <details className="user-menu">
            <summary>
              <Avatar name={user.name} avatarUrl={user.avatarUrl} size="small" />
              <span className="user-menu-copy">
                <strong>{user.name}</strong>
                <small>{userContext(user)}</small>
              </span>
              <span className="chevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="user-menu-panel">
              <div className="user-menu-heading">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
              <Link href="/perfil">Meu perfil</Link>
              <Link href="/perfil#senha">Alterar senha</Link>
              <form action={logoutAction}>
                <button type="submit">Sair</button>
              </form>
            </div>
          </details>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
