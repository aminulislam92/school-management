import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { configDefaults } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));
const serverOnlyStub = fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src,
      "server-only": serverOnlyStub,
    },
  },
  test: {
    projects: [
      {
        // npm test — fast tests, no database
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "prisma/**/*.test.ts"],
          exclude: [...configDefaults.exclude, "**/*.db.test.ts"],
        },
      },
      {
        // npm run test:db — uses DATABASE_URL from .env (your local MySQL)
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: ["src/**/*.db.test.ts"],
          env: loadEnv("test", process.cwd(), ""),
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
