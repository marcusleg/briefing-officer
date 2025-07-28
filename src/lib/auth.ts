import prisma from "@/lib/prismaClient";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin } from "better-auth/plugins";

const isSelfRegistrationEnabled =
  process.env.SELF_REGISTRATION_ENABLED === "true" || false;

export const auth = betterAuth({
  appName: "Briefing Officer",
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  plugins: [admin()],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (isSelfRegistrationEnabled) {
        return;
      }

      if (ctx.path !== "/sign-up/email") {
        return;
      }

      const userCount = await prisma.user.count();
      if (userCount > 0) {
        throw new APIError("FORBIDDEN", {
          message:
            "Self-registration is disabled. Please ask the administrator to create an account for you.",
        });
      }
    }),
  },
});
