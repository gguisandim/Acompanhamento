import type { AttendanceStatus } from "./types";

export const MODULES = [1, 2, 3, 4, 5, 6] as const;
export const SLOTS = [1, 2, 3, 4, 5, 6] as const;
export const MIN_FREQUENCY = 0.75;

export function attendanceFrequency(statuses: Array<AttendanceStatus | null | undefined>) {
  const p = statuses.filter((status) => status === "P").length;
  const f = statuses.filter((status) => status === "F").length;
  if (p + f === 0) return null;
  return p / (p + f);
}

export function moduleResult(statuses: Array<AttendanceStatus | null | undefined>) {
  const frequency = attendanceFrequency(statuses);
  if (frequency === null) return null;
  return frequency >= MIN_FREQUENCY ? "APROVADO" : "ABAIXO DE 75%";
}

export function certificationResult(
  statuses: Array<AttendanceStatus | null | undefined>,
  finalWorkDelivered: boolean | null
) {
  const frequency = attendanceFrequency(statuses);
  if (frequency === null || finalWorkDelivered === null) return null;
  return frequency >= MIN_FREQUENCY && finalWorkDelivered;
}

export function percentLabel(value: number | null) {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}
