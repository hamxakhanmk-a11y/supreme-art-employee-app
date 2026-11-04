"use client";
import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pathToModule } from "@/components/nav-config";
import { rememberPlace } from "@/lib/usePageState";

// Notes every address the user lands on (see rememberPlace), so the top tabs and the sidebar can lead back
// to it. Renders nothing.
function Recorder() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    if (pathname === "/login") return;
    rememberPlace(pathToModule(pathname), pathname, search ? `?${search}` : "");
  }, [pathname, search]);
  return null;
}

// useSearchParams needs a Suspense boundary of its own in a layout.
export default function NavRecorder() {
  return <Suspense fallback={null}><Recorder /></Suspense>;
}
