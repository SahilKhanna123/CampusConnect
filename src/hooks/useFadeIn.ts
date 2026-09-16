"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

interface UseFadeInOptions {
  threshold?: number;
  rootMargin?: string;
}

interface UseFadeInResult<T extends HTMLElement> {
  ref: RefObject<T | null>;
  isVisible: boolean;
}

// Viewport-triggered fade: an element fades in the first time it scrolls
// into view, then stays visible for good -- never toggles back out on
// scroll-away, via observer.unobserve() the moment it first intersects.
export function useFadeIn<T extends HTMLElement = HTMLDivElement>(
  options: UseFadeInOptions = {},
): UseFadeInResult<T> {
  const { threshold = 0.15, rootMargin = "0px 0px -80px 0px" } = options;
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(node);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return { ref, isVisible };
}
