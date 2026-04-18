"use client";

import { useState } from "react";
import { useGroupContext } from "@/contexts/GroupContext";

export default function GroupSetup() {
  const { groups, activeGroup, setActiveGroup, createNewGroup, loading } = useGroupContext();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

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

  if (groups.length === 0 || showCreate) {
    return (
      <div className="page-shell">
        <section className="surface mx-auto max-w-xl p-6 sm:p-8">
          <p className="eyebrow mb-3">grupo activo</p>
          <h2 className="text-3xl font-black leading-tight text-fijo-900">
            {groups.length === 0 ? "Crea tu primer grupo" : "Nuevo grupo"}
          </h2>
          <p className="muted-copy mt-3 text-sm">
            Un grupo es tu turno fijo de futbol con tus amigos. Despues podes
            cargar jugadores, presentes y partidos.
          </p>
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
                setShowCreate(false);
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
                  onClick={() => setShowCreate(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
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
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="btn-secondary min-h-10 px-3 py-2 text-sm"
            >
              Nuevo grupo
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
