"use client";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import GroupSetup from "@/components/GroupSetup";
import { useGroupContext } from "@/contexts/GroupContext";
import { getPlayers, addPlayer, updatePlayer, deletePlayer } from "@/lib/db";
import { Player, SkillLevel } from "@/types";

const LEVELS: { value: SkillLevel; label: string; color: string }[] = [
  {
    value: "bueno",
    label: "Bueno",
    color: "border border-fijo-200 bg-fijo-100 text-fijo-800",
  },
  {
    value: "tranqui",
    label: "Tranqui",
    color: "border border-amber-200 bg-amber-50 text-amber-800",
  },
  {
    value: "malo",
    label: "Malo",
    color: "border border-red-200 bg-red-50 text-red-700",
  },
];

export default function JugadoresPage() {
  const { activeGroup } = useGroupContext();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<SkillLevel>("tranqui");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLevel, setEditLevel] = useState<SkillLevel>("tranqui");

  const load = useCallback(async () => {
    if (!activeGroup) return;
    setLoading(true);
    const p = await getPlayers(activeGroup.id);
    setPlayers(p);
    setLoading(false);
  }, [activeGroup]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !name.trim()) return;
    await addPlayer(activeGroup.id, name.trim(), level);
    setName("");
    setLevel("tranqui");
    await load();
  };

  const handleUpdate = async (id: string) => {
    if (!activeGroup || !editName.trim()) return;
    await updatePlayer(activeGroup.id, id, { name: editName.trim(), level: editLevel });
    setEditingId(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!activeGroup) return;
    if (!confirm("Eliminar este jugador?")) return;
    await deletePlayer(activeGroup.id, id);
    await load();
  };

  return (
    <ProtectedRoute>
      <GroupSetup />
      {activeGroup && (
        <div className="page-shell">
          <header className="mb-8 max-w-2xl">
            <p className="eyebrow mb-2">plantel</p>
            <h1 className="text-4xl font-black leading-tight text-fijo-900">
              Jugadores
            </h1>
            <p className="muted-copy mt-2 text-sm">
              Carga el grupo y ajusta el nivel para que el sorteo reparta mejor.
            </p>
          </header>

          <form onSubmit={handleAdd} className="surface mb-6 grid gap-4 p-4 md:grid-cols-[1fr_12rem_auto] md:items-end">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[var(--ink-soft)]">
                Nombre
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del jugador"
                className="field"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[var(--ink-soft)]">
                Nivel
              </span>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as SkillLevel)}
                className="field"
              >
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={!name.trim()}
              className="btn-primary"
            >
              Agregar
            </button>
          </form>

          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-16" />
              <div className="skeleton h-16" />
              <div className="skeleton h-16" />
            </div>
          ) : players.length === 0 ? (
            <div className="surface mx-auto max-w-xl p-8 text-center">
              <p className="eyebrow mb-2">plantel vacio</p>
              <h2 className="text-2xl font-black text-fijo-900">
                Agrega el primer jugador
              </h2>
              <p className="muted-copy mx-auto mt-3 max-w-md text-sm">
                Despues podes clasificarlo como bueno, tranqui o malo.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {players.map((p) => (
                <div
                  key={p.id}
                  className="surface-solid flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                >
                  {editingId === p.id ? (
                    <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_10rem_auto_auto] sm:items-center">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="field min-h-10 py-2 text-sm"
                      />
                      <select
                        value={editLevel}
                        onChange={(e) => setEditLevel(e.target.value as SkillLevel)}
                        className="field min-h-10 py-2 text-sm"
                      >
                        {LEVELS.map((l) => (
                          <option key={l.value} value={l.value}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleUpdate(p.id)}
                        className="btn-secondary min-h-10 px-3 py-2 text-sm"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="btn-ghost text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-bold text-fijo-900">{p.name}</span>
                        <span
                          className={`level-pill ${
                            LEVELS.find((l) => l.value === p.level)?.color
                          }`}
                        >
                          {LEVELS.find((l) => l.value === p.level)?.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingId(p.id);
                            setEditName(p.name);
                            setEditLevel(p.level);
                          }}
                          className="btn-ghost text-sm"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="rounded-md px-3 py-2 text-sm font-bold text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
                        >
                          Eliminar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              <div className="surface-solid flex flex-wrap gap-4 p-4 text-sm text-[var(--muted)]">
                {LEVELS.map((l) => (
                  <span key={l.value} className="font-semibold">
                    {l.label}: {players.filter((p) => p.level === l.value).length}
                  </span>
                ))}
                <span className="ml-auto font-black text-fijo-900">
                  Total: {players.length}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </ProtectedRoute>
  );
}
