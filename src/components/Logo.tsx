"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight ${className}`}>
      See Ya<span className="text-coral-ink">!</span>
    </span>
  );
}

/** Header lockup: a waving hand tile + the wordmark. The hand waves once on the
 *  first load of a session (gated via sessionStorage) and again on hover. */
export function Logo() {
  const [greeted, setGreeted] = useState(true);
  const handRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem("seeya:greeted")) {
        setGreeted(false);
        sessionStorage.setItem("seeya:greeted", "1");
      }
    } catch {
      /* private mode — just skip the intro */
    }
  }, []);

  function waveOnce() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;
    const el = handRef.current;
    if (!el) return;
    el.classList.remove("anim-wave");
    void el.offsetWidth; // reflow so the animation can restart
    el.classList.add("anim-wave");
  }

  return (
    <Link
      href="/"
      className="group flex items-center gap-2"
      onMouseEnter={waveOnce}
      aria-label="See Ya! home"
    >
      <span
        className={`grid h-8 w-8 place-items-center rounded-xl border-2 border-ink bg-sun text-lg ${
          greeted ? "" : "anim-logo-in"
        }`}
      >
        <span ref={handRef} className={greeted ? "" : "anim-wave"} aria-hidden>
          👋
        </span>
      </span>
      <span
        className={greeted ? "" : "anim-logo-in"}
        style={greeted ? undefined : { animationDelay: "90ms" }}
      >
        <Wordmark className="text-xl" />
      </span>
    </Link>
  );
}
