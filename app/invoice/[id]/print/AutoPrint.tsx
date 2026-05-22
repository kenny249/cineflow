"use client";

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    // Only auto-print when opened as a popup or named window from the app
    if (window.opener || window.name === "invoice-print") {
      const t = setTimeout(() => window.print(), 800);
      return () => clearTimeout(t);
    }
  }, []);

  return null;
}
