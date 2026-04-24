"use client";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import RequireEditor from "@/components/RequireEditor";
import GroupSetup from "@/components/GroupSetup";
import { useGroupContext } from "@/contexts/GroupContext";
import { getPlayers, addPlayer, updatePlayer, deletePlayer } from "@/lib/db";
import { Player } from "@/types";

export default function JugadoresPage() {
  const { activeGroup } = useGroupContext();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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
    await addPlayer(activeGroup.id, name.trim(), "tranqui");
    setName("");
    await load();
  };

  const handleUpdate = async (id: string) => {
    if (!activeGroup || !editName.trim()) return;
    await updatePlayer(activeGroup.id, id, { name: editName.trim() });
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
      <RequireEditor>
      <GroupSetup />
      {activeGroup && (
        <div className="page-shell">
          <header className="mb-8 max-w-2xl">
            <p className="eyebrow mb-2">plantel</p>
            <h1 className="text-4xl font-black leading-tight text-fijo-900">
              Jugadores
            </h1>
            <p className="muted-copy mt-2 text-sm">
              Carga el plantel una sola vez. El nivel de los mejores se marca
              rapido en el sorteo de cada partido.
            </p>
          </header>

          <form onSubmit={handleAdd} className="surface mb-6 grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-end">
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
                Despues marcas quienes son los mejores al momento de sortear.
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
                    <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="field min-h-10 py-2 text-sm"
                      />
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
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingId(p.id);
                            setEditName(p.name);
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
                <span className="ml-auto font-black text-fijo-900">
                  Total: {players.length}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      </RequireEditor>
    </ProtectedRoute>
  );
}
