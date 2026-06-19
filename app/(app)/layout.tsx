import { eq } from "drizzle-orm";
import Sidebar, { type SidebarData } from "@/components/Sidebar";
import GuidedTour from "@/components/GuidedTour";
import { auth } from "@/auth";
import { getOrCreatePet } from "@/lib/pet";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { Role } from "@/db/schema";

const DEFAULT_SIDEBAR: SidebarData = {
  loggedIn: false,
  role: "student",
  petName: "",
  petStyle: null,
  hp: 0,
  maxHp: 0,
  coins: 0,
  equippedHat: false,
  equippedBackground: false,
  equippedRareStyle: false,
};

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  let sidebar: SidebarData = DEFAULT_SIDEBAR;

  if (session?.user?.id) {
    const pet = await getOrCreatePet(session.user.id);
    const [me] = await db
      .select({ petStyle: users.petStyle })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    sidebar = {
      loggedIn: true,
      role: (session.user.role ?? "student") as Role,
      petName: pet.name,
      petStyle: me?.petStyle ?? "classic",
      hp: pet.hp,
      maxHp: pet.maxHp,
      coins: pet.coins,
      equippedHat: pet.equippedHat,
      equippedBackground: pet.equippedBackground,
      equippedRareStyle: pet.equippedRareStyle,
    };
  }

  return (
    <>
      <Sidebar data={sidebar} />
      <main className="min-h-screen pt-14 md:pt-0 md:pl-64">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-6 md:py-8 animate-fade-in-up">
          {children}
        </div>
      </main>
      <GuidedTour role={sidebar.role} />
    </>
  );
}
