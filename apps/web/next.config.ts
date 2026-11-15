import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@akw/contracts','@akw/client'],
  distDir: process.env.AKW_WEB_DIST ?? '.next',
  agentRules: false,
  devIndicators: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: (process.env.AKW_API_ORIGIN ?? 'http://127.0.0.1:4100') + '/:path*' }];
  },
};
export default config;
