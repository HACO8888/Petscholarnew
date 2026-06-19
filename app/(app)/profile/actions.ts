"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, pets, departments } from "@/db/schema";
import { getOrCreatePet } from "@/lib/pet";

const GENDERS = ["male", "female", "undisclosed"] as const;
const PET_STYLES = ["classic", "cat", "dog", "rabbit", "dragon"] as const;
const DEFAULT_PET_NAME = "未命名小精靈";

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登入");
  }
  const userId = session.user.id;

  const displayName = ((formData.get("displayName") as string | null) ?? "")
    .trim()
    .slice(0, 100);
  const petName = ((formData.get("petName") as string | null) ?? "")
    .trim()
    .slice(0, 40);
  const genderRaw = formData.get("gender") as string | null;
  const petStyleRaw = formData.get("petStyle") as string | null;
  // 科系：只接受 departments 清單內的值（空字串＝未指定→null）；
  // 不在清單內（竄改表單）一律設為 null，杜絕任意自由文字。
  const departmentRaw =
    ((formData.get("department") as string | null) ?? "").trim().slice(0, 60);
  let department: string | null = null;
  if (departmentRaw) {
    const [match] = await db
      .select({ name: departments.name })
      .from(departments)
      .where(eq(departments.name, departmentRaw))
      .limit(1);
    department = match?.name ?? null;
  }
  const bio =
    ((formData.get("bio") as string | null) ?? "").trim().slice(0, 500) || null;

  const gender =
    genderRaw && (GENDERS as readonly string[]).includes(genderRaw)
      ? genderRaw
      : null;
  const petStyle =
    petStyleRaw && (PET_STYLES as readonly string[]).includes(petStyleRaw)
      ? petStyleRaw
      : null;

  const userSet: {
    gender: string | null;
    petStyle: string | null;
    department: string | null;
    bio: string | null;
    name?: string;
  } = { gender, petStyle, department, bio };
  // 暱稱留空時維持原暱稱，不要把 name 清成 null（否則貼文作者顯示與排行榜身分會壞掉）
  if (displayName) userSet.name = displayName;

  await db.update(users).set(userSet).where(eq(users.id, userId));

  // 寵物暱稱：可編輯，留空則回到預設名
  await getOrCreatePet(userId);
  await db
    .update(pets)
    .set({ name: petName || DEFAULT_PET_NAME, updatedAt: new Date() })
    .where(eq(pets.userId, userId));

  revalidatePath("/profile");
  revalidatePath("/");
  // 暱稱/系所/造型/頭像也顯示在公開檔案與排行榜，一併重新驗證避免顯示舊值
  revalidatePath(`/u/${userId}`);
  revalidatePath("/leaderboard");
}
