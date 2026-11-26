/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@pkb/contracts'],
  // Monorepo: let the standalone build trace files from the workspace root.
  experimental: { outputFileTracingRoot: require('path').join(__dirname, '../../') },
};
