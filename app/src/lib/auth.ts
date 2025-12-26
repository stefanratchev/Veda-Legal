import { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./schema";

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
          scope: "openid profile email User.Read Calendars.Read Mail.Read offline_access",
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
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, email),
          columns: { id: true, status: true },
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

        await db.update(users)
          .set({
            status: "ACTIVE",
            name: user.name || azureProfile?.name,
            image: photoDataUrl,
            lastLogin: new Date().toISOString(),
          })
          .where(eq(users.id, existingUser.id));

        return true;
      } catch (error) {
        console.error("Error during sign in check:", error);
        return false;
      }
    },
    async jwt({ token, account, profile, user }) {
      // Initial sign-in: store all token info
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000;
      }

      // Set email/name from user or profile on first sign-in
      const azureProfile = profile as { email?: string; preferred_username?: string; name?: string } | undefined;

      if (user?.email) {
        token.email = user.email;
      }
      if (user?.name) {
        token.name = user.name;
      }
      if (azureProfile?.email) {
        token.email = azureProfile.email;
      } else if (azureProfile?.preferred_username) {
        token.email = azureProfile.preferred_username;
      }
      if (azureProfile?.name) {
        token.name = azureProfile.name;
      }

      // Return existing token if not expired (with 5min buffer)
      if (token.expiresAt && Date.now() < token.expiresAt - 5 * 60 * 1000) {
        return token;
      }

      // Token expired or about to expire - refresh it
      if (token.refreshToken) {
        try {
          const response = await fetch(
            `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: process.env.AZURE_AD_CLIENT_ID!,
                client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
                grant_type: "refresh_token",
                refresh_token: token.refreshToken,
              }),
            }
          );

          const refreshed = await response.json();

          if (!response.ok) {
            console.error("Token refresh failed:", refreshed);
            return { ...token, error: "RefreshTokenError" as const };
          }

          return {
            ...token,
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token ?? token.refreshToken,
            expiresAt: Date.now() + refreshed.expires_in * 1000,
            error: undefined,
          };
        } catch (error) {
          console.error("Token refresh error:", error);
          return { ...token, error: "RefreshTokenError" as const };
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name as string;
        session.user.email = token.email as string;
      }
      session.accessToken = token.accessToken as string | undefined;
      session.error = token.error;
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
