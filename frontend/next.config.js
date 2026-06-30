/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // runtime image needs no `npm install` — it just runs `node server.js`.
  output: 'standalone',
  // Same pattern as market-analysis: the browser calls /api-proxy on the web
  // server's own (public) port, and Next proxies it to the backend internally.
  // This means only the web port (4000) needs to be reachable from outside, and
  // there are no CORS issues.
  async rewrites() {
    const apiBase = process.env.API_INTERNAL_URL ?? 'http://localhost:4001';
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
