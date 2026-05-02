"use client";

import { useState } from "react";
import { toast } from "sonner";

interface SettingsClientProps {
  workspaceId: string;
  workspaceName: string;
}

export function SettingsClient({
  workspaceId,
  workspaceName: initialName,
}: SettingsClientProps) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  const handleSaveName = async () => {
    setSaving(true);
    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      toast.success("工作空间名称已更新");
    } else {
      toast.error("保存失败");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-10">
      {/* Workspace Name */}
      <section>
        <h2 className="text-base font-medium text-foreground mb-3">工作空间名称</h2>
        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 px-3 py-2 border border-input rounded-md text-sm bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-primary transition-colors duration-100"
          />
          <button
            onClick={handleSaveName}
            disabled={saving || name === initialName}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity duration-100"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </section>
    </div>
  );
}
