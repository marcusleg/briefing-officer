/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid bundling heavy Node-only deps with Turbopack. Pino pulls in
  // thread-stream (and its test assets), which confuses the bundler.
  // Externalizing keeps them as Node externals in server runtime.
  serverExternalPackages: ["pino", "thread-stream"],
  experimental: {
    // A navigation or server action that fails for want of a connection waits
    // and retries once it returns, instead of throwing. Together with the
    // optimistic article changes this is what lets the reader triage on a
    // patchy connection.
    useOffline: true,
  },
};

export default nextConfig;
