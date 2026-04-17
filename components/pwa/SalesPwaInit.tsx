"use client";

import { useEffect } from "react";

export function SalesPwaInit() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sales-pwa/sw.js", { scope: "/sales-pwa/" }).catch(() => {});
  }, []);

  return null;
}

