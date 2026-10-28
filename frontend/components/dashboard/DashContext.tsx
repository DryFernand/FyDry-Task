"use client";

import { createContext, useContext } from "react";
import { Category, Challenge, Habit, HabitKind, Program, Schedule, Subject, Task } from "@/lib/tasks";
import { ItemKind } from "./ItemRows";

export interface DashActions {
  newTask: (date: string | null) => void;
  editTask: (t: Task) => void;
  newHabit: (mode: HabitKind, date?: string) => void;
  editHabit: (h: Habit) => void;
  newChallenge: (date: string) => void;
  editChallenge: (c: Challenge) => void;
  reportChallenge: (c: Challenge) => void;
  openClose: (date: string) => void;
  /** "+ Agregar" de un día: abre el formulario del tipo elegido con ese día. */
  create: (kind: ItemKind, date: string) => void;
  newSchedule: (programId?: string) => void;
  /** Abre la carrera (null = nueva). */
  editProgram: (p: Program | null) => void;
  editSchedule: (s: Schedule) => void;
  duplicateSchedule: (s: Schedule) => void;
  newSubject: (scheduleId: string) => void;
  editSubject: (s: Subject) => void;
  openSubject: (s: Subject) => void;
}

export interface Dash {
  categories: Category[];
  catOf: (id: string | null) => Category | undefined;
  /** Horarios del usuario (activos y archivados) y sus materias. */
  schedules: Schedule[];
  /** Carreras: agrupan horarios; la primera es la principal. */
  programs: Program[];
  /** false hasta la primera carga de horarios y carreras. */
  schedulesLoaded: boolean;
  subjectOf: (id: string | null) => Subject | undefined;
  reloadSchedules: () => void;
  refreshKey: number;
  bump: () => void;
  onError: (m: string) => void;
  onInfo: (m: string) => void;
  actions: DashActions;
}

export const DashContext = createContext<Dash | null>(null);

export function useDash(): Dash {
  const v = useContext(DashContext);
  if (!v) throw new Error("useDash debe usarse dentro del panel");
  return v;
}
