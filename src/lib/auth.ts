import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { admin, genericOAuth } from "better-auth/plugins";

const isSelfRegistrationEnabled =
  process.env.AUTH_SELF_REGISTRATION_ENABLED === "true" || false;

export const auth = betterAuth({
  appName: "Briefing Officer",
  baseURL: process.env.BASE_URL,
  secret: process.env.AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["generic"],
    },
  },
  plugins: [
    admin({
      bannedUserMessage:
        "Your user account is awaiting approval by an administrator.",
    }),
    genericOAuth({
      config: [
        {
          providerId: "generic",
          clientId: process.env.AUTH_GENERIC_OAUTH_CLIENT_ID || "",
          clientSecret: process.env.AUTH_GENERIC_OAUTH_CLIENT_SECRET,
          discoveryUrl: process.env.AUTH_GENERIC_OAUTH_DISCOVERY_URL,
          scopes: ["profile", "email"],
          pkce: process.env.AUTH_GENERIC_OAUTH_PKCE_ENABLED === "true" || false,
        },
      ],
    }),
  ],
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") {
        return;
      }

      const userCount = await prisma.user.count();
      if (userCount === 1) {
        await grantAdminRole(ctx.body.email);
      } else if (userCount > 1 && !isSelfRegistrationEnabled) {
        await disableUserAccountUntilAdminApproval(ctx.body.email);
      }
    }),
  },
});

const grantAdminRole = async (email: string) => {
  await prisma.user.updateMany({
    where: {
      email,
    },
    data: {
      role: "admin",
    },
  });

  logger.info("Assigned 'admin' role to first user.");
};

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
