export type Role =
  | "PROFESSOR"
  | "COORDENADOR_ESTADUAL"
  | "COORDENADOR_GERAL"
  | "ADMIN";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  stateId: string | null;
  classroomId: string | null;
  stateCode: string | null;
  stateName: string | null;
  classroomName: string | null;
  avatarUrl: string | null;
  active: boolean;
};

export type AttendanceStatus = "P" | "F" | "NA";

export type ClassroomScope = {
  id: string;
  state_id: string;
};

export const ROLE_LABELS: Record<Role, string> = {
  PROFESSOR: "Professor",
  COORDENADOR_ESTADUAL: "Coordenador Estadual",
  COORDENADOR_GERAL: "Coordenador Geral",
  ADMIN: "Admin da Plataforma"
};

export function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return `${parts[0][0] ?? ""}${parts.length > 1 ? parts.at(-1)?.[0] ?? "" : ""}`.toUpperCase();
}
