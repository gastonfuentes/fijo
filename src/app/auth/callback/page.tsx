"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const code = new URL(window.location.href).searchParams.get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(() => {
        router.replace("/dashboard");
      });
    } else {
      router.replace("/");
    }
  }, [router]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4">
      <div className="surface w-full max-w-sm p-6">
        <div className="skeleton h-7 w-44" />
        <div className="skeleton mt-4 h-4 w-full" />
        <div className="skeleton mt-2 h-4 w-2/3" />
      </div>
    </div>
  );
}
