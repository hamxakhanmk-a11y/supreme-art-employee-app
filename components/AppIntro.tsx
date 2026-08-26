"use client";
import { useEffect, useState } from "react";

// App intro ("Round Logo: Sliding Name") — ported from the Job Tracker app.
// The logo settles over 0.9s, the name finishes sliding in ~1.45s in, then we
// hold a beat before fading so the animation is never cut off mid-motion.
// Click anywhere to skip.
//
// Rendered by the root layout, so it plays once per full page load — Next.js
// client-side navigation keeps this component mounted and won't replay it.
// The markup is server-rendered (with the styles in globals.css) so the
// overlay is on screen from the first frame, with no flash of the app behind.

const FADE_MS = 400;

export default function AppIntro() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const holdMs = reduced ? 300 : 2600;

    let fadeTimer: ReturnType<typeof setTimeout>;
    let doneTimer: ReturnType<typeof setTimeout>;

    const finish = () => {
      setFading(true);
      doneTimer = setTimeout(() => {
        setVisible(false);
        document.documentElement.style.overflow = "";
        document.body.style.overflow = "";
      }, FADE_MS);
    };

    // Lock scroll while the intro is up. The app renders underneath the
    // overlay as it plays; if that content is taller than the viewport a
    // scrollbar appears mid-animation and eats a few px of viewport width,
    // which shows up as the centred intro visibly nudging sideways just as
    // it fades. Locking now and restoring after the fade keeps the viewport
    // width constant for the intro's whole lifetime.
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    fadeTimer = setTimeout(finish, holdMs);

    // Click anywhere to skip straight to the app.
    const skip = () => {
      clearTimeout(fadeTimer);
      finish();
    };
    const el = document.getElementById("app-intro");
    el?.addEventListener("click", skip, { once: true });

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
      el?.removeEventListener("click", skip);
      // Never leave the page unscrollable if we unmount mid-intro.
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  if (!visible) return null;

  return (
    <div id="app-intro" className={fading ? "intro-fade-out" : ""} aria-hidden="true">
      <div className="app-intro-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="app-intro-logo"><img src="/logo.png" alt="Supreme Art" /></div>
        <div className="app-intro-name">
          <div className="app-intro-name-main">Supreme Art</div>
          <div className="app-intro-name-sub">Private Limited</div>
        </div>
      </div>
    </div>
  );
}
