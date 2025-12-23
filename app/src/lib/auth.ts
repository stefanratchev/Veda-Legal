import { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { db } from "./db";

/**
 * Fetch user photo from Microsoft Graph API and return as base64 data URL.
 * Returns null if photo is not available or fetch fails.
 */
async function fetchAzureADPhoto(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      // 404 means user has no photo set - this is normal
      if (response.status !== 404) {
        console.warn("Failed to fetch Azure AD photo:", response.status);
      }
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error("Error fetching Azure AD photo:", error);
    return null;
  }
}

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
    async signIn({ user, profile, account }) {
      // Whitelist check: only allow users already in the database
      // Azure AD may provide email in different fields depending on configuration
      const azureProfile = profile as { email?: string; preferred_username?: string; name?: string } | undefined;
      const email = user.email || azureProfile?.email || azureProfile?.preferred_username;

      if (!email) {
        return false;
      }

      try {
        // Check if user exists in whitelist
        const existingUser = await db.user.findUnique({
          where: { email },
          select: { id: true, status: true },
        });

        // Not in whitelist - block login
        if (!existingUser) {
          return "/login?error=NotAuthorized";
        }

        // Deactivated - block login
        if (existingUser.status === "INACTIVE") {
          return "/login?error=AccountDeactivated";
        }

        // PENDING or ACTIVE - allow login, update info from Azure AD
        // Fetch photo from Microsoft Graph API using the access token
        let photoDataUrl: string | null = null;
        if (account?.access_token) {
          photoDataUrl = await fetchAzureADPhoto(account.access_token);
        }

        await db.user.update({
          where: { id: existingUser.id },
          data: {
            status: "ACTIVE",
            name: user.name || azureProfile?.name,
            image: photoDataUrl,
            lastLogin: new Date(),
          },
        });

        return true;
      } catch (error) {
        console.error("Error during sign in check:", error);
        return false;
      }
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
