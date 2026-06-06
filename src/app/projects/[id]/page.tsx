import { KanbanBoard } from "@/components/kanban-board";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <KanbanBoard projectId={id} />;
}
