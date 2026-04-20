"use client";

import { useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useGroupContext } from "@/contexts/GroupContext";
import { deleteGroup, updateGroup } from "@/lib/db";
import { Group } from "@/types";

export default function GruposPage() {
  const { groups, activeGroup, loading, reload } = useGroupContext();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const beginEdit = (group: Group) => {
    setEditingId(group.id);
    setEditName(group.name);
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setError("");
  };

  const handleUpdate = async (groupId: string) => {
    if (!editName.trim()) return;
    setPendingId(groupId);
    setError("");

    try {
      await updateGroup(groupId, editName);
      setEditingId(null);
      setEditName("");
      await reload(groupId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo editar el grupo.");
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async (group: Group) => {
    const confirmed = confirm(
      `Eliminar "${group.name}"? Tambien se borran sus jugadores y partidos.`
    );
    if (!confirmed) return;

    setPendingId(group.id);
    setError("");

    try {
      await deleteGroup(group.id);
      if (editingId === group.id) cancelEdit();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el grupo.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <ProtectedRoute>
      <div className="page-shell">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow mb-2">grupos</p>
            <h1 className="text-4xl font-black leading-tight text-fijo-900">
              Tus turnos fijos
            </h1>
            <p className="muted-copy mt-2 text-sm">
              Edita el nombre de cada grupo o elimina los que ya no se juegan.
            </p>
          </div>
          <Link href="/dashboard" className="btn-secondary w-full sm:w-auto">
            Volver al inicio
          </Link>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <div className="skeleton h-24" />
            <div className="skeleton h-24" />
            <div className="skeleton h-24" />
          </div>
        ) : groups.length === 0 ? (
          <section className="surface mx-auto max-w-xl p-8 text-center">
            <p className="eyebrow mb-2">sin grupos</p>
            <h2 className="text-2xl font-black text-fijo-900">
              Todavia no tenes un turno fijo
            </h2>
            <p className="muted-copy mx-auto mt-3 max-w-md text-sm">
              Crea tu primer grupo desde el inicio y despues volve aca para
              administrarlo.
            </p>
            <Link href="/dashboard" className="btn-primary mt-6">
              Crear un grupo
            </Link>
          </section>
        ) : (
          <section className="space-y-3">
            {groups.map((group) => {
              const isEditing = editingId === group.id;
              const isPending = pendingId === group.id;
              const isActive = activeGroup?.id === group.id;

              return (
                <article
                  key={group.id}
                  className="surface-solid flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-[var(--ink-soft)]">
                          Nombre del grupo
                        </span>
                        <input
                          type="text"
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          className="field"
                          autoFocus
                        />
                      </label>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="break-words text-xl font-black text-fijo-900">
                            {group.name}
                          </h2>
                          {isActive && (
                            <span className="level-pill border border-fijo-200 bg-fijo-50 text-fijo-800">
                              activo
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          Creado el{" "}
                          {new Intl.DateTimeFormat("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          }).format(new Date(group.createdAt))}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdate(group.id)}
                          disabled={isPending || !editName.trim()}
                          className="btn-primary min-h-10 px-3 py-2 text-sm"
                        >
                          {isPending ? "Guardando..." : "Guardar"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={isPending}
                          className="btn-secondary min-h-10 px-3 py-2 text-sm"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => beginEdit(group)}
                          disabled={Boolean(pendingId)}
                          className="btn-secondary min-h-10 px-3 py-2 text-sm"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(group)}
                          disabled={Boolean(pendingId)}
                          className="btn-ghost min-h-10 text-sm text-red-700 hover:bg-red-50 hover:text-red-800"
                        >
                          {isPending ? "Eliminando..." : "Eliminar"}
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </ProtectedRoute>
  );
}
