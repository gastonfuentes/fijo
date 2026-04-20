"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserGroups, createGroup } from "@/lib/db";
import { Group } from "@/types";

export function useGroup() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGroups = useCallback(async (preferredGroupId?: string) => {
    if (!user) {
      setGroups([]);
      setActiveGroup(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const g = await getUserGroups(user.id);
    setGroups(g);
    if (g.length > 0) {
      setActiveGroup((prev) => {
        const preferredGroup = preferredGroupId
          ? g.find((group) => group.id === preferredGroupId)
          : null;

        return preferredGroup ?? prev ?? g[0];
      });
    } else {
      setActiveGroup(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGroups();
  }, [loadGroups]);

  const create = async (name: string) => {
    if (!user) return;
    const id = await createGroup(name);
    await loadGroups(id);
    return id;
  };

  return { groups, activeGroup, setActiveGroup, loading, create, reload: loadGroups };
}
