import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
    allowedDevOrigins: ['192.168.0.152'],

    async rewrites() {
        return [
            {
                source: '/api/yjs/:path*',
                destination: 'http://localhost:8080/api/yjs/:path*',
            },
        ];
    },
};

export default nextConfig;
