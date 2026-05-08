const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = withSentryConfig(nextConfig, {
  org: "carreirausa",
  project: "cusahub",
  // Source maps are uploaded only when SENTRY_AUTH_TOKEN is present (CI/CD).
  // Omitting the token locally disables upload without breaking the build.
  silent: true,
  disableLogger: true,
  // Tunnels Sentry requests through /monitoring to avoid ad-blockers.
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
  hideSourceMaps: true,
  automaticVercelMonitors: false,
});
