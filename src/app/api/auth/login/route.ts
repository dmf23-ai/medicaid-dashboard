import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  createSessionToken,
  verifyPassword,
} from "@/lib/auth";

/**
 * POST /api/auth/login
 *
 * Body: { password: string }
 *
 * Verifies the submitted password against DASHBOARD_PASSWORD. On success sets
 * a signed, httpOnly session cookie and returns 200. On failure returns 401
 * with a generic error message (no timing leaks).
 */
export async function POST(req: Request) {
  let body: { password?: unknown } = {};
  try {
    body = (await req.json()) as { password?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const password = typeof body.password === "string" ? body.password : "";

  let ok = false;
  try {
    ok = verifyPassword(password);
  } catch (err) {
    console.error("[auth/login] configuration error:", err);
    return NextResponse.json(
      { error: "Login is not configured on the server." },
      { status: 500 },
    );
  }

  if (!ok) {
    return NextResponse.json(
      { error: "Incorrect password." },
      { status: 401 },
    );
  }

  const { token, expiresAt } = createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return NextResponse.json({ ok: true });
}
