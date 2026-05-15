import { API_BASE } from "@/lib/tasks-api";

type GraphqlResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const res = await fetch(`${API_BASE}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as GraphqlResponse<T>;

  if (!res.ok && !json.errors?.length) {
    throw new Error(`GraphQL request failed (${res.status})`);
  }
  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }
  if (!json.data) {
    throw new Error("Empty GraphQL response");
  }
  return json.data;
}
