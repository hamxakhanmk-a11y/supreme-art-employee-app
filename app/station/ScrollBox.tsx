"use client";
import { useEffect, useRef } from "react";

// A wide table's own scroll box, sized to the screen it is on.
//
// Left to the page, a table wider than the screen puts its sideways scrollbar
// under its last row — so moving left and right meant scrolling all the way
// down first, then back up to read. Here the table scrolls inside a box whose
// bottom edge sits at the bottom of the screen, so the sideways bar is always
// in reach; the header row stays pinned at the top, the totals at the bottom.
//
// Sized by measuring rather than a fixed 70vh: these pages carry their filters
// and summary above the table, and a fixed fraction would push the box's own
// scrollbar off the bottom anyway.
export default function ScrollBox({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (!el) return;
      // Where the box starts on the page, independent of how far it is scrolled.
      const top = el.getBoundingClientRect().top + window.scrollY;
      // Whatever is left below it, but never so little the table can't be read.
      el.style.maxHeight = `${Math.max(280, window.innerHeight - top - 16)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div ref={ref} className="card scroll-box" style={{ padding: 0 }}>
      {children}
    </div>
  );
}
