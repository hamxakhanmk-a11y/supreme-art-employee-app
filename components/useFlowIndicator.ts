"use client";
import { useEffect, useRef } from "react";

// Drives the "liquid" selection pill that glides between nav items — ported
// from the Job Tracker. One shape sits behind the buttons and animates its
// position/size to whichever item is active, instead of each item painting
// its own background.
//
// The element itself is rendered in JSX (React owns the DOM); this hook only
// measures the active item and writes CSS custom properties onto the
// container, which the stylesheet animates.
//
// axis "x" -> horizontal (top nav)   sets --flow-x / --flow-w
// axis "y" -> vertical   (sidebar)   sets --flow-y / --flow-h
export function useFlowIndicator<T extends HTMLElement>(
  axis: "x" | "y",
  activeSelector: string,
  // Re-measure whenever these change (e.g. the current pathname, or the set
  // of visible items once permissions resolve).
  deps: unknown[],
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;

    const sync = () => {
      const active = box.querySelector<HTMLElement>(activeSelector);
      // Nothing selected (or the container is hidden) — collapse the pill so
      // it doesn't linger in a stale spot.
      if (!active || active.offsetParent === null) {
        box.style.setProperty(axis === "x" ? "--flow-w" : "--flow-h", "0px");
        delete box.dataset.flowPos;
        return;
      }

      // Measure against the container so padding, gaps and scroll offset are
      // all accounted for without hard-coding any of them.
      const boxRect = box.getBoundingClientRect();
      const actRect = active.getBoundingClientRect();
      const pos = axis === "x"
        ? actRect.left - boxRect.left + box.scrollLeft
        : actRect.top - boxRect.top + box.scrollTop;
      const size = axis === "x" ? actRect.width : actRect.height;

      const prev = Number(box.dataset.flowPos);
      // Only play the morph when the pill actually travels — not on the
      // first paint, and not on a resize that nudges it a pixel.
      const moved = Number.isFinite(prev) && Math.abs(prev - pos) > 1;

      box.style.setProperty(axis === "x" ? "--flow-x" : "--flow-y", `${pos}px`);
      box.style.setProperty(axis === "x" ? "--flow-w" : "--flow-h", `${size}px`);
      box.dataset.flowPos = String(pos);

      if (moved) {
        box.classList.remove("is-flowing");
        void box.offsetWidth; // reflow, so re-adding restarts the animation
        box.classList.add("is-flowing");
        clearTimeout((box as any)._flowTimer);
        (box as any)._flowTimer = setTimeout(() => box.classList.remove("is-flowing"), 460);
      }
    };

    // Measure after paint so widths are final (fonts, flex layout).
    const raf = requestAnimationFrame(sync);

    // Web fonts land after first paint and change label widths.
    (document as any).fonts?.ready?.then(sync).catch(() => {});

    // Items can wrap or resize with the window.
    window.addEventListener("resize", sync);
    // Catches label changes and items appearing once permissions resolve.
    const ro = new ResizeObserver(sync);
    ro.observe(box);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", sync);
      ro.disconnect();
      clearTimeout((box as any)._flowTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
