import { NextRequest, NextResponse } from "next/server";
import { identityProviders } from "@neylonai/auth/identity";
import { UsersService } from "@neylonai/domain/users";
import { ensureOrganizationWorkspace } from "@neylonai/domain/billing";
import { setSessionCookie } from "@/server/auth-cookies";

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    let credential: string | undefined;

    const params = new URLSearchParams(raw);
    credential = params.get("credential") ?? undefined;

    if (!credential) {
      try {
        const json = JSON.parse(raw) as Record<string, unknown>;
        if (typeof json.credential === "string") credential = json.credential;
      } catch {
        // not JSON — already tried URL params above
      }
    }

    if (!credential) {
      return NextResponse.json(
        { success: false, data: null, error: "Missing credential" },
        { status: 400 },
      );
    }

    const google = identityProviders.get("google");
    if (!google) {
      return NextResponse.json(
        { success: false, error: "Google identity provider not configured" },
        { status: 500 },
      );
    }

    const identity = await google.verifyIdToken(credential);

    if (!identity.emailVerified) {
      return NextResponse.json(
        { success: false, data: null, error: "Email not verified" },
        { status: 400 },
      );
    }

    const { user } = await UsersService.findOrCreateGoogleUser({
      google_id: identity.googleId,
      email: identity.email,
      name: identity.name,
      picture: identity.picture,
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Failed to create or find user" },
        { status: 500 },
      );
    }

    const workspace = await ensureOrganizationWorkspace({
      userId: user.id,
      email: user.email,
      name: user.first_name || identity.name,
    });

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
      organization: {
        id: workspace.organizationId,
        slug: workspace.organizationSlug,
      },
      error: null,
    });

    await setSessionCookie(sessionUser);

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Auth failed",
      },
      { status: 400 },
    );
  }
}
