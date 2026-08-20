import { TasksPanel } from "@/components/tasks-panel";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp.q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  return <TasksPanel query={query} />;
}
