"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useGroupContext } from "@/contexts/GroupContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  addGroupMemberByEmail,
  deleteGroup,
  generateGroupPublicCode,
  getGroupMembers,
  getGroupObservers,
  joinGroupAsObserver,
  leaveGroupObserver,
  removeGroupMember,
  removeGroupObserver,
  revokeGroupPublicCode,
  updateGroup,
} from "@/lib/db";
import { Group, GroupMember, GroupObserver } from "@/types";

function getErrorMessage(error: unknown, fallback: string) {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : fallback;

  if (
    message.includes("get_group_members") ||
    message.includes("add_group_member_by_email") ||
    message.includes("remove_group_member") ||
    message.includes("generate_group_public_code") ||
    message.includes("revoke_group_public_code") ||
    message.includes("join_group_as_observer") ||
    message.includes("leave_group_observer") ||
    message.includes("get_group_observers") ||
    message.includes("remove_group_observer") ||
    message.includes('relation "public.group_observers"')
  ) {
    return "Falta ejecutar el SQL nuevo en Supabase para habilitar observadores.";
  }

  if (message.includes('relation "public.user_profiles" does not exist')) {
    return "Falta crear la tabla user_profiles en Supabase. Ejecuta el SQL actualizado.";
  }

  if (message.includes("No tienes acceso a este grupo")) {
    return "No tienes permisos para administrar este grupo.";
  }

  return message;
}

function buildShareMessage(groupName: string, code: string) {
  return `Te invito a ver "${groupName}" en fijo con este codigo: ${code}`;
}

export default function GruposPage() {
  const { groups, activeGroup, loading, reload } = useGroupContext();
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [memberPendingId, setMemberPendingId] = useState<string | null>(null);
  const [codePendingId, setCodePendingId] = useState<string | null>(null);
  const [observerPendingId, setObserverPendingId] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersByGroup, setMembersByGroup] = useState<Record<string, GroupMember[]>>({});
  const [observersByGroup, setObserversByGroup] = useState<Record<string, GroupObserver[]>>({});
  const [memberEmails, setMemberEmails] = useState<Record<string, string>>({});
  const [memberErrors, setMemberErrors] = useState<Record<string, string>>({});
  const [codeErrors, setCodeErrors] = useState<Record<string, string>>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinPending, setJoinPending] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState("");

  const adminGroups = groups.filter((g) => g.role !== "observer");

  const loadMembersAndObservers = useCallback(async () => {
    if (adminGroups.length === 0) {
      setMembersByGroup({});
      setObserversByGroup({});
      setMembersLoading(false);
      return;
    }

    setMembersLoading(true);

    try {
      const entries = await Promise.all(
        adminGroups.map(async (group) => {
          const [members, observers] = await Promise.all([
            getGroupMembers(group.id),
            getGroupObservers(group.id).catch(() => [] as GroupObserver[]),
          ]);
          return [group.id, members, observers] as const;
        })
      );
      setMembersByGroup(Object.fromEntries(entries.map(([id, m]) => [id, m])));
      setObserversByGroup(Object.fromEntries(entries.map(([id, , o]) => [id, o])));
    } catch (err) {
      setError(getErrorMessage(err, "No se pudieron cargar los usuarios del grupo."));
    } finally {
      setMembersLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminGroups.map((g) => g.id).join(",")]);

  useEffect(() => {
    void loadMembersAndObservers();
  }, [loadMembersAndObservers]);

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
      setError(getErrorMessage(err, "No se pudo editar el grupo."));
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
      setError(getErrorMessage(err, "No se pudo eliminar el grupo."));
    } finally {
      setPendingId(null);
    }
  };

  const handleAddMember = async (groupId: string) => {
    const email = memberEmails[groupId]?.trim() ?? "";
    if (!email) return;

    setMemberPendingId(`add:${groupId}`);
    setMemberErrors((prev) => ({ ...prev, [groupId]: "" }));

    try {
      await addGroupMemberByEmail(groupId, email);
      const members = await getGroupMembers(groupId);
      setMembersByGroup((prev) => ({ ...prev, [groupId]: members }));
      setMemberEmails((prev) => ({ ...prev, [groupId]: "" }));
    } catch (err) {
      setMemberErrors((prev) => ({
        ...prev,
        [groupId]: getErrorMessage(err, "No se pudo agregar el usuario al grupo."),
      }));
    } finally {
      setMemberPendingId(null);
    }
  };

  const handleRemoveMember = async (group: Group, member: GroupMember) => {
    const confirmed = confirm(`Quitar a ${member.email} de "${group.name}"?`);
    if (!confirmed) return;

    setMemberPendingId(`remove:${group.id}:${member.userId}`);
    setMemberErrors((prev) => ({ ...prev, [group.id]: "" }));

    try {
      await removeGroupMember(group.id, member.userId);

      if (member.userId === user?.id) {
        await reload();
        return;
      }

      const members = await getGroupMembers(group.id);
      setMembersByGroup((prev) => ({ ...prev, [group.id]: members }));
    } catch (err) {
      setMemberErrors((prev) => ({
        ...prev,
        [group.id]: getErrorMessage(err, "No se pudo quitar el usuario."),
      }));
    } finally {
      setMemberPendingId(null);
    }
  };

  const handleGenerateCode = async (group: Group) => {
    const confirmMsg = group.publicCode
      ? "Generar un codigo nuevo dejara de funcionar al anterior. Seguir?"
      : null;
    if (confirmMsg && !confirm(confirmMsg)) return;

    setCodePendingId(`gen:${group.id}`);
    setCodeErrors((prev) => ({ ...prev, [group.id]: "" }));

    try {
      await generateGroupPublicCode(group.id);
      await reload(group.id);
    } catch (err) {
      setCodeErrors((prev) => ({
        ...prev,
        [group.id]: getErrorMessage(err, "No se pudo generar el codigo."),
      }));
    } finally {
      setCodePendingId(null);
    }
  };

  const handleRevokeCode = async (group: Group) => {
    const confirmed = confirm("Revocar el codigo? Quien lo tenga dejara de poder unirse.");
    if (!confirmed) return;

    setCodePendingId(`revoke:${group.id}`);
    setCodeErrors((prev) => ({ ...prev, [group.id]: "" }));

    try {
      await revokeGroupPublicCode(group.id);
      await reload(group.id);
    } catch (err) {
      setCodeErrors((prev) => ({
        ...prev,
        [group.id]: getErrorMessage(err, "No se pudo revocar el codigo."),
      }));
    } finally {
      setCodePendingId(null);
    }
  };

  const handleCopyCode = async (group: Group) => {
    if (!group.publicCode) return;
    try {
      await navigator.clipboard.writeText(group.publicCode);
      setCopiedCodeId(group.id);
      setTimeout(() => {
        setCopiedCodeId((prev) => (prev === group.id ? null : prev));
      }, 2000);
    } catch {
      setCodeErrors((prev) => ({
        ...prev,
        [group.id]: "No se pudo copiar el codigo al portapapeles.",
      }));
    }
  };

  const handleShareCode = (group: Group) => {
    if (!group.publicCode) return;
    const message = buildShareMessage(group.name, group.publicCode);
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const handleRemoveObserver = async (group: Group, observer: GroupObserver) => {
    const confirmed = confirm(`Quitar a ${observer.email} como observador de "${group.name}"?`);
    if (!confirmed) return;

    setObserverPendingId(`remove:${group.id}:${observer.userId}`);
    setCodeErrors((prev) => ({ ...prev, [group.id]: "" }));

    try {
      await removeGroupObserver(group.id, observer.userId);
      const observers = await getGroupObservers(group.id);
      setObserversByGroup((prev) => ({ ...prev, [group.id]: observers }));
    } catch (err) {
      setCodeErrors((prev) => ({
        ...prev,
        [group.id]: getErrorMessage(err, "No se pudo quitar al observador."),
      }));
    } finally {
      setObserverPendingId(null);
    }
  };

  const handleLeaveAsObserver = async (group: Group) => {
    const confirmed = confirm(`Dejar de observar "${group.name}"?`);
    if (!confirmed) return;

    setObserverPendingId(`leave:${group.id}`);

    try {
      await leaveGroupObserver(group.id);
      await reload();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo dejar de observar el grupo."));
    } finally {
      setObserverPendingId(null);
    }
  };

  const handleJoinByCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = joinCode.trim();
    if (!code) return;

    setJoinPending(true);
    setJoinError("");
    setJoinSuccess("");

    try {
      const groupId = await joinGroupAsObserver(code);
      setJoinCode("");
      setJoinSuccess("Te uniste al grupo como observador.");
      await reload(groupId);
    } catch (err) {
      setJoinError(getErrorMessage(err, "No se pudo unirse al grupo."));
    } finally {
      setJoinPending(false);
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
              Aqui ves tus grupos propios, los compartidos y los que solo
              observas. Todos los miembros plenos pueden administrar. Los
              observadores solo ven el dashboard.
            </p>
          </div>
          <Link href="/dashboard" className="btn-secondary w-full sm:w-auto">
            Volver al inicio
          </Link>
        </header>

        <section className="surface mb-6 p-4 sm:p-5">
          <div className="flex flex-col gap-1">
            <p className="eyebrow">unirme a un grupo</p>
            <h2 className="text-lg font-black text-fijo-900">
              Ver un grupo con un codigo
            </h2>
            <p className="muted-copy text-sm">
              Si algun miembro te compartio un codigo, pegalo aca para ver su
              dashboard en modo solo lectura. No ocupas su cupo de 3 usuarios.
            </p>
          </div>
          <form
            className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"
            onSubmit={handleJoinByCode}
          >
            <input
              type="text"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase());
                setJoinError("");
                setJoinSuccess("");
              }}
              placeholder="Ej: A7KQ3XJP"
              className="field font-mono tracking-[0.2em] uppercase"
              maxLength={16}
            />
            <button
              type="submit"
              disabled={joinPending || !joinCode.trim()}
              className="btn-primary md:self-stretch"
            >
              {joinPending ? "Uniendome..." : "Unirme como observador"}
            </button>
          </form>
          {joinError && (
            <p className="mt-3 text-sm font-semibold text-red-600">{joinError}</p>
          )}
          {joinSuccess && (
            <p className="mt-3 text-sm font-semibold text-fijo-700">{joinSuccess}</p>
          )}
        </section>

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
              Crea tu primer grupo desde el inicio o pega el codigo de un
              grupo existente arriba para observarlo.
            </p>
            <Link href="/dashboard" className="btn-primary mt-6">
              Crear un grupo
            </Link>
          </section>
        ) : (
          <section className="space-y-3">
            {groups.map((group) => {
              const isObserver = group.role === "observer";
              const isEditing = editingId === group.id;
              const isPending = pendingId === group.id;
              const isActive = activeGroup?.id === group.id;
              const isOwner = group.ownerId === user?.id;
              const members = membersByGroup[group.id] ?? [];
              const observers = observersByGroup[group.id] ?? [];
              const memberCount = members.length;
              const canAddMoreMembers = memberCount < 3;
              const addPending = memberPendingId === `add:${group.id}`;
              const groupMemberError = memberErrors[group.id];
              const codeError = codeErrors[group.id];
              const codeGenPending = codePendingId === `gen:${group.id}`;
              const codeRevokePending = codePendingId === `revoke:${group.id}`;
              const leavePending = observerPendingId === `leave:${group.id}`;

              const roleLabel = isObserver
                ? "observador"
                : isOwner
                  ? "owner"
                  : "miembro";

              if (isObserver) {
                return (
                  <article key={group.id} className="surface-solid p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="break-words text-xl font-black text-fijo-900">
                            {group.name}
                          </h2>
                          {isActive && (
                            <span className="level-pill border border-fijo-200 bg-fijo-50 text-fijo-800">
                              activo
                            </span>
                          )}
                          <span className="level-pill border border-fijo-200 bg-white text-fijo-800">
                            {roleLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          Estas viendo este grupo en modo solo lectura.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLeaveAsObserver(group)}
                        disabled={leavePending}
                        className="btn-ghost min-h-10 text-sm text-red-700 hover:bg-red-50 hover:text-red-800"
                      >
                        {leavePending ? "Saliendo..." : "Dejar de observar"}
                      </button>
                    </div>
                  </article>
                );
              }

              return (
                <article key={group.id} className="surface-solid p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                            <span className="level-pill border border-fijo-200 bg-white text-fijo-800">
                              {roleLabel}
                            </span>
                            <span className="level-pill border border-fijo-100 bg-fijo-50/60 text-fijo-700">
                              {memberCount}/3 usuarios
                            </span>
                            {observers.length > 0 && (
                              <span className="level-pill border border-fijo-100 bg-fijo-50/60 text-fijo-700">
                                {observers.length} observador{observers.length === 1 ? "" : "es"}
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
                  </div>

                  <section className="mt-4 border-t border-fijo-100 pt-4">
                    <div className="mb-4">
                      <p className="text-xs font-bold text-[var(--muted)]">usuarios del grupo</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Puedes agregar hasta 3 usuarios registrados. El owner
                        original no se transfiere ni se puede quitar.
                      </p>
                    </div>

                    {membersLoading ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="skeleton h-12" />
                        <div className="skeleton h-12" />
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-2 md:grid-cols-2">
                          {members.map((member) => {
                            const removePending =
                              memberPendingId === `remove:${group.id}:${member.userId}`;

                            return (
                              <div
                                key={member.userId}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-fijo-100 bg-white/70 px-3 py-3"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-bold text-fijo-900">
                                      {member.email}
                                    </p>
                                    {member.userId === user?.id && (
                                      <span className="level-pill border border-fijo-100 bg-fijo-50 text-fijo-700">
                                        vos
                                      </span>
                                    )}
                                    <span className="level-pill border border-fijo-200 bg-white text-fijo-800">
                                      {member.isOwner ? "owner" : "miembro"}
                                    </span>
                                  </div>
                                </div>

                                {!member.isOwner && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMember(group, member)}
                                    disabled={Boolean(memberPendingId)}
                                    className="btn-ghost min-h-10 text-sm text-red-700 hover:bg-red-50 hover:text-red-800"
                                  >
                                    {removePending ? "Quitando..." : "Quitar"}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {groupMemberError && (
                          <p className="mt-3 text-sm font-semibold text-red-600">
                            {groupMemberError}
                          </p>
                        )}

                        {canAddMoreMembers ? (
                          <form
                            className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"
                            onSubmit={async (event) => {
                              event.preventDefault();
                              await handleAddMember(group.id);
                            }}
                          >
                            <label className="block">
                              <span className="mb-2 block text-sm font-bold text-[var(--ink-soft)]">
                                Agregar usuario por correo
                              </span>
                              <input
                                type="email"
                                value={memberEmails[group.id] ?? ""}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setMemberEmails((prev) => ({
                                    ...prev,
                                    [group.id]: value,
                                  }));
                                  setMemberErrors((prev) => ({
                                    ...prev,
                                    [group.id]: "",
                                  }));
                                }}
                                placeholder="correo@ejemplo.com"
                                className="field"
                              />
                              <span className="mt-2 block text-sm text-[var(--muted)]">
                                El usuario ya tiene que haber entrado a la app al
                                menos una vez.
                              </span>
                            </label>
                            <button
                              type="submit"
                              disabled={addPending || !memberEmails[group.id]?.trim()}
                              className="btn-primary md:self-end"
                            >
                              {addPending ? "Agregando..." : "Agregar usuario"}
                            </button>
                          </form>
                        ) : (
                          <p className="mt-4 text-sm font-semibold text-[var(--muted)]">
                            Este grupo ya completo sus 3 usuarios.
                          </p>
                        )}
                      </>
                    )}
                  </section>

                  <section className="mt-4 border-t border-fijo-100 pt-4">
                    <div className="mb-3 flex flex-col gap-1">
                      <p className="text-xs font-bold text-[var(--muted)]">codigo de solo lectura</p>
                      <p className="text-sm text-[var(--muted)]">
                        Comparti este codigo con cualquier persona logueada en la
                        app para que pueda ver el dashboard del grupo sin ocupar
                        cupo de miembros.
                      </p>
                    </div>

                    {group.publicCode ? (
                      <div className="flex flex-col gap-3 rounded-lg border border-fijo-100 bg-white/70 p-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--muted)]">codigo actual</p>
                          <p className="mt-1 break-all font-mono text-2xl font-black tracking-[0.3em] text-fijo-900">
                            {group.publicCode}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(group)}
                            className="btn-secondary min-h-10 px-3 py-2 text-sm"
                          >
                            {copiedCodeId === group.id ? "Copiado!" : "Copiar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShareCode(group)}
                            className="btn-secondary min-h-10 px-3 py-2 text-sm"
                          >
                            WhatsApp
                          </button>
                          <button
                            type="button"
                            onClick={() => handleGenerateCode(group)}
                            disabled={codeGenPending}
                            className="btn-ghost min-h-10 text-sm"
                          >
                            {codeGenPending ? "Regenerando..." : "Regenerar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevokeCode(group)}
                            disabled={codeRevokePending}
                            className="btn-ghost min-h-10 text-sm text-red-700 hover:bg-red-50 hover:text-red-800"
                          >
                            {codeRevokePending ? "Revocando..." : "Revocar"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleGenerateCode(group)}
                        disabled={codeGenPending}
                        className="btn-primary min-h-10 px-3 py-2 text-sm"
                      >
                        {codeGenPending ? "Generando..." : "Generar codigo"}
                      </button>
                    )}

                    {codeError && (
                      <p className="mt-3 text-sm font-semibold text-red-600">
                        {codeError}
                      </p>
                    )}

                    {observers.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-bold text-[var(--muted)]">observadores actuales</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          {observers.map((observer) => {
                            const removePending =
                              observerPendingId === `remove:${group.id}:${observer.userId}`;
                            return (
                              <div
                                key={observer.userId}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-fijo-100 bg-white/70 px-3 py-3"
                              >
                                <p className="truncate text-sm font-bold text-fijo-900">
                                  {observer.email}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveObserver(group, observer)}
                                  disabled={Boolean(observerPendingId)}
                                  className="btn-ghost min-h-10 text-sm text-red-700 hover:bg-red-50 hover:text-red-800"
                                >
                                  {removePending ? "Quitando..." : "Quitar"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </section>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </ProtectedRoute>
  );
}
