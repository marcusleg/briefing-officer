/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid bundling heavy Node-only deps with Turbopack. Pino pulls in
  // thread-stream (and its test assets), which confuses the bundler.
  // Externalizing keeps them as Node externals in server runtime.
  serverExternalPackages: ["pino", "thread-stream"],
};

export default nextConfig;
