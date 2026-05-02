"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromOnboarding = searchParams.get("onboarding") === "true";
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setLoading(true);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, clientName }),
    });

    if (res.ok) {
      const project = await res.json();
      toast.success("项目已创建");

      // Save onboarding progress
      if (fromOnboarding) {
        await fetch("/api/user/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: "project" }),
        });
        router.push("/onboarding");
      } else {
        router.push(`/projects/${project.id}`);
      }
      router.refresh();
    } else {
      const data = await res.json();
      toast.error(data.error || "创建失败");
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-xl font-semibold text-foreground tracking-tight mb-1">新建项目</h1>
      <p className="text-sm text-muted-foreground mb-6">
        为每个客户创建独立的项目空间
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            项目名称 *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md text-sm bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-primary transition-colors duration-100"
            placeholder="例如：星巴克春季活动"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            客户名称
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-md text-sm bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-primary transition-colors duration-100"
            placeholder="例如：星巴克中国"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !name}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-100"
        >
          {loading ? "创建中..." : "创建项目"}
        </button>
      </form>
    </div>
  );
}
