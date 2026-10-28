import { apiFetch } from "@/lib/api-fetch";
import { API_BASE } from "@/lib/tasks-api";

export async function fetchApiHealth(): Promise<true> {
  const res = await apiFetch(`${API_BASE}/health`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API health check failed (${res.status})`);
  }
  const text = await res.text();
  if (text.trim() !== "ok") {
    throw new Error("API health check failed");
  }
  return true;
}
