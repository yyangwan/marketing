import { KanbanBoard } from "@/components/kanban-board";

export default function Home() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border bg-card">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">全部内容</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          管理你的内容从创建到发布的全流程
        </p>
      </div>
      <KanbanBoard />
    </div>
  );
}
