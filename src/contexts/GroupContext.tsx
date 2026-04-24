"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { getUserGroups, createGroup } from "@/lib/db";
import { Group } from "@/types";

interface GroupContextType {
  groups: Group[];
  activeGroup: Group | null;
  setActiveGroup: (g: Group) => void;
  loading: boolean;
  isReadOnly: boolean;
  createNewGroup: (name: string) => Promise<string | undefined>;
  reload: (preferredGroupId?: string) => Promise<void>;
}

const GroupContext = createContext<GroupContextType>({
  groups: [],
  activeGroup: null,
  setActiveGroup: () => {},
  loading: true,
  isReadOnly: false,
  createNewGroup: async () => undefined,
  reload: async () => {},
});

export function GroupProvider({ children }: { children: ReactNode }) {
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

        return preferredGroup ?? (prev && g.find((x) => x.id === prev.id) ? prev : g[0]);
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

  const createNewGroup = async (name: string) => {
    if (!user) return;
    try {
      const id = await createGroup(name);
      await loadGroups(id);
      return id;
    } catch (err) {
      console.error("createGroup error:", JSON.stringify(err));
      throw new Error(err instanceof Error ? err.message : JSON.stringify(err));
    }
  };

  const isReadOnly = activeGroup?.role === "observer";

  return (
    <GroupContext.Provider
      value={{ groups, activeGroup, setActiveGroup, loading, isReadOnly, createNewGroup, reload: loadGroups }}
    >
      {children}
    </GroupContext.Provider>
  );
}

export const useGroupContext = () => useContext(GroupContext);
