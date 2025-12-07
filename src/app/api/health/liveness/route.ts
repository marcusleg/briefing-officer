"use server";

import prisma from "@/lib/prismaClient";

const checkDatabase = async () => {
  await prisma.$queryRaw`SELECT 1`;
};

export const GET = async () => {
  try {
    await checkDatabase();

    return new Response("", { status: 200 });
  } catch (error) {
    return new Response("Service Unavailable", { status: 503 });
  }
};
