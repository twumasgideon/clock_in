import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { getCollection } from "./mongodb";
import type { UserDoc } from "./models";
import type { Role } from "./types";
import { toId } from "./types";

declare module "next-auth" {
  interface User {
    role?: Role;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}

if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
  console.error(
    "Missing AUTH_SECRET (or NEXTAUTH_SECRET). Set it in Vercel Environment Variables.",
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .toLowerCase()
          .trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const users = await getCollection<UserDoc>("users");
        const user = await users.findOne({ email });
        if (!user || !user.is_active) return null;

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return null;

        await users.updateOne(
          { _id: user._id },
          { $set: { last_login_at: new Date(), updated_at: new Date() } },
        );

        return {
          id: toId(user._id),
          email: user.email,
          name: user.full_name,
          role: user.role,
        };
      },
    }),
  ],
});
