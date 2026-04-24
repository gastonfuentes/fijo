"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGroupContext } from "@/contexts/GroupContext";

export default function RequireEditor({ children }: { children: React.ReactNode }) {
  const { isReadOnly, loading } = useGroupContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isReadOnly) {
      router.replace("/dashboard");
    }
  }, [loading, isReadOnly, router]);

  if (isReadOnly) return null;

  return <>{children}</>;
}
