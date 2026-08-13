import { Timestamp } from "firebase/firestore";

export type TimeEntrySource = "timer" | "manual" | "recovery";

export interface TimeEntry {
  userId: string;
  userName: string;

  source: TimeEntrySource;
  status: "running" | "completed";

  startedAt: Timestamp | null;
  endedAt: Timestamp | null;
  durationSeconds: number;

  note?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;

  adjustedAt?: Timestamp | null;
  adjustedByUid?: string | null;
  adjustmentReason?: string | null;
}

export interface ActiveTimer {
  userId: string;

  pluginId: string;
  pluginName: string;

  todoId: string;
  todoText: string;

  timeEntryId: string;
  startedAt: Timestamp;

  createdAt: Timestamp;
}
