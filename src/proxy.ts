import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/feed",
    "/feed/:feedId",
    "/feed/:feedId/article/:articleId/ai-summary",
    "/feed/read-later",
    "/feed/history",
    "/feed/starred-articles",
  ],
};
