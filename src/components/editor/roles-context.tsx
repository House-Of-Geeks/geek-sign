"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { RecipientRole } from "./types";

interface RolesContextValue {
  rolesById: Record<string, { label: string; color: string }>;
}

const RolesContext = createContext<RolesContextValue>({ rolesById: {} });

export function RolesProvider({
  roles,
  children,
}: {
  roles: RecipientRole[];
  children: ReactNode;
}) {
  const value = useMemo<RolesContextValue>(() => {
    const map: Record<string, { label: string; color: string }> = {};
    for (const r of roles) map[r.id] = { label: r.label, color: r.color };
    return { rolesById: map };
  }, [roles]);
  return <RolesContext.Provider value={value}>{children}</RolesContext.Provider>;
}

export function useRoles() {
  return useContext(RolesContext);
}
