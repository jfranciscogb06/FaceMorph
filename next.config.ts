import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@tensorflow/tfjs-node',
    '@vladmandic/face-api',
    'canvas',
  ],
};

export default nextConfig;
