import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { webpack }) => {
    // RainbowKit's default wallet set (pulled in transitively even though we pass an explicit
    // `wallets` list to getDefaultConfig -- see src/config/wagmi.ts) includes a Coinbase "Base
    // Account" smart-wallet connector, which drags in @coinbase/cdp-sdk's optional x402 payment
    // support for EVM *and* Solana. Those `@x402/*` packages are peer-optional and genuinely not
    // installed -- the SDK guards every reference behind a dynamic `import()`, expecting it to
    // fail gracefully at runtime for chains/features you don't use. Webpack still tries to
    // statically resolve the literal specifier for bundling, though, and fails the build since
    // nothing is installed at that path. We never invoke x402/Solana payment flows in this app,
    // so it's safe to tell webpack to stop trying to resolve the whole `@x402/*` scope entirely.
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));
    return config;
  },
};

export default nextConfig;
