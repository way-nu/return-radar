import type {NextConfig} from "next";

// All browser calls go to /api/* on the same origin; Next proxies them to the API.
// One Cloudflare tunnel on :3000 then serves both the UI and the API over HTTPS (needed for the mic on phones).
// Local dev: API_ORIGIN=http://localhost:8000   Cluster: API_ORIGIN=http://localhost:30080
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8000";

const nextConfig: NextConfig = {
    // Tailwind v4 via its Turbopack loader (create-next-app sets this; keep it when replacing this file).
    turbopack: {
        rules: {
            "*.css": {loaders: ["@tailwindcss/turbopack"], as: "*.css"},
        },
    },
    async rewrites() {
        return [{source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*`}];
    },
};

export default nextConfig;
