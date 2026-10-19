import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, RETURN_COOKIE, tokenMatches } from "@/lib/server/access";

/**
 * Locks the whole site behind the shared password. Pages redirect to the
 * unlock screen; API routes answer 401 with JSON so a fetch in the browser
 * gets a usable error instead of a login page where it expected data.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/unlock") return NextResponse.next();

  if (await tokenMatches(request.cookies.get(ACCESS_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: "This site is password protected. Reload and enter the password." },
      { status: 401 },
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  const response = NextResponse.redirect(url);
  // Remembered here rather than in the URL so the unlock page stays static.
  response.cookies.set(RETURN_COOKIE, pathname + search, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}

export const config = {
  // Everything except Next's own static output and the favicon, so the unlock
  // screen can still load its stylesheet.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)"],
};
