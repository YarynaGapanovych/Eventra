import { graphqlRequest } from "@/lib/graphql";
import { LOGIN_MUTATION, REGISTER_MUTATION } from "@/lib/graphql/mutations";
import type { AuthUser, StoredAuth } from "@/lib/auth-storage";

export {
  AUTH_STORAGE_KEY,
  clearStoredAuth,
  getStoredAuth,
  setStoredAuth,
} from "@/lib/auth-storage";
export type { AuthUser, StoredAuth } from "@/lib/auth-storage";

type AuthPayloadResponse = {
  login?: { accessToken: string; user: AuthUser };
  register?: { accessToken: string; user: AuthUser };
};

export async function apiRegister(body: {
  email: string;
  password: string;
  name?: string;
}): Promise<StoredAuth> {
  const data = await graphqlRequest<AuthPayloadResponse>(REGISTER_MUTATION, {
    input: body,
  });
  const payload = data.register;
  if (!payload) {
    throw new Error("Register failed");
  }
  return { token: payload.accessToken, user: payload.user };
}

export async function apiLogin(
  email: string,
  password: string,
): Promise<StoredAuth> {
  const data = await graphqlRequest<AuthPayloadResponse>(LOGIN_MUTATION, {
    input: { email, password },
  });
  const payload = data.login;
  if (!payload) {
    throw new Error("Invalid email or password");
  }
  return { token: payload.accessToken, user: payload.user };
}
