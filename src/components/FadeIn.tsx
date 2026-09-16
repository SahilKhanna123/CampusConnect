"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useFadeIn } from "@/hooks/useFadeIn";

type FadeInProps = {
  children: ReactNode;
  /** "mount": fades in once on page load, staggered via `delay`.
   *  "viewport": fades in the first time it scrolls into view. */
  mode?: "mount" | "viewport";
  /** Stagger delay in ms, only meaningful in "mount" mode. */
  delay?: number;
  className?: string;
};

const DURATION_MS = 450;
const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const RISE_PX = 10;

function styleFor(visible: boolean, delay: number): CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0px)" : `translateY(${RISE_PX}px)`,
    transition: `opacity ${DURATION_MS}ms ${EASING}, transform ${DURATION_MS}ms ${EASING}`,
    transitionDelay: `${delay}ms`,
  };
}

// Shared client wrapper for both fade-in patterns used across the app. Both
// hooks below are called unconditionally on every render regardless of
// `mode` -- required so this component never violates rules of hooks no
// matter what prop it's given. When used inside a .map() (e.g. one FadeIn
// per card), each array item gets its own FadeIn component instance with
// its own hook calls -- the loop lives at the JSX-element level, not inside
// a single component's hook calls, so this is safe with a dynamic item count.
export function FadeIn({ children, mode = "viewport", delay = 0, className }: FadeInProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { ref, isVisible } = useFadeIn<HTMLDivElement>();

  const visible = mode === "mount" ? mounted : isVisible;

  return (
    <div
      ref={mode === "viewport" ? ref : undefined}
      className={className}
      style={styleFor(visible, delay)}
    >
      {children}
    </div>
  );
}
