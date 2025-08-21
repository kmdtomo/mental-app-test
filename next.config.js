/* eslint-disable @typescript-eslint/no-var-requires */
const { withAxiom } = require("next-axiom");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
        pathname: "/*/**",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // モジュールエイリアスの追加
    config.resolve.alias = {
      ...config.resolve.alias,
      "@opentelemetry/semantic-conventions":
        "@opentelemetry/semantic-conventions/build/cjs/index.js",
    };

    // フォールバックの設定
    config.resolve.fallback = {
      ...config.resolve.fallback,
      opentelemetry: false,
      "@opentelemetry/api": false,
      "@opentelemetry/core": false,
      "@opentelemetry/semantic-conventions": false,
    };

    // 警告の無視
    config.ignoreWarnings = [
      { module: /@opentelemetry/ },
      { module: /@trigger.dev/ },
      /Failed to parse source map/,
    ];

    return config;
  },
  // トランスパイル対象の拡張
  transpilePackages: [
    "@trigger.dev",
    "@opentelemetry/semantic-conventions",
    "@opentelemetry/api",
    "@opentelemetry/core",
  ],
};

module.exports = withAxiom(nextConfig);
