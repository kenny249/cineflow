"use client";

import { useEffect, useState } from "react";

interface StudioBrand {
  business_name: string | null;
  logo_url: string | null;
  brand_color: string | null;
}

export function useStudioBranding(token: string, type: "board" | "review" | "client"): StudioBrand | null {
  const [brand, setBrand] = useState<StudioBrand | null>(null);
  useEffect(() => {
    fetch(`/api/studio-branding?token=${encodeURIComponent(token)}&type=${type}`)
      .then((r) => r.json())
      .then(setBrand)
      .catch(() => {});
  }, [token, type]);
  return brand;
}

// Fixed "Powered by CineFlow" badge — bottom-right corner of shared pages
export function PoweredByCineFlow() {
  return (
    <a
      href="https://usecineflow.com"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/80 px-3 py-1.5 backdrop-blur-sm transition-opacity hover:opacity-80"
    >
      <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#d4a853]/20">
        <span className="text-[8px] font-black text-[#d4a853]">C</span>
      </div>
      <span className="text-[10px] font-medium text-white/50">
        Powered by <span className="text-[#d4a853]/70 font-semibold">CineFlow</span>
      </span>
    </a>
  );
}

// Studio logo + name shown at the top of shared pages when branding is set
export function StudioBrandingBar({ brand }: { brand: StudioBrand }) {
  if (!brand.business_name && !brand.logo_url) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05]">
      {brand.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logo_url}
          alt={brand.business_name ?? "Studio"}
          className="h-8 max-w-[120px] object-contain"
        />
      )}
      {brand.business_name && (
        <span className="text-sm font-semibold text-white/80 truncate">
          {brand.business_name}
        </span>
      )}
    </div>
  );
}
