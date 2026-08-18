"use client";
import { useEffect } from "react";

/**
 * A <textarea> is a replaced element: the browser prints only the box you can
 * see and throws away anything scrolled out of view, so a long CAPA root-cause
 * or leave reason silently loses text on paper. Nothing in CSS can make a
 * textarea grow to fit its content at print time, and a tall one still won't
 * fragment across a page break.
 *
 * So just before printing we hide each textarea and drop a plain <div> holding
 * the same text next to it. A div wraps, grows and breaks across pages the way
 * a printed record needs to. Everything is torn down again afterwards, so the
 * on-screen form is untouched.
 */
const MIRROR_CLASS = "print-ta-mirror";

function clearMirrors() {
  document.querySelectorAll(`.${MIRROR_CLASS}`).forEach(n => n.remove());
  document.querySelectorAll<HTMLTextAreaElement>("textarea[data-print-mirrored]")
    .forEach(ta => ta.removeAttribute("data-print-mirrored"));
}

function buildMirrors() {
  clearMirrors();

  // "Print blank" deliberately prints empty boxes to be filled in by hand —
  // there is no typed text to rescue, and the real textarea is the box.
  if (document.body.classList.contains("print-blank")) return;

  document.querySelectorAll<HTMLTextAreaElement>("textarea").forEach(ta => {
    // A textarea inside a hidden branch (a closed modal, a screen-only action
    // bar) isn't going on the page anyway.
    if (!ta.isConnected || !ta.parentNode) return;

    const mirror = document.createElement("div");
    // Carry the textarea's own classes over so form-specific rules that target
    // them (.lf-reason and friends) style the mirror the same way.
    mirror.className = `${MIRROR_CLASS} ${ta.className}`.trim();
    mirror.setAttribute("aria-hidden", "true");
    mirror.textContent = ta.value;

    ta.setAttribute("data-print-mirrored", "");
    ta.parentNode.insertBefore(mirror, ta.nextSibling);
  });
}

export default function PrintTextareas() {
  useEffect(() => {
    window.addEventListener("beforeprint", buildMirrors);
    window.addEventListener("afterprint", clearMirrors);

    // Safari has only recently grown beforeprint/afterprint; the print media
    // query flips either way there and is harmless where both already fire.
    const mq = window.matchMedia("print");
    const onMq = (e: MediaQueryListEvent) => (e.matches ? buildMirrors() : clearMirrors());
    mq.addEventListener("change", onMq);

    return () => {
      window.removeEventListener("beforeprint", buildMirrors);
      window.removeEventListener("afterprint", clearMirrors);
      mq.removeEventListener("change", onMq);
      clearMirrors();
    };
  }, []);

  return null;
}
