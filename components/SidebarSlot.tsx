"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Puts its children in the white sidebar column, under the sub-tabs (the #sidebar-slot in Sidebar.tsx), for things
// that belong to a page but are better out of its way — the Attendance Register's code legend. Not printed.
export default function SidebarSlot({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => { setEl(document.getElementById("sidebar-slot")); }, []);
  return el ? createPortal(children, el) : null;
}
