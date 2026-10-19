"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "./Modal";
import { fieldInput, fieldLabel } from "./TaskFormModal";
import { api, Category, Challenge, CHALLENGE_META, ChallengeStatus, todayISO } from "@/lib/tasks";

export type ChallengeFormTarget = { kind: "new"; date: string } | { kind: "edit"; challenge: Challenge };

type Common = { categories: Category[]; onClose: () => void; onSaved: () => void };

// ============ Crear / editar reto ============
export function ChallengeFormModal(props: Common & { target: ChallengeFormTarget | null }) {
  if (!props.target) return null;
  return <ChallengeForm {...props} target={props.target} />;
}

function ChallengeForm({ target, categories, onClose, onSaved }: Common & { target: ChallengeFormTarget }) {
  const src = target.kind === "edit" ? target.challenge : null;
  const [title, setTitle] = useState(src?.title ?? "");
  const [categoryId, setCategoryId] = useState(src?.category_id ?? "");
  const [date, setDate] = useState(src?.date ?? (target.kind === "new" ? target.date : todayISO()));
  const [time, setTime] = useState(src?.time ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!title.trim()) return setError("Escribe el reto.");
    setSaving(true);
    setError("");
    const data = { title: title.trim(), category_id: categoryId || null, date, time: time || null };
    try {
      if (src) await api.updateChallenge(src.id, data);
      else await api.createChallenge(data);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={src ? "Editar reto" : "Nuevo reto"}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 cursor-pointer">Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar
          </button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div>
          <label htmlFor="ch-title" className={fieldLabel}>Reto</label>
          <input id="ch-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Ej. Caminar 10k en 30 minutos" className={fieldInput} />
          <p className="mt-1.5 text-[11px] text-zinc-500">Escribe la meta concreta. Al terminar el día cuentas cómo te fue.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ch-date" className={fieldLabel}>Día</label>
            <input id="ch-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={fieldInput} />
          </div>
          <div>
            <label htmlFor="ch-time" className={fieldLabel}>Hora (opcional)</label>
            <input id="ch-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={fieldInput} />
          </div>
        </div>
        <div>
          <label htmlFor="ch-cat" className={fieldLabel}>Categoría</label>
          <select id="ch-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldInput}>
            <option value="">Sin categoría</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {error && <p className="text-xs text-rose-600 font-medium" role="alert">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

// ============ Resultado del reto (nota obligatoria) ============
export function ResultChoices({ value, onChange, name }: { value: ChallengeStatus | null; onChange: (s: Exclude<ChallengeStatus, "pending">) => void; name: string }) {
  return (
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={`Resultado de ${name}`}>
      {(Object.keys(CHALLENGE_META) as Exclude<ChallengeStatus, "pending">[]).map((s) => (
        <button key={s} type="button" role="radio" aria-checked={value === s} onClick={() => onChange(s)}
          className={`flex items-center justify-center gap-1 py-2 rounded-xl border text-[11px] font-semibold cursor-pointer ${value === s ? CHALLENGE_META[s].soft : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"}`}>
          <span aria-hidden="true">{CHALLENGE_META[s].emoji}</span> {CHALLENGE_META[s].label}
        </button>
      ))}
    </div>
  );
}

export function ChallengeResultModal({ challenge, onClose, onSaved }: { challenge: Challenge | null; onClose: () => void; onSaved: () => void }) {
  if (!challenge) return null;
  return <ResultForm key={challenge.id} challenge={challenge} onClose={onClose} onSaved={onSaved} />;
}

function ResultForm({ challenge, onClose, onSaved }: { challenge: Challenge; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<Exclude<ChallengeStatus, "pending"> | null>(challenge.status === "pending" ? null : challenge.status);
  const [note, setNote] = useState(challenge.result_note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (s: ChallengeStatus | null = status) => {
    if (!s) return setError("Elige cómo te fue.");
    if (s !== "pending" && note.trim().length < 3) return setError("Cuenta cómo te fue: la nota del resultado es obligatoria.");
    setSaving(true);
    setError("");
    try {
      await api.challengeResult(challenge.id, s, s === "pending" ? null : note.trim());
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="¿Cómo te fue con el reto?"
      footer={
        <div className="flex items-center justify-between gap-2">
          {challenge.status !== "pending" ? (
            <button type="button" onClick={() => save("pending")} className="px-3 py-2.5 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-zinc-100 cursor-pointer">Quitar resultado</button>
          ) : <span />}
          <button type="button" onClick={() => save()} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar resultado
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/70 text-sm font-semibold text-zinc-900">🏁 {challenge.title}</div>
        <ResultChoices value={status} onChange={setStatus} name={challenge.title} />
        <div>
          <label htmlFor="ch-note" className={fieldLabel}>Resultado (obligatorio)</label>
          <textarea id="ch-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder="Ej. Corrí 10k pero en 40 minutos" className={fieldInput} />
        </div>
        {error && <p className="text-xs text-rose-600 font-medium" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
