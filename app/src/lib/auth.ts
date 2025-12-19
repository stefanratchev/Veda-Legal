import { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { db } from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: {
          scope: "openid profile email User.Read",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      // Create user in database on first login
      // Azure AD may provide email in different fields depending on configuration
      const azureProfile = profile as { email?: string; preferred_username?: string; name?: string } | undefined;
      const email = user.email || azureProfile?.email || azureProfile?.preferred_username;

      if (email) {
        try {
          const existingUser = await db.user.findUnique({
            where: { email },
          });

          if (!existingUser) {
            await db.user.create({
              data: {
                email,
                name: user.name || azureProfile?.name,
                image: user.image,
                role: "EMPLOYEE",
              },
            });
          }
        } catch (error) {
          console.error("Error creating user on sign in:", error);
        }
      }
      return true;
    },
    async jwt({ token, account, profile, user }) {
      // Persist the Azure AD access token to the JWT
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
      }
      // Set email/name from user or profile on first sign-in
      // Azure AD may provide email in different fields depending on configuration
      const azureProfile = profile as { email?: string; preferred_username?: string; name?: string } | undefined;

      if (user?.email) {
        token.email = user.email;
      }
      if (user?.name) {
        token.name = user.name;
      }
      // Azure AD often provides email in preferred_username
      if (azureProfile?.email) {
        token.email = azureProfile.email;
      } else if (azureProfile?.preferred_username) {
        token.email = azureProfile.preferred_username;
      }
      if (azureProfile?.name) {
        token.name = azureProfile.name;
      }
      return token;
    },
    async session({ session, token }) {
      // Make the access token available to the client
      if (session.user) {
        session.user.name = token.name as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours - typical workday
  },
  debug: process.env.NODE_ENV === "development",
};
