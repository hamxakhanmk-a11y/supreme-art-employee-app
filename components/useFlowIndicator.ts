"use client";
import { useEffect, useRef } from "react";

// Drives the "liquid" selection pill that glides between nav items — ported
// from the Job Tracker. One shape sits behind the buttons and animates to
// whichever item is active, instead of each item painting its own background.
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
  // Changes only on real navigation. The pill animates when this changes and
  // snaps instantly otherwise — see `animate` below for why that matters.
  navKey: string,
  // Anything else that should trigger a re-measure (permissions resolving,
  // label changes). These re-measure without animating.
  deps: unknown[],
) {
  const ref = useRef<T | null>(null);
  // navKey at the last measurement. null until the first one has happened.
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box) return;

    const sync = (animate: boolean) => {
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
      const moved = Number.isFinite(prev) && Math.abs(prev - pos) > 1;

      // Snapping instead of animating matters in two very visible cases:
      //   1. First paint — the pill starts at width 0 / offset 0, so it would
      //      visibly grow out of the left edge on every page load.
      //   2. Permissions resolving — /api/auth/me returns after first paint,
      //      the nav fills out, and the active item shifts. Animating that
      //      makes the pill slide on load as though the user had navigated.
      // Suppressing the transition for one frame commits the new geometry
      // silently; re-enabling it leaves real navigation animated.
      if (!animate) box.classList.add("flow-no-anim");

      box.style.setProperty(axis === "x" ? "--flow-x" : "--flow-y", `${pos}px`);
      box.style.setProperty(axis === "x" ? "--flow-w" : "--flow-h", `${size}px`);
      box.dataset.flowPos = String(pos);

      if (!animate) {
        void box.offsetWidth; // flush the change while transitions are off
        box.classList.remove("flow-no-anim");
        return;
      }

      // The morph only plays when the pill actually travels.
      if (moved) {
        box.classList.remove("is-flowing");
        void box.offsetWidth; // reflow, so re-adding restarts the animation
        box.classList.add("is-flowing");
        clearTimeout((box as any)._flowTimer);
        (box as any)._flowTimer = setTimeout(() => box.classList.remove("is-flowing"), 460);
      }
    };

    const animateThisRun = lastKey.current !== null && lastKey.current !== navKey;
    lastKey.current = navKey;

    // Measure after paint so widths are final (fonts, flex layout).
    const raf = requestAnimationFrame(() => sync(animateThisRun));

    // Passive re-measures never animate — they're layout settling, not the
    // user moving between tabs.
    const passive = () => sync(false);
    (document as any).fonts?.ready?.then(passive).catch(() => {});
    window.addEventListener("resize", passive);
    const ro = new ResizeObserver(passive);
    ro.observe(box);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", passive);
      ro.disconnect();
      clearTimeout((box as any)._flowTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navKey, ...deps]);

  return ref;
}
