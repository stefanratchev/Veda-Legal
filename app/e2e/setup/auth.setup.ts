import { test as setup } from "@playwright/test";
import fs from "fs";
import path from "path";
import { createSessionToken } from "../fixtures/auth";
import { TEST_USER } from "../helpers/seed-data";

const authFile = path.join(__dirname, "../.auth/user.json");

setup("generate auth state", async () => {
  const secret = process.env.NEXTAUTH_SECRET!;
  const token = await createSessionToken(
    TEST_USER.email,
    TEST_USER.name,
    secret
  );

  const storageState = {
    cookies: [
      {
        name: "next-auth.session-token",
        value: token,
        domain: "localhost",
        path: "/",
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  fs.writeFileSync(authFile, JSON.stringify(storageState, null, 2));
});
