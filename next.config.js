/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // We rely on `next build`'s built-in TypeScript type-checking as the gate
  // for correctness, so we skip ESLint during builds to keep the starter kit
  // dependency-light and the build deterministic. Add eslint-config-next later
  // if you want lint-on-build.
  eslint: { ignoreDuringBuilds: true },

  webpack: (config) => {
    // wagmi/viem pull in optional peer deps that only matter for connectors or
    // runtimes we don't use here:
    //   * pino-pretty / lokijs / encoding — optional logging/storage deps.
    //   * @react-native-async-storage/async-storage — referenced by MetaMask
    //     SDK only in a React Native context (we run in the browser).
    // Marking them external silences harmless "module not found" build warnings.
    // This is the standard wagmi + Next.js fix.
    config.externals.push(
      "pino-pretty",
      "lokijs",
      "encoding",
      "@react-native-async-storage/async-storage",
    );
    return config;
  },
};

module.exports = nextConfig;
