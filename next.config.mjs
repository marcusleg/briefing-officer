/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit .next/standalone with only the server files and node_modules the app
  // actually loads, which the container image ships instead of the full
  // dependency tree.
  output: "standalone",
  // Avoid bundling heavy Node-only deps with Turbopack. Pino pulls in
  // thread-stream (and its test assets), which confuses the bundler.
  // Externalizing keeps them as Node externals in server runtime.
  serverExternalPackages: ["pino", "thread-stream"],
};

export default nextConfig;
