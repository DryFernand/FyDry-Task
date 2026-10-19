"use client";

import { createContext, useContext } from "react";
import { Category, Challenge, Habit, HabitKind, Task } from "@/lib/tasks";
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
}

export interface Dash {
  categories: Category[];
  catOf: (id: string | null) => Category | undefined;
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
