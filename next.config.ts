import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
