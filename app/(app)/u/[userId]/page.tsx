import { notFound, redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  users,
  posts,
  pets,
  comments,
  studyRoomMembers,
  type Role,
} from "@/db/schema";
import { statusFromHp, applyHpDecay } from "@/lib/pet";
import PetMascot from "@/components/PetMascot";

const ROLE_BADGES: Record<Role, { label: string; cls: string }> = {
  student: { label: "學生", cls: "bg-surface-container text-on-surface-variant" },
  ta: { label: "課程助教", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  professor: { label: "課程教授", cls: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" },
  admin: { label: "系統管理員", cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  // 需登入才能瀏覽公開檔案
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { userId } = await params;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      department: users.department,
      role: users.role,
      petStyle: users.petStyle,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    notFound();
  }

  // 寵物：名稱 / 等級 / HP（決定表情）/ 配件（PetMascot 呈現用）
  const [pet] = await db
    .select({
      name: pets.name,
      level: pets.level,
      hp: pets.hp,
      maxHp: pets.maxHp,
      hpUpdatedAt: pets.hpUpdatedAt,
      equippedHat: pets.equippedHat,
      equippedBackground: pets.equippedBackground,
      equippedRareStyle: pets.equippedRareStyle,
    })
    .from(pets)
    .where(eq(pets.userId, userId))
    .limit(1);

  // 公開統計（皆排除被隱藏內容）：貼文數、被採納解答數、加入的自習室數
  const [{ postCount }] = await db
    .select({ postCount: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.authorId, userId), eq(posts.hidden, false)));

  const [{ adoptedCount }] = await db
    .select({ adoptedCount: sql<number>`count(*)::int` })
    .from(comments)
    .where(
      and(
        eq(comments.authorId, userId),
        eq(comments.isAdopted, true),
        eq(comments.hidden, false),
      ),
    );

  const [{ roomCount }] = await db
    .select({ roomCount: sql<number>`count(*)::int` })
    .from(studyRoomMembers)
    .where(eq(studyRoomMembers.userId, userId));

  const displayName = user.name?.trim() || "未命名同學";
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const department = user.department?.trim() || "校園學術社群成員";
  const roleBadge = ROLE_BADGES[(user.role as Role) ?? "student"] ?? ROLE_BADGES.student;
  const isSelf = session.user.id === user.id;

  const petName = pet?.name?.trim() || "未命名小精靈";
  // 以即時飢餓衰減後的 HP 決定表情（公開頁唯讀，不寫回；本人載入時才落地扣血）
  const liveHp = pet ? applyHpDecay(pet.hp, pet.hpUpdatedAt).hp : 0;
  const petFace = pet ? statusFromHp(liveHp, pet.maxHp).face : "🙂";

  const stats = [
    {
      key: "posts",
      icon: "forum",
      value: postCount,
      label: "發表提問",
      fg: "text-secondary",
    },
    {
      key: "adopted",
      icon: "verified",
      value: adoptedCount,
      label: "被採納解答",
      fg: "text-primary",
    },
    {
      key: "rooms",
      icon: "groups",
      value: roomCount,
      label: "加入自習室",
      fg: "text-tertiary",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl flex flex-col gap-xl">
      {/* 檔案頭部 */}
      <section className="bg-surface-container-low rounded-xl p-lg shadow-sm flex flex-col items-center gap-lg sm:flex-row sm:items-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary-container rounded-full blur-3xl opacity-20 -mr-12 -mt-12" aria-hidden />
        <div className="absolute bottom-0 left-0 w-28 h-28 bg-tertiary-container rounded-full blur-3xl opacity-20 -ml-10 -mb-10" aria-hidden />
        <div className="relative z-10 shrink-0">
          {user.image ? (
            <img
              alt={displayName}
              className="w-28 h-28 rounded-full border-4 border-surface shadow-md object-cover"
              src={user.image}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-28 h-28 rounded-full border-4 border-surface shadow-md bg-primary-container text-on-primary-container flex items-center justify-center font-headline-lg text-headline-lg select-none">
              {avatarInitial || (
                <span className="material-symbols-outlined" style={{ fontSize: "44px" }}>
                  person
                </span>
              )}
            </div>
          )}
        </div>

        <div className="relative z-10 flex-1 min-w-0 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-sm sm:justify-start">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight break-words">
              {displayName}
            </h1>
            <span className={`text-label-md font-bold px-2 py-0.5 rounded ${roleBadge.cls}`}>
              {roleBadge.label}
            </span>
            {isSelf && (
              <span className="text-label-md font-medium px-2 py-0.5 rounded bg-primary-container text-on-primary-container">
                這是你
              </span>
            )}
          </div>
          <p className="inline-flex items-center gap-1 font-body-md text-body-md text-secondary mt-sm break-words">
            <span className="material-symbols-outlined text-[18px] icon-fill" aria-hidden>school</span>
            {department}
          </p>
          {pet && (
            <p className="hidden sm:flex items-center gap-1 font-label-md text-label-md text-on-tertiary-container mt-sm">
              <span className="inline-flex items-center gap-1 bg-tertiary-container px-2.5 py-1 rounded-full font-bold">
                <span className="material-symbols-outlined text-[16px] icon-fill" aria-hidden>star</span>
                Lv. {pet.level}・{petName}
              </span>
            </p>
          )}
        </div>
      </section>

      {/* 公開統計 */}
      <section className="flex flex-col gap-md">
        <h2 className="font-headline-md text-headline-md text-on-surface">學術足跡</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
          {stats.map((s) => (
            <div
              key={s.key}
              className="bg-surface-container-low rounded-xl p-lg shadow-sm flex flex-col items-center justify-center text-center border border-surface-container hover:shadow-md transition-shadow"
            >
              <span
                className={`material-symbols-outlined mb-xs ${s.fg}`}
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-hidden
              >
                {s.icon}
              </span>
              <span className="font-headline-md text-headline-md text-on-surface">
                {s.value.toLocaleString()}
              </span>
              <span className="font-label-md text-label-md text-secondary">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 學習夥伴（寵物） */}
      <section className="flex flex-col gap-md">
        <h2 className="font-headline-md text-headline-md text-on-surface">學習夥伴</h2>
        <div className="bg-surface-container-low rounded-xl p-lg shadow-sm">
          {pet ? (
            <div className="flex flex-col items-center gap-lg sm:flex-row sm:items-center">
              <div className="shrink-0">
                <PetMascot
                  petStyle={user.petStyle}
                  face={petFace}
                  equippedHat={pet.equippedHat}
                  equippedBackground={pet.equippedBackground}
                  equippedRareStyle={pet.equippedRareStyle}
                />
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <p className="font-headline-md text-headline-md text-on-surface break-words">
                  {petName}
                </p>
                <p className="font-body-md text-body-md text-secondary mt-xs">
                  陪伴 {displayName} 一起學習成長中。
                </p>
                <span className="inline-flex items-center gap-1 mt-md px-3 py-1 rounded-full bg-tertiary-container text-on-tertiary-container font-label-md text-label-md font-bold">
                  <span className="material-symbols-outlined text-[16px] icon-fill" aria-hidden>
                    star
                  </span>
                  Lv. {pet.level}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center text-secondary border border-dashed border-outline-variant rounded-lg py-lg">
              <span
                className="material-symbols-outlined text-outline mb-sm"
                style={{ fontSize: "48px" }}
                aria-hidden
              >
                pets
              </span>
              <p className="font-body-md text-body-md">這位同學還沒有領養學習夥伴。</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
