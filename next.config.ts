import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limit referrer info sent to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS for 1 year (including subdomains)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Restrict browser features
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Basic XSS protection for older browsers
  { key: "X-XSS-Protection", value: "1; mode=block" },
];

const nextConfig: NextConfig = {
  webpack: (config) => {
    // pdfjs-dist optionally requires canvas (Node.js) — ignore it in the browser bundle
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
  headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "fastly.picsum.photos",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
