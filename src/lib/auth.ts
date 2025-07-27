import prisma from "@/lib/prismaClient";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";

export const auth = betterAuth({
  appName: "Briefing Officer",
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  plugins: [admin()],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
});
