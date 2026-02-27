import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthToken } from "@/lib/auth";

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

  const expected = process.env.PERFORMER_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  // Timing-safe comparison to prevent timing attacks
  const encoder = new TextEncoder();
  const a = encoder.encode(password ?? "");
  const b = encoder.encode(expected);

  // Pad to same length for timingSafeEqual (requires equal-length buffers)
  const maxLen = Math.max(a.length, b.length);
  const paddedA = new Uint8Array(maxLen);
  const paddedB = new Uint8Array(maxLen);
  paddedA.set(a);
  paddedB.set(b);

  const { timingSafeEqual } = await import("crypto");
  const match = a.length === b.length && timingSafeEqual(paddedA, paddedB);

  if (!match) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  // Set auth cookie with crypto token
  const token = createAuthToken();
  const cookieStore = await cookies();
  cookieStore.set("performer_auth", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 86400, // 24 hours
    path: "/",
  });

  return NextResponse.json({ success: true });
}
