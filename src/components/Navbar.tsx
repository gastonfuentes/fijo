"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useGroupContext } from "@/contexts/GroupContext";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { isReadOnly } = useGroupContext();
  const pathname = usePathname();

  if (!user) return null;

  const allLinks = [
    { href: "/dashboard", label: "Inicio", editorOnly: false },
    { href: "/jugadores", label: "Jugadores", editorOnly: true },
    { href: "/sorteo", label: "Sorteo", editorOnly: true },
    { href: "/partidos", label: "Partidos", editorOnly: true },
    { href: "/grupos", label: "Grupos", editorOnly: false },
  ];

  const links = allLinks.filter((link) => !isReadOnly || !link.editorOnly);

  return (
    <nav className="sticky top-0 z-20 px-3 pt-3">
      <div className="surface mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-3 py-2 sm:flex-nowrap sm:px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-fijo-800 text-lg font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] focus:outline-none focus:ring-4 focus:ring-fijo-600/20"
          >
            f
          </Link>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-black">fijo</p>
            <p className="text-xs text-[var(--muted)]">turno y equipos</p>
          </div>
        </div>

        <div className="order-3 flex w-full items-center gap-1 overflow-x-auto rounded-lg bg-fijo-50 p-1 sm:order-none sm:w-auto">
          {links.map((link) => {
            const active = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-fijo-600/15 ${
                  active
                    ? "bg-white text-fijo-800 shadow-[0_8px_22px_-18px_rgba(27,64,41,0.7)]"
                    : "text-[var(--muted)] hover:bg-white/70 hover:text-fijo-800"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {user.user_metadata?.avatar_url && (
            <img
              src={user.user_metadata.avatar_url}
              alt={user.user_metadata?.full_name ?? "Usuario"}
              className="h-9 w-9 rounded-lg border border-fijo-100 object-cover"
              referrerPolicy="no-referrer"
            />
          )}
          <button
            onClick={logout}
            className="btn-ghost text-sm"
          >
            Salir
          </button>
        </div>
      </div>
    </nav>
  );
}
