"use client";

import { useEffect, useState } from "react";
import { buttonStyles } from "./ui";

export function CopyButton({
  text,
  label = "Copy prompt",
  variant = "primary",
}: {
  text: string;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!copied && !failed) return;
    const timeout = setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, 2000);
    return () => clearTimeout(timeout);
  }, [copied, failed]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard access can be denied (insecure origin, permissions policy).
      // Say so rather than showing a success state that didn't happen.
      setFailed(true);
    }
  };

  return (
    <button type="button" onClick={copy} className={buttonStyles[variant]}>
      {copied ? "Copied" : failed ? "Copy failed" : label}
    </button>
  );
}
