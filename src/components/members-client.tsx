"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Check,
  Trash2,
  Shield,
  ShieldCheck,
  User,
  Mail,
  X,
} from "lucide-react";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

interface Invite {
  id: string;
  token: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  isExpired: boolean;
}

interface MembersClientProps {
  workspaceId: string;
  currentUserId: string;
  currentUserRole: string;
  members: Member[];
  invites: Invite[];
}

const ROLE_LABELS: Record<string, string> = {
  owner: "所有者",
  admin: "管理员",
  member: "成员",
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  owner: ShieldCheck,
  admin: Shield,
  member: User,
};

export function MembersClient({
  workspaceId,
  currentUserId,
  currentUserRole,
  members: initialMembers,
  invites: initialInvites,
}: MembersClientProps) {
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const isOwnerOrAdmin = currentUserRole === "owner" || currentUserRole === "admin";
  const isOwner = currentUserRole === "owner";

  // --- Role change ---
  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/members/${memberId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      );
      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
        );
        toast.success("角色已更新");
      } else {
        const data = await res.json();
        toast.error(data.error?.message || "更新失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  // --- Remove member ---
  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/members/${memberId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
        toast.success("成员已移除");
      } else {
        const data = await res.json();
        toast.error(data.error?.message || "移除失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setRemovingId(null);
      setConfirmRemoveId(null);
    }
  };

  // --- Invite ---
  const handleCreateInvite = async () => {
    setInviteLoading(true);
    setInviteLink("");
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      if (res.ok) {
        const data = await res.json();
        setInviteLink(data.inviteUrl);
        // Add to invites list
        setInvites((prev) => [
          {
            id: data.id,
            token: data.inviteUrl.split("/").pop(),
            email: inviteEmail,
            role: "member",
            expiresAt: data.expiresAt,
            createdAt: new Date().toISOString(),
            isExpired: false,
          },
          ...prev,
        ]);
        setInviteEmail("");
        toast.success("邀请链接已生成");
      } else {
        const data = await res.json();
        toast.error(data.error?.message || "生成失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    const fullUrl = `${window.location.origin}${text}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(id);
    toast.success("链接已复制");
    setTimeout(() => setCopied(""), 2000);
  };

  // --- Revoke invite ---
  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/invites/${inviteId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
        toast.success("邀请已撤销");
      } else {
        toast.error("撤销失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  return (
    <div className="space-y-8">
      {/* Members Table */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium text-foreground">
            成员 ({members.length})
          </h2>
        </div>

        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有成员</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">成员</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">角色</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">加入时间</th>
                  {isOwnerOrAdmin && (
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">操作</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const RoleIcon = ROLE_ICONS[m.role] || User;
                  const canChangeRole =
                    isOwnerOrAdmin &&
                    m.role !== "owner" &&
                    m.id !== currentUserId &&
                    (isOwner || m.role !== "admin");
                  const canRemove =
                    isOwnerOrAdmin &&
                    m.role !== "owner" &&
                    m.id !== currentUserId &&
                    (isOwner || m.role !== "admin");

                  return (
                    <tr
                      key={m.id}
                      className="border-b border-border last:border-b-0 hover:bg-secondary/20 transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <p className="text-foreground">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        {canChangeRole ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value)}
                            className="text-xs px-1.5 py-0.5 rounded-sm border border-input bg-card cursor-pointer focus:ring-1 focus:ring-ring"
                          >
                            <option value="admin">管理员</option>
                            <option value="member">成员</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-sm ${
                              m.role === "owner"
                                ? "bg-primary/10 text-primary"
                                : m.role === "admin"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-secondary text-secondary-foreground"
                            }`}
                          >
                            <RoleIcon className="w-3 h-3" />
                            {ROLE_LABELS[m.role] || m.role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {new Date(m.joinedAt).toLocaleDateString("zh-CN")}
                      </td>
                      {isOwnerOrAdmin && (
                        <td className="px-4 py-2.5 text-right">
                          {canRemove && (
                            <>
                              {confirmRemoveId === m.id ? (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-xs text-muted-foreground">确认？</span>
                                  <button
                                    onClick={() => handleRemove(m.id)}
                                    disabled={removingId === m.id}
                                    className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                  >
                                    {removingId === m.id ? "移除中..." : "确认"}
                                  </button>
                                  <button
                                    onClick={() => setConfirmRemoveId(null)}
                                    className="text-xs px-2 py-1 border rounded hover:bg-secondary"
                                  >
                                    取消
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmRemoveId(m.id)}
                                  className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="移除成员"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pending Invites */}
      {isOwnerOrAdmin && invites.length > 0 && (
        <section>
          <h2 className="text-base font-medium text-foreground mb-3">
            待处理邀请 ({invites.length})
          </h2>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className={`flex items-center justify-between px-4 py-2.5 border rounded-lg ${
                  inv.isExpired ? "border-red-200 bg-red-50/50" : "border-border"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.isExpired ? (
                        <span className="text-red-600">已过期</span>
                      ) : (
                        <>有效期至 {new Date(inv.expiresAt).toLocaleDateString("zh-CN")}</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!inv.isExpired && (
                    <button
                      onClick={() => handleCopy(`/invite/${inv.token}`, inv.id)}
                      className="p-1.5 hover:bg-secondary rounded transition-colors"
                      title="复制邀请链接"
                    >
                      {copied === inv.id ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => handleRevokeInvite(inv.id)}
                    className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="撤销邀请"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Invite Form */}
      {isOwnerOrAdmin && (
        <section>
          <h2 className="text-base font-medium text-foreground mb-3">邀请新成员</h2>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="输入邮箱地址"
                className="flex-1 px-3 py-2 border border-input rounded-md text-sm bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
              />
              <button
                onClick={handleCreateInvite}
                disabled={inviteLoading || !inviteEmail}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
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
                  onClick={() => handleCopy(inviteLink, "new")}
                  className="shrink-0 p-1.5 hover:bg-border rounded transition-colors"
                  title="复制链接"
                >
                  {copied === "new" ? (
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
