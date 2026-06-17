"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

const GENDERS = ["male", "female", "undisclosed"] as const;
const PET_STYLES = ["classic", "cat", "dog", "rabbit", "dragon"] as const;

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登入");
  }

  const displayNameRaw = (formData.get("displayName") as string | null)?.trim() ?? "";
  const genderRaw = formData.get("gender") as string | null;
  const petStyleRaw = formData.get("petStyle") as string | null;

  const displayName = displayNameRaw.slice(0, 100) || null;
  const gender =
    genderRaw && (GENDERS as readonly string[]).includes(genderRaw) ? genderRaw : null;
  const petStyle =
    petStyleRaw && (PET_STYLES as readonly string[]).includes(petStyleRaw)
      ? petStyleRaw
      : null;

  await db
    .update(users)
    .set({ name: displayName, gender, petStyle })
    .where(eq(users.id, session.user.id));

  revalidatePath("/profile");
}
