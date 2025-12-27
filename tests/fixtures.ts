import prisma from "@/lib/prismaClient";
import { APIRequestContext, test as baseTest, request } from "@playwright/test";
import fs from "fs";
import path from "path";

export * from "@playwright/test";
export const test = baseTest.extend<{}, { workerStorageState: string }>({
  // eslint-disable-next-line react-hooks/rules-of-hooks
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  workerStorageState: [
    async ({ browser }, use) => {
      const workerId = test.info().parallelIndex;
      const fileName = path.resolve(
        test.info().project.outputDir,
        `.auth/${workerId}.json`,
      );

      if (fs.existsSync(fileName)) {
        await use(fileName);
        return;
      }

      const context = await request.newContext({ storageState: undefined });

      const { email, password } = await createAccount(context, workerId);

      await context.post("http://localhost:3000/api/auth/sign-in/email", {
        data: { email, password },
      });

      await context.storageState({ path: fileName });
      await context.dispose();
      await use(fileName);
    },
    { scope: "worker" },
  ],
});

async function createAccount(context: APIRequestContext, workerId: number) {
  const email = `e2e-worker-${workerId}@example.com`;
  const name = `E2E Worker ${workerId}`;
  const password = `password${workerId}`;

  await prisma.user.deleteMany({ where: { email } });

  await context.post("http://localhost:3000/api/auth/sign-up/email", {
    data: { email, name, password },
  });

  await prisma.user.updateMany({
    where: { email },
    data: { banned: false },
  });

  return { email, name, password };
}
