import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/server/auth-cookies";
import { UsersRepository } from "@neylonai/domain/users";

export async function GET() {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  // Read through to the row: the cookie payload is a login-time snapshot, so
  // onboarding progress made since then would otherwise read as stale.
  const user = await UsersRepository.findById(session.id);

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.username,
      role: user.role,
      profile_image: user.profile_image,
      has_been_onboarded: user.has_been_onboarded,
      onboarding_step: user.onboarding_step,
    },
  });
}
