/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint plugin set is incomplete in this project; linting is run separately
  // and shouldn't block production builds / deploys.
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["@react-email/components", "react-email"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  async rewrites() {
    return [
      // Serve the tracking widget at a clean /widget.js?api_key=xyz URL
      { source: "/widget.js", destination: "/api/widget" },
    ];
  },
};

export default nextConfig;
