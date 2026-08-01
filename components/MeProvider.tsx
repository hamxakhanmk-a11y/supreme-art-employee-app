"use client";
import { createContext, useContext, useEffect, useState } from "react";

// Roles are data (built-ins + owner-created custom roles), so this is just a string.
export type Role = string;
export interface MeUser { id: number; email: string; name: string; role: Role }

export interface MeState {
  loading: boolean;
  authenticated: boolean;
  user: MeUser | null;
  modules: string[];
  editModules: string[];
  canEdit: boolean;
}

const DEFAULT: MeState = {
  loading: true,
  authenticated: false,
  user: null,
  modules: [],
  editModules: [],
  // Default true so edit controls don't flash-hide for the common case; a
  // view-only role flips this to false as soon as /api/auth/me resolves.
  canEdit: true,
};

const MeContext = createContext<MeState>(DEFAULT);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeState>(DEFAULT);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (!alive) return;
        if (d.authenticated) {
          setMe({
            loading: false,
            authenticated: true,
            user: d.user,
            modules: d.modules ?? [],
            editModules: d.editModules ?? [],
            canEdit: d.canEdit ?? true,
          });
        } else {
          setMe({ ...DEFAULT, loading: false });
        }
      })
      .catch(() => { if (alive) setMe({ ...DEFAULT, loading: false }); });
    return () => { alive = false; };
  }, []);

  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

export function useMe(): MeState {
  return useContext(MeContext);
}

// Whether the signed-in role can edit a given section. Pass the module key
// (e.g. "attendance", "po"). Superadmin always can; while loading we default to
// true so edit controls don't flicker for the common case. With no key it means
// "can edit anything".
export function useCanEdit(moduleKey?: string): boolean {
  const me = useContext(MeContext);
  if (me.user?.role === "superadmin") return true;
  if (me.loading) return true;
  if (!moduleKey) return me.editModules.length > 0;
  return me.editModules.includes(moduleKey);
}

// Drop-in notice for pages that are entirely about editing, shown to view-only
// roles in place of the form/controls.
export function ViewOnlyNotice({ title }: { title?: string }) {
  return (
    <div className="fade-up" style={{
      maxWidth: 560, margin: "40px auto", textAlign: "center",
      border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg)",
      padding: "32px 28px",
    }}>
      <div style={{ fontSize: 34, marginBottom: 8 }}>👁️</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title || "View-only access"}</h2>
      <p style={{ color: "var(--text2)", fontSize: 13.5, marginTop: 8, lineHeight: 1.6 }}>
        Your role can view records and reports but can’t make changes here.
        Ask an administrator if you need edit access.
      </p>
    </div>
  );
}
