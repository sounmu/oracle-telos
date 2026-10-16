import type { NextConfig } from "next";

// onnxruntime-node 는 `require(\`../bin/napi-v6/${platform}/${arch}/...\`)` 로 동적 로드되어
// 파일 트레이싱이 따라가지 못한다. 그대로 두면 Vercel 함수에 패키지가 빠져
// "Cannot find module 'onnxruntime-node'" → /api/search 500.
// 빌드 머신과 같은 플랫폼 바이너리만 넣는다 (전 플랫폼은 ~290MB 로 함수 용량 한도 초과).
const ORT = "./node_modules/.pnpm/@huggingface+transformers@*/node_modules/onnxruntime-node";
const ORT_COMMON = "./node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-common";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // transformers.js / onnxruntime 는 네이티브 바이너리를 쓰므로 번들링에서 제외
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp"],
  outputFileTracingIncludes: {
    "/api/*": [
      `${ORT}/package.json`,
      `${ORT}/dist/**/*`,
      `${ORT}/bin/napi-v6/${process.platform}/${process.arch}/**/*`,
      `${ORT_COMMON}/package.json`,
      `${ORT_COMMON}/dist/cjs/**/*`,
    ],
  },
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
