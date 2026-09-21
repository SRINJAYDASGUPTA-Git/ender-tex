import type { NextConfig } from "next";
const backendUrl = process.env.BACKEND_URL;
const nextConfig: NextConfig = {
  /* config options here */
    output: "standalone",

    allowedDevOrigins: ['192.168.0.152'],

    async rewrites() {
        return [
            {
                source: '/api/yjs/:path*',
                destination: `${backendUrl}/api/yjs/:path*`,
            },
        ];
    },
};

export default nextConfig;
