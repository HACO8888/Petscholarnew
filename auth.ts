import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import type { Role } from "@/db/schema";

// 這些 email 永遠視為系統管理員
const ADMIN_EMAILS = new Set(["haco.tw@gmail.com"]);
const isAdminEmail = (email?: string | null) =>
  !!email && ADMIN_EMAILS.has(email.toLowerCase());

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    // 資料庫 session：把 DB user 的 role 帶進 session（admin email 強制 admin）
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbRole = (user as { role?: Role }).role ?? "student";
        session.user.role = isAdminEmail(session.user.email) ? "admin" : dbRole;
      }
      return session;
    },
  },
  events: {
    // 登入時，若是 admin email 就把 DB 的 role 持久化為 admin
    async signIn({ user }) {
      if (isAdminEmail(user.email) && user.id) {
        await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
      }
    },
  },
  pages: {
    signIn: "/login",
  },
});
