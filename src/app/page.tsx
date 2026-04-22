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
      <div className="login-loading">
        <div className="login-loading__inner">
          <div className="skeleton login-loading__bar login-loading__bar--title" />
          <div className="skeleton login-loading__bar" />
          <div className="skeleton login-loading__bar login-loading__bar--btn" />
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="login-root">
      {/* ── Panel izquierdo ── */}
      <div className="login-panel">
        <div className="login-panel__grid-overlay" aria-hidden="true" />

        <div className="login-content">
          <div className="login-content__top">
            <h1 className="login-wordmark">fijo</h1>
            <p className="login-tagline">turno fijo, equipos claros</p>

            <p className="login-description">
              Arma el grupo, marcá quiénes vienen hoy y dejá que el sorteo
              reparta el nivel sin discutir en el chat.
            </p>
          </div>

          <div className="login-content__mid">
            <button
              id="btn-google-login"
              onClick={loginWithGoogle}
              className="login-google-btn"
              aria-label="Iniciar sesión con Google"
            >
              <svg
                className="login-google-btn__icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
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
              <span>Continuar con Google</span>
            </button>
          </div>

          <div className="login-chips">
            {(
              [
                ["01", "jugadores por nivel"],
                ["02", "presentes del día"],
                ["03", "equipos guardados"],
              ] as [string, string][]
            ).map(([num, label]) => (
              <div key={num} className="login-chip">
                <span className="login-chip__num">{num}</span>
                <span className="login-chip__label">{label}</span>
              </div>
            ))}
          </div>

          <footer className="login-footer">
            <p>fijo &copy; {new Date().getFullYear()}</p>
          </footer>
        </div>
      </div>

      {/* ── Panel derecho — fotografía ── */}
      <aside className="login-photo" aria-hidden="true">
        <img
          src="https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=1200&q=80"
          alt="Vista aérea nocturna de una cancha de fútbol"
          className="login-photo__img"
        />
        <div className="login-photo__overlay" />

        {/* Card glassmorphism */}
        <div className="login-glass-card">
          <p className="login-glass-card__label">hoy</p>
          <div className="login-glass-card__stats">
            <div className="login-glass-card__stat">
              <span className="login-glass-card__num">14</span>
              <span className="login-glass-card__desc">presentes</span>
            </div>
            <div className="login-glass-card__divider" />
            <div className="login-glass-card__stat">
              <span className="login-glass-card__num">2</span>
              <span className="login-glass-card__desc">equipos</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
