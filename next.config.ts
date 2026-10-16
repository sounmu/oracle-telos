import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // transformers.js / onnxruntime 는 네이티브 바이너리를 쓰므로 번들링에서 제외
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
