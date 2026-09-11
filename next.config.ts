import type { NextConfig } from "next";
import { withAui } from "@assistant-ui/next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["jieba-wasm"],
  outputFileTracingIncludes: {
    "/api/chat": ["./Systemprompt.md"],
    "/api/dictionary/*": [
      "./data/cedict_ts.u8",
      "./data/handedict.u8",
      "./node_modules/jieba-wasm/pkg/nodejs/**/*",
    ],
  },
};

export default withAui(nextConfig);
