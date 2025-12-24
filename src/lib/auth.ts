import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins";

const isSelfRegistrationEnabled =
  process.env.AUTH_SELF_REGISTRATION_ENABLED === "true" || false;

export const auth = betterAuth({
  appName: "Briefing Officer",
  baseURL: process.env.BASE_URL,
  secret: process.env.AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  plugins: [
    admin({
      bannedUserMessage:
        "Your user account is awaiting approval by an administrator.",
    }),
  ],
  emailAndPassword: {
    enabled: true,
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") {
        return;
      }

      const userCount = await prisma.user.count();
      if (userCount === 1) {
        await prisma.user.updateMany({
          data: {
            role: "admin",
          },
        });
        logger.info("Assigned 'admin' role to first user.");
      } else if (userCount > 1 && !isSelfRegistrationEnabled) {
        await disableUserAccountUntilAdminApproval(ctx.body.email);
      }
    }),
  },
});

const disableUserAccountUntilAdminApproval = async (email: string) => {
  const user = await prisma.user.update({
    where: {
      email,
    },
    data: {
      banned: true,
      banExpires: null,
      banReason: "Account is awaiting approval by an administrator.",
    },
  });

  logger.info(
    { userId: user.id },
    "New user account is pending administrator approval.",
  );
};
