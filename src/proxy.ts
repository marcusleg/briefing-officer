import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

// Every page under /feed requires a session, so the whole subtree is matched
// rather than enumerated. An enumeration leaves each new route unprotected
// until someone remembers to add it, which is how /feed/search,
// /feed/category/:categoryId, and the audio summary page all came to be
// missing from it.
//
// This only redirects; it does not authorize. The cookie is checked for
// presence, not validity, so each page still establishes the session itself
// and scopes its queries by user.
export const config = {
  matcher: ["/feed", "/feed/:path*"],
};
