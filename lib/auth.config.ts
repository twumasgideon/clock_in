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
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      const isAuthPage = pathname.startsWith("/login");
      const isPublicApi =
        pathname.startsWith("/api/sync") || pathname.startsWith("/api/auth");

      if (isPublicApi) return true;
      if (isAuthPage) return true;
      return isLoggedIn;
    },
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
