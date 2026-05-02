"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Copy, Check, ArrowRight } from "lucide-react";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

interface SettingsClientProps {
  workspaceId: string;
  workspaceName: string;
  members: Member[];
  isOwnerOrAdmin: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "所有者",
  admin: "管理员",
  member: "成员",
};

export function SettingsClient({
  workspaceId,
  workspaceName: initialName,
  members: initialMembers,
  isOwnerOrAdmin,
}: SettingsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromOnboarding = searchParams?.get("onboarding") === "true";
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState(initialMembers);

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

  const handleCreateInvite = async () => {
    setInviteLoading(true);
    setInviteLink("");
    const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });
    if (res.ok) {
      const data = await res.json();
      setInviteLink(data.inviteUrl);
      toast.success("邀请链接已生成");
    } else {
      const data = await res.json();
      toast.error(data.error || "生成失败");
    }
    setInviteLoading(false);
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    const fullUrl = `${window.location.origin}${inviteLink}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast.success("链接已复制");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCompleteOnboarding = async () => {
    if (fromOnboarding) {
      await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "invite" }),
      });
      router.push("/onboarding");
    }
  };

  const handleSkipInvite = async () => {
    await handleCompleteOnboarding();
  };

  return (
    <div className="space-y-10">
      {/* Onboarding Banner */}
      {fromOnboarding && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-medium text-foreground mb-1">
                邀请团队成员（可选）
              </h3>
              <p className="text-sm text-muted-foreground">
                与团队协作，提高内容创作效率。可以现在邀请，也可以稍后在设置中添加。
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleSkipInvite}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                跳过
              </button>
              <button
                onClick={handleCompleteOnboarding}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                下一步
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Workspace Name */}
      <section>
        <h2 className="text-base font-medium text-foreground mb-3">工作空间名称</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 px-3 py-2 border border-input rounded-md text-sm bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-primary transition-colors duration-100"
            disabled={!isOwnerOrAdmin}
          />
          {isOwnerOrAdmin && (
            <button
              onClick={handleSaveName}
              disabled={saving || name === initialName}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity duration-100"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          )}
        </div>
      </section>

      {/* Section 2: Members */}
      <section>
        <h2 className="text-base font-medium text-foreground mb-3">成员</h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有成员</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">姓名</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">角色</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">加入时间</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2">
                      <p className="text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded-sm ${
                        m.role === "owner"
                          ? "bg-primary/10 text-primary"
                          : "bg-secondary text-secondary-foreground"
                      }`}>
                        {ROLE_LABELS[m.role] || m.role}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {new Date(m.joinedAt).toLocaleDateString("zh-CN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 3: Invite (admin/owner only) */}
      {isOwnerOrAdmin && (
        <section>
          <h2 className="text-base font-medium text-foreground mb-3">邀请成员</h2>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="输入邮箱地址"
                className="flex-1 px-3 py-2 border border-input rounded-md text-sm bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-primary transition-colors duration-100"
              />
              <button
                onClick={handleCreateInvite}
                disabled={inviteLoading || !inviteEmail}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity duration-100 whitespace-nowrap"
              >
                {inviteLoading ? "生成中..." : "生成邀请链接"}
              </button>
            </div>
            {inviteLink && (
              <div className="flex items-center gap-2 p-3 bg-secondary rounded-md">
                <code className="flex-1 text-xs text-foreground font-mono truncate">
                  {inviteLink}
                </code>
                <button
                  onClick={handleCopy}
                  className="shrink-0 p-1.5 hover:bg-border rounded transition-colors duration-100"
                  title="复制链接"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              链接 7 天内有效。复制后发送给对方即可。
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
