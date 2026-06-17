"use server";

import { signIn, signOut } from "@/auth";

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/profile" });
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
