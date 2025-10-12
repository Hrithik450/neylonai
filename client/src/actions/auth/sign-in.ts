"use server";

import { signIn } from "@/lib/auth/auth";

export async function signInWithGoogle() {
  return await signIn("google");
}
