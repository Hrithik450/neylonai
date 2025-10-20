import NextAuth from "next-auth";
import { db } from "@/lib/db/index";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import GoogleProvider from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  session: {
    strategy: "database",
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  cookies: {
    sessionToken: {
      name: `__Secure-authjs.session-token`,
      options: {
        domain: ".vercel.app",
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
      },
    },
  },
});
