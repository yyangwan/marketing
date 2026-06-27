import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const isDev = process.env.NODE_ENV === "development";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        void credentials;
        return null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  cookies: {
    sessionToken: {
      name: `${isDev ? '' : '__Secure-'}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: !isDev,
        domain: isDev ? ".localhost" : undefined,
      },
    },
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name ?? undefined;
        token.email = user.email ?? undefined;
      }
      // Allow session update for workspace switching
      if (trigger === "update" && session) {
        token.workspaceId = session.workspaceId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string | undefined;
        session.user.workspaceId = token.workspaceId as string | undefined;
        session.user.role = token.role as string | undefined;
      }
      return session;
    },
  },
});
