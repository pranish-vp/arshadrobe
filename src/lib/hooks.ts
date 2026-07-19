"use client";

import { useEffect, useState } from "react";

/** Stable object URL for a Blob, revoked automatically on change/unmount. */
export function useObjectUrl(blob?: Blob | null): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
