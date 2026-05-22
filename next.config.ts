import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
];

const nextConfig: NextConfig = {
  // Keep react-pdf out of the client/server bundle — loaded externally by Node.js
  // at runtime so the browser field substitution never applies.
  serverExternalPackages: ["@react-pdf/renderer"],

  // Webpack fallback alias (Turbopack alias intentionally omitted — adding a
  // resolveAlias rewrites the import path so it no longer matches the
  // serverExternalPackages pattern, causing Turbopack to bundle the WASM build
  // instead of leaving it external, which crashes renderToBuffer at runtime).
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@react-pdf/renderer": require.resolve(
          "@react-pdf/renderer/lib/react-pdf.js"
        ),
      };
    }
    return config;
  },

  headers: () =>
    Promise.resolve([{ source: "/(.*)", headers: securityHeaders }]),

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
