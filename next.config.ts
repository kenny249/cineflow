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
  // Keep react-pdf out of the client bundle entirely
  serverExternalPackages: ["@react-pdf/renderer"],

  // Turbopack: force the Node.js build so the browser field in react-pdf's
  // package.json doesn't swap in the browser stub (which throws on renderToBuffer)
  turbopack: {
    resolveAlias: {
      "@react-pdf/renderer": "@react-pdf/renderer/lib/react-pdf.js",
    },
  },

  // Webpack: same alias for server builds
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
