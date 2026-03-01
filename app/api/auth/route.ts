import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { signSessionCookie } from "@/lib/auth";
import { requireEnv } from "@/lib/env";

const PERFORMER_PASSWORD = requireEnv("PERFORMER_PASSWORD");
const HMAC_KEY = randomBytes(32);

function constantTimeEqual(a: string, b: string): boolean {
  const hmacA = createHmac("sha256", HMAC_KEY).update(a).digest();
  const hmacB = createHmac("sha256", HMAC_KEY).update(b).digest();
  return timingSafeEqual(hmacA, hmacB);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { password } = body as Record<string, unknown>;
  if (typeof password !== "string") {
    return NextResponse.json({ error: "Missing password" }, { status: 400 });
  }

  if (!constantTimeEqual(password, PERFORMER_PASSWORD)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = await signSessionCookie();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const cookieStore = await cookies();
  cookieStore.set("performer_auth", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax" allows the cookie on top-level GET navigations from external
    // origins (bookmarks, shared links). "strict" would force re-login on
    // every external navigation. All mutations require POST, so "lax" CSRF
    // protection is sufficient.
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return NextResponse.json({ success: true });
}
