"use client";

import { useState } from "react";
import { useGroupContext } from "@/contexts/GroupContext";
import { joinGroupAsObserver } from "@/lib/db";
import { GroupRole } from "@/types";

function roleLabel(role: GroupRole | undefined) {
  if (role === "observer") return "observador";
  if (role === "owner") return "owner";
  return "miembro";
}

export default function GroupSetup() {
  const { groups, activeGroup, setActiveGroup, createNewGroup, reload, loading } =
    useGroupContext();
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  if (loading) {
    return (
      <div className="page-shell">
        <div className="surface mx-auto max-w-lg p-6">
          <div className="skeleton h-7 w-40" />
          <div className="skeleton mt-4 h-4 w-full" />
          <div className="skeleton mt-2 h-4 w-2/3" />
          <div className="skeleton mt-6 h-11 w-full" />
        </div>
      </div>
    );
  }

  const showOnboarding = groups.length === 0 || mode !== "none";

  if (showOnboarding) {
    return (
      <div className="page-shell">
        <section className="surface mx-auto max-w-xl p-6 sm:p-8">
          <p className="eyebrow mb-3">grupo activo</p>
          <h2 className="text-3xl font-black leading-tight text-fijo-900">
            {groups.length === 0
              ? "Empeza con fijo"
              : mode === "join"
                ? "Unirme a un grupo"
                : "Nuevo grupo"}
          </h2>
          <p className="muted-copy mt-3 text-sm">
            {mode === "join"
              ? "Pega el codigo que te compartio un miembro para ver su dashboard en modo solo lectura."
              : "Un grupo es tu turno fijo de futbol con tus amigos. Despues podes cargar jugadores, presentes y partidos."}
          </p>

          {mode !== "join" ? (
            <form
              className="mt-6 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!name.trim()) return;
                setCreating(true);
                setError("");
                try {
                  await createNewGroup(name.trim());
                  setName("");
                  setMode("none");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Error desconocido");
                } finally {
                  setCreating(false);
                }
              }}
            >
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[var(--ink-soft)]">
                  Nombre del grupo
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Futbol de los jueves"
                  className="field"
                />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="btn-primary flex-1"
                >
                  {creating ? "Creando..." : "Crear grupo"}
                </button>
                {groups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMode("none")}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          ) : (
            <form
              className="mt-6 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const code = joinCode.trim();
                if (!code) return;
                setJoining(true);
                setJoinError("");
                try {
                  const groupId = await joinGroupAsObserver(code);
                  setJoinCode("");
                  setMode("none");
                  await reload(groupId);
                } catch (err) {
                  setJoinError(err instanceof Error ? err.message : "Error desconocido");
                } finally {
                  setJoining(false);
                }
              }}
            >
              {joinError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  {joinError}
                </div>
              )}
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[var(--ink-soft)]">
                  Codigo del grupo
                </span>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Ej: A7KQ3XJP"
                  className="field font-mono tracking-[0.2em] uppercase"
                  maxLength={16}
                />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={joining || !joinCode.trim()}
                  className="btn-primary flex-1"
                >
                  {joining ? "Uniendome..." : "Unirme como observador"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("none");
                    setJoinError("");
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {groups.length === 0 && mode === "none" && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setMode("create")}
                className="btn-primary flex-1"
              >
                Crear mi grupo
              </button>
              <button
                type="button"
                onClick={() => setMode("join")}
                className="btn-secondary flex-1"
              >
                Tengo un codigo
              </button>
            </div>
          )}
        </section>
      </div>
    );
  }

  if (groups.length > 0) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6">
        <div className="surface-solid flex flex-col gap-3 p-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="block w-full sm:max-w-sm">
            <span className="mb-2 block text-xs font-bold text-[var(--muted)]">
              Grupo
            </span>
            <select
              value={activeGroup?.id ?? ""}
              onChange={(e) => {
                const nextGroup = groups.find((group) => group.id === e.target.value);
                if (nextGroup) setActiveGroup(nextGroup);
              }}
              className="field min-h-10 py-2 text-sm font-bold"
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} · {roleLabel(group.role)}
                </option>
              ))}
            </select>
          </label>
          {activeGroup && (
            <div className="flex items-center gap-2">
              <span className="level-pill border border-fijo-200 bg-white text-fijo-800">
                {roleLabel(activeGroup.role)}
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("create")}
              className="btn-secondary min-h-10 px-3 py-2 text-sm"
            >
              Nuevo grupo
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className="btn-ghost min-h-10 px-3 py-2 text-sm"
            >
              Unirme con codigo
            </button>
            {groups.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const currentIndex = groups.findIndex(
                    (group) => group.id === activeGroup?.id
                  );
                  const nextGroup = groups[(currentIndex + 1) % groups.length];
                  if (nextGroup) setActiveGroup(nextGroup);
                }}
                className="btn-ghost min-h-10 text-sm"
              >
                Cambiar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
