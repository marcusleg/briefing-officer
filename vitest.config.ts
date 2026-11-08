import { resolve } from "path";
import { defineConfig } from "vitest/config";

const alias = { "@": resolve(__dirname, "./src") };

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
    },
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          setupFiles: ["./vitest.setup.ts"],
          fileParallelism: true,
          include: [
            "tests/unit/**/*.test.ts",
            "tests/integration/**/*.test.ts",
          ],
        },
        resolve: { alias },
      },
      {
        test: {
          name: "components",
          environment: "jsdom",
          // Node 25+ defines its own global localStorage, which is undefined
          // unless --localstorage-file is passed, and it shadows jsdom's.
          execArgv: ["--no-webstorage"],
          globals: true,
          setupFiles: ["./tests/components/setup.ts"],
          include: ["tests/components/**/*.test.tsx"],
        },
        resolve: { alias },
      },
    ],
  },
});
