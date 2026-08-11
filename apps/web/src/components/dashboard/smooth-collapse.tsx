"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const COLLAPSE_MS = 360;

/** Animated height/opacity collapse used by dashboard accordion sections. */
export function SmoothCollapse({
  open,
  children,
  durationMs = COLLAPSE_MS,
}: {
  open: boolean;
  children: ReactNode;
  durationMs?: number;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const measure = () => {
      setHeight(open ? el.scrollHeight : 0);
    };
    measure();

    if (!open) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, children]);

  return (
    <div
      aria-hidden={!open}
      className="overflow-hidden"
      style={{
        height,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: `height ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${Math.round(durationMs * 0.75)}ms ease`,
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
