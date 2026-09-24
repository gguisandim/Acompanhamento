import type { ClassroomScope, CurrentUser } from "./types";

export function canAccessClass(user: CurrentUser, classroom: ClassroomScope) {
  if (user.role === "ADMIN" || user.role === "COORDENADOR_GERAL") return true;
  if (user.role === "COORDENADOR_ESTADUAL" || user.role === "PROFESSOR") {
    return Boolean(user.stateId) && user.stateId === classroom.state_id;
  }
  return false;
}

export function canEditClass(user: CurrentUser, classroom: ClassroomScope) {
  if (user.role === "ADMIN" || user.role === "COORDENADOR_GERAL") return true;
  if (user.role === "COORDENADOR_ESTADUAL") return user.stateId === classroom.state_id;
  return user.role === "PROFESSOR" && user.classroomId === classroom.id;
}

export function canImportRoster(user: CurrentUser, classroom: ClassroomScope) {
  if (!canAccessClass(user, classroom)) return false;
  return user.role !== "PROFESSOR";
}

export function canManageUsers(user: CurrentUser) {
  return user.role === "ADMIN";
}
