"use client";

import { useState } from "react";

export function CopyButton({
  value,
  label = "Copy link",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`btn btn-ghost !px-3 !py-1.5 text-xs ${
        copied ? "!bg-mint/20 !border-mint" : ""
      } ${className}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard blocked — no-op */
        }
      }}
    >
      {copied ? (
        <>
          <span className="tick-pop text-mint" aria-hidden>
            ✓
          </span>
          Copied
        </>
      ) : (
        label
      )}
    </button>
  );
}
