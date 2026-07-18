import type { NextAuthConfig } from "next-auth";
import type { Role } from "./types";

/**
 * Edge-compatible Auth.js config (no MongoDB / bcrypt).
 * Used by middleware on Vercel Edge Runtime.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as Role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.role = (token.role as Role) ?? "member";
        session.user.email = session.user.email ?? "";
        session.user.name = session.user.name ?? "";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
