import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { UsersService } from "@/actions/users/users.service";
import { setSessionCookie } from "@/lib/auth/session";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const credential = params.get("credential") ?? (await req.json().catch(() => ({})) as Record<string, string>).credential;

    if (!credential) {
      return NextResponse.json(
        { success: false, data: null, error: "Missing credential" },
        { status: 400 },
      );
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email_verified) {
      return NextResponse.json(
        { success: false, data: null, error: "Email not verified" },
        { status: 400 },
      );
    }

    const { sub: google_id, email, name = "", picture = "" } = payload;

    const { user } = await UsersService.findOrCreateGoogleUser({
      google_id: google_id!,
      email: email!,
      name,
      picture,
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Failed to create or find user" },
        { status: 500 },
      );
    }

    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.first_name,
      role: user.role,
      profile_image: user.profile_image,
    };

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      error: null,
    });

    await setSessionCookie(sessionUser);

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Auth failed" },
      { status: 400 },
    );
  }
}
