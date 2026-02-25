import { encode } from "next-auth/jwt";

export async function createSessionToken(
  email: string,
  name: string,
  secret: string
): Promise<string> {
  return encode({
    token: {
      email,
      name,
      sub: email,
    },
    secret,
    // salt defaults to "" — matches getToken() decode behavior in middleware
    // maxAge defaults to 30 days — fine for test sessions
  });
}
