"use client";

import Script from "next/script";

// IDs are set via Vercel environment variables — see .env.local.example
const META_ID    = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GOOGLE_ID  = process.env.NEXT_PUBLIC_GOOGLE_TAG_ID;
const TIKTOK_ID  = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;

export function AdPixels() {
  if (process.env.NODE_ENV !== "production") return null;

  return (
    <>
      {/* ── Meta (Facebook/Instagram) Pixel ── */}
      {META_ID && (
        <>
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
            document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init','${META_ID}');
            fbq('track','PageView');
          `}</Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img height="1" width="1" style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${META_ID}&ev=PageView&noscript=1`}
              alt="" />
          </noscript>
        </>
      )}

      {/* ── Google Tag (GA4 + Ads) ── */}
      {GOOGLE_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ID}`} strategy="afterInteractive" />
          <Script id="google-tag" strategy="afterInteractive">{`
            window.dataLayer=window.dataLayer||[];
            function gtag(){dataLayer.push(arguments);}
            gtag('js',new Date());
            gtag('config','${GOOGLE_ID}');
          `}</Script>
        </>
      )}

      {/* ── TikTok Pixel ── */}
      {TIKTOK_ID && (
        <Script id="tiktok-pixel" strategy="afterInteractive">{`
          !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
          ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
          ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
          for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
          ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
          ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};
          var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
          ttq.load('${TIKTOK_ID}');ttq.page();}(window,document,'ttq');
        `}</Script>
      )}
    </>
  );
}

// Fire a conversion event on all active pixels — call this after signup/purchase
export function trackConversion(event: "CompleteRegistration" | "Subscribe" | "StartTrial", value?: number) {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "production") return;
  // Meta
  if ((window as any).fbq) (window as any).fbq("track", event, value ? { value, currency: "USD" } : undefined);
  // Google
  if ((window as any).gtag) (window as any).gtag("event", event.toLowerCase().replace(/([A-Z])/g, "_$1").slice(1), value ? { value, currency: "USD" } : undefined);
  // TikTok
  if ((window as any).ttq) (window as any).ttq.track(event, value ? { value, currency: "USD" } : undefined);
}
