"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const getUserId = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Not authenticated");
  }

  return session.user.id;
};
