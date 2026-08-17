import path from "path";
import { readFileSync, existsSync } from "fs";
import type { NextConfig } from "next";

function loadRootEnv(fileName: string, override = false) {
  const filePath = path.join(__dirname, "../..", fileName);
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    if (!value) continue;
    if (override || process.env[key] === undefined) process.env[key] = value;
  }
}

loadRootEnv(".env");
loadRootEnv(".env.local", true);

const sdkSrc = path.join(__dirname, "../../packages/sdk/src");

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse", "bullmq", "ioredis"],
  transpilePackages: [
    "@neylonai/ui",
    "@neylonai/sdk",
    "@neylonai/auth",
    "@neylonai/database",
    "@neylonai/domain",
    "@neylonai/integrations",
    "@neylonai/agent",
  ],
  // Dev: resolve SDK from source so branding edits hot-reload without a dist rebuild.
  // without requiring a manual dist rebuild + Next restart.
  webpack: (config, { dev, webpack }) => {
    // BullMQ optionally imports Valkey Glide; we use ioredis only.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@valkey\/valkey-glide$/,
      }),
    );
    if (dev) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@neylonai/sdk/react": path.join(sdkSrc, "react/index.ts"),
        "@neylonai/sdk/embed": path.join(sdkSrc, "embed.ts"),
        "@neylonai/sdk": path.join(sdkSrc, "index.ts"),
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "randomuser.me", port: "" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", port: "" },
      { protocol: "https", hostname: "images.unsplash.com", port: "" },
    ],
  },
  reactStrictMode: false,
};

export default nextConfig;
