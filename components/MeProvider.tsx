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

// How often an open page on screen checks it is still signed in, so a person logged out from Admin → Users (or
// disabled) leaves without reloading. Each check is one small request, and only while the page is on screen.
const ALIVE_EVERY_MS = 15000;

// Off to the login page, saying why - by way of /api/auth/logout, which has the browser wipe this site's data on
// that computer (cookies, saved data, saved copies of pages) first. replace(), so Back doesn't return to the page.
// Once only, however many checks notice at the same moment.
let leaving = false;
function signedOutNow() {
  if (leaving || typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  leaving = true;
  const next = window.location.pathname + window.location.search;
  window.location.replace("/api/auth/logout?reason=signed_out&next=" + encodeURIComponent(next));
}

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeState>(DEFAULT);

  useEffect(() => {
    let on = true;
    const load = () => {
      fetch("/api/auth/me")
        .then(r => r.json())
        .then(d => {
          if (!on) return;
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
            setMe(prev => { if (prev.authenticated) signedOutNow(); return { ...DEFAULT, loading: false }; });
          }
        })
        .catch(() => { if (on) setMe({ ...DEFAULT, loading: false }); });
    };

    load();

    // Signed out elsewhere (Admin → Users → Log out, or disabled): any of this app's requests answered 401 means
    // the sign-in is gone - leave at once rather than on the next check.
    const origFetch = window.fetch;
    const watched: typeof window.fetch = async (input, init) => {
      const res = await origFetch(input, init);
      if (res.status === 401) {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const path = url.startsWith("http") ? new URL(url).pathname : url;
        if (path.startsWith("/api/") && !path.startsWith("/api/auth/google")) signedOutNow();
      }
      return res;
    };
    window.fetch = watched;
    // And a small check every few seconds while the page is on screen, so an idle page leaves too.
    const alive = () => {
      if (document.visibilityState !== "visible") return;
      origFetch("/api/auth/alive", { cache: "no-store" }).then(r => { if (r.status === 401) signedOutNow(); }).catch(() => {});
    };
    const timer = window.setInterval(alive, ALIVE_EVERY_MS);

    // Back (or Forward) can bring a page straight out of the browser's memory without asking the server, still
    // showing what was on it. Kept hidden until the sign-in is checked: signed out, it goes to the login unseen.
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      const root = document.documentElement;
      root.style.visibility = "hidden";
      origFetch("/api/auth/alive", { cache: "no-store" })
        .then(r => { if (r.status === 401) signedOutNow(); else { root.style.visibility = ""; load(); } })
        .catch(() => { root.style.visibility = ""; });
    };
    window.addEventListener("pageshow", onPageShow);

    // Permissions are fetched once and held for the life of the tab — if an
    // admin grants a module while this tab has been open the whole time,
    // nothing here would ever notice. Re-checking whenever the tab regains
    // focus/visibility means "grant access, tell the person to switch back
    // to the tab" is enough, instead of requiring them to know to hard-reload.
    const onFocus = () => { load(); alive(); };
    const onVisible = () => { if (document.visibilityState === "visible") { load(); alive(); } };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      on = false;
      window.clearInterval(timer);
      window.removeEventListener("pageshow", onPageShow);
      if (window.fetch === watched) window.fetch = origFetch;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
