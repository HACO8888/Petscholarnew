import { eq } from "drizzle-orm";
import Sidebar, { type SidebarData } from "@/components/Sidebar";
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
    };
  }

  return (
    <>
      <Sidebar data={sidebar} />
      <main className="max-w-7xl mx-auto w-full pt-24 pb-24 md:pb-16 px-4 md:px-margin-desktop md:pr-[calc(256px+32px)] min-h-[calc(100vh-64px)] animate-fade-in-up">
        {children}
      </main>
    </>
  );
}
