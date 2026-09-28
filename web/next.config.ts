import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@brio/api-client', '@brio/content'],
  // Self-contained server for the Docker image (web/Dockerfile). The tracing root is
  // the monorepo root so workspace packages are bundled into the output.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '..'),
  // Dev only: the browser calls the API on its own origin (ADR 0024 §5), so `next dev`
  // proxies /api to the backend the way Caddy does in a deployed environment. Built
  // images never carry this rewrite.
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return []
    const backend = process.env.API_INTERNAL_URL ?? 'http://localhost:8080'
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }]
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    }
    return config
  },
}

export default nextConfig
