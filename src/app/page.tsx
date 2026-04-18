"use client";

/* eslint-disable @next/next/no-img-element */

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { user, loading, loginWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-4">
        <div className="w-full max-w-md space-y-3">
          <div className="skeleton h-10 w-28" />
          <div className="skeleton h-5 w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="page-shell-wide flex min-h-[100dvh] items-center">
      <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="max-w-2xl">
          <p className="eyebrow mb-4">turno fijo, equipos claros</p>
          <h1 className="text-5xl font-black leading-[0.98] text-fijo-900 sm:text-7xl">
            fijo
          </h1>
          <p className="muted-copy mt-5 max-w-xl text-lg">
            Arma el grupo, marca quienes vienen hoy y deja que el sorteo reparta
            nivel sin discutir en el chat.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={loginWithGoogle}
              className="btn-primary group w-full sm:w-auto"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Entrar con Google
            </button>
          </div>

          <div className="mt-10 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["01", "jugadores por nivel"],
              ["02", "presentes del dia"],
              ["03", "equipos guardados"],
            ].map(([number, label]) => (
              <div key={number} className="surface-solid p-4">
                <p className="font-mono text-sm font-bold text-fijo-700">{number}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--ink-soft)]">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <aside className="surface overflow-hidden p-2">
          <div className="relative min-h-[28rem] overflow-hidden rounded-lg bg-fijo-900">
            <img
              src="https://picsum.photos/seed/fijo-cancha/960/720"
              alt="Cancha de futbol con lineas blancas"
              className="absolute inset-0 h-full w-full object-cover opacity-55"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(19,45,31,0.18),rgba(19,45,31,0.86))]" />
            <div className="absolute inset-x-6 bottom-6 rounded-lg border border-white/15 bg-white/10 p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
              <p className="text-sm font-semibold text-white/70">hoy</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="font-mono text-4xl font-black">14</p>
                  <p className="text-sm text-white/72">presentes</p>
                </div>
                <div>
                  <p className="font-mono text-4xl font-black">2</p>
                  <p className="text-sm text-white/72">equipos</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
