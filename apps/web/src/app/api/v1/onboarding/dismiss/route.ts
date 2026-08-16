import { NextRequest, NextResponse } from "next/server";
import {
  attachSessionCookie,
  getSessionFromRequest,
} from "@/server/auth-cookies";
import { UsersRepository } from "@neylonai/domain/users";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const step = typeof body.step === "number" ? body.step : undefined;

    const updated = await UsersRepository.updateUser(user.id, {
      has_been_onboarded: true,
      ...(step !== undefined && { onboarding_step: step }),
    });

    const response = NextResponse.json({ success: true });
    if (updated) {
      // Keep the JWT in sync so landing SSR does not re-read a stale snapshot.
      await attachSessionCookie(response, {
        id: updated.id,
        email: updated.email,
        name: updated.username,
        role: updated.role,
        profile_image: updated.profile_image,
        has_been_onboarded: updated.has_been_onboarded,
        onboarding_step: updated.onboarding_step,
      });
    }
    return response;
  } catch (error) {
    console.error("[onboarding/dismiss]", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update",
      },
      { status: 500 },
    );
  }
}
