"use client";

import { useEffect } from "react";

// Service worker is disabled. Originally added in Stage 5 for offline
// shell caching, but it causes stale-bundle problems when we ship
// fixes during active development — old SW keeps serving cached JS
// to users even after a hard refresh. Until we have a deploy cadence
// that justifies SW caching, we actively unregister any existing SW
// so users always get fresh bundles.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        for (const reg of regs) reg.unregister();
      })
      .catch(() => {});
  }, []);
  return null;
}
