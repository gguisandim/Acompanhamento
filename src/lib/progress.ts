import type { AttendanceStatus, FinalStatus } from "@/lib/types";

export const MODULES = [1, 2, 3, 4, 5, 6] as const;
export const SLOTS = [1, 2, 3, 4, 5, 6] as const;
export const TOTAL_ATTENDANCE_SLOTS = MODULES.length * SLOTS.length;
export const MIN_FREQUENCY = 75;

export type ModuleTrackingState = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";

export interface AttendanceMetrics {
  present: number;
  absent: number;
  notApplicable: number;
  filled: number;
  expected: number;
  frequency: number | null;
  progress: number;
}

export function attendanceMetrics(
  statuses: Array<AttendanceStatus | null | undefined>,
  expected = statuses.length
): AttendanceMetrics {
  let present = 0;
  let absent = 0;
  let notApplicable = 0;

  for (const status of statuses) {
    if (status === "P") present += 1;
    else if (status === "F") absent += 1;
    else if (status === "NA") notApplicable += 1;
  }

  const filled = present + absent + notApplicable;
  const frequencyDenominator = present + absent;

  return {
    present,
    absent,
    notApplicable,
    filled,
    expected,
    frequency: frequencyDenominator > 0 ? (present / frequencyDenominator) * 100 : null,
    progress: expected > 0 ? (filled / expected) * 100 : 0
  };
}

export function attendanceFrequency(
  statuses: Array<AttendanceStatus | null | undefined>
): number | null {
  return attendanceMetrics(statuses).frequency;
}

export function attendanceProgress(
  statuses: Array<AttendanceStatus | null | undefined>,
  expected = statuses.length
): number {
  return attendanceMetrics(statuses, expected).progress;
}

export function moduleTrackingState(
  statuses: Array<AttendanceStatus | null | undefined>,
  expected = statuses.length
): ModuleTrackingState {
  const { filled } = attendanceMetrics(statuses, expected);
  if (filled === 0) return "NOT_STARTED";
  return filled >= expected ? "COMPLETE" : "IN_PROGRESS";
}

export function suggestFinalStatus(
  statuses: Array<AttendanceStatus | null | undefined>,
  finalWorkDelivered: boolean | null
): FinalStatus {
  const metrics = attendanceMetrics(statuses, TOTAL_ATTENDANCE_SLOTS);

  if (metrics.progress < 100) return "IN_PROGRESS";
  if (metrics.frequency === null) return "PENDING_REVIEW";
  if (metrics.frequency < MIN_FREQUENCY) return "INSUFFICIENT_ATTENDANCE";
  if (finalWorkDelivered === null) return "FINAL_WORK_PENDING";
  if (!finalWorkDelivered) return "NOT_COMPLETED";
  return "READY_FOR_CERTIFICATION";
}

export function effectiveFinalStatus(
  manualStatus: FinalStatus | null,
  suggestedStatus: FinalStatus
): FinalStatus {
  return manualStatus ?? suggestedStatus;
}

export function certificationResult(
  statuses: Array<AttendanceStatus | null | undefined>,
  finalWorkDelivered: boolean | null
): boolean | null {
  const status = suggestFinalStatus(statuses, finalWorkDelivered);
  if (status === "READY_FOR_CERTIFICATION") return true;
  if (status === "INSUFFICIENT_ATTENDANCE" || status === "NOT_COMPLETED") return false;
  return null;
}

export function percentLabel(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}%`;
}
