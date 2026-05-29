"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function UtmCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const source   = searchParams.get("utm_source");
    const medium   = searchParams.get("utm_medium");
    const campaign = searchParams.get("utm_campaign");
    const content  = searchParams.get("utm_content");
    const term     = searchParams.get("utm_term");

    if (source || medium || campaign) {
      try {
        const existing = JSON.parse(sessionStorage.getItem("cf_utm") ?? "{}");
        sessionStorage.setItem("cf_utm", JSON.stringify({
          ...existing,
          ...(source   && { source }),
          ...(medium   && { medium }),
          ...(campaign && { campaign }),
          ...(content  && { content }),
          ...(term     && { term }),
        }));
      } catch {}
    }
  }, [searchParams]);

  return null;
}
