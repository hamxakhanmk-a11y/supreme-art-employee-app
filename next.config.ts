import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Vercel Blob storage — allow next/image to optimize/resize uploaded photos.
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.blob.vercel-storage.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  async redirects() {
    return [
      // Old leave + attendance-history routes -> new Forms / Reports structure
      { source: "/leave", destination: "/forms/approvals", permanent: false },
      { source: "/leave/apply", destination: "/forms/leave", permanent: false },
      { source: "/leave/history", destination: "/reports/leaves", permanent: false },
      { source: "/attendance/history", destination: "/reports/attendance", permanent: false },
    ];
  },
};

export default nextConfig;
