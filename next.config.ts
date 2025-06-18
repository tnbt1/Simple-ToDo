import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 画像の最適化を無効化（アップロードされた画像に対して）
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
