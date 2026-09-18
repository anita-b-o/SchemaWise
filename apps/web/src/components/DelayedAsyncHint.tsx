import { useEffect, useState, type ReactNode } from "react";

export const DELAYED_ASYNC_HINT_MS = 6_000;

interface DelayedAsyncHintProps {
  readonly active: boolean;
  readonly requestKey?: string | undefined;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly delayMs?: number;
}

export function DelayedAsyncHint({
  active,
  requestKey,
  children = "The public demo server may be waking up. Free-tier cold starts can take a little longer.",
  className = "",
  delayMs = DELAYED_ASYNC_HINT_MS,
}: DelayedAsyncHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    if (!active) return;
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs, requestKey]);

  if (!active || !visible) return null;
  return (
    <p
      className={`delayed-async-hint ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {children}
    </p>
  );
}
