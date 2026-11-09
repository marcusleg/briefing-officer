import logger from "@/lib/logger";
import prisma from "@/lib/prismaClient";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
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
  databaseHooks: {
    user: {
      create: {
        // A database hook rather than an after-hook on the sign-up endpoint:
        // when the email is already registered, Better Auth answers sign-up
        // with a fake success and creates nothing, and an endpoint hook would
        // then act on the existing account. This only runs when a user row is
        // really being inserted, and sets the role or hold in the same write.
        before: async (user, ctx) => {
          // Users created through SSO or by an admin are not affected.
          if (ctx?.path !== "/sign-up/email") {
            return;
          }

          if ((await prisma.user.count()) === 0) {
            logger.info("Assigning 'admin' role to first user.");
            return { data: { ...user, role: "admin" } };
          }

          if (!isSelfRegistrationEnabled) {
            logger.info("New user account is pending administrator approval.");
            return {
              data: {
                ...user,
                banned: true,
                banExpires: null,
                banReason: "Account is awaiting approval by an administrator.",
              },
            };
          }
        },
      },
    },
  },
});
