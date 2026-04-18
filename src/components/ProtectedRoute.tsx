"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="surface mx-auto max-w-3xl p-6">
          <div className="skeleton h-8 w-44" />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="skeleton h-24" />
            <div className="skeleton h-24" />
            <div className="skeleton h-24" />
          </div>
          <div className="skeleton mt-5 h-40" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
