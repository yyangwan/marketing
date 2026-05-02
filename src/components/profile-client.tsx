"use client";

import { useState } from "react";
import { toast } from "sonner";

interface ProfileClientProps {
  currentName: string;
  currentEmail: string;
}

export function ProfileClient({ currentName, currentEmail }: ProfileClientProps) {
  const [name, setName] = useState(currentName);
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveName = async () => {
    if (!name.trim()) {
      toast.error("姓名不能为空");
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        toast.success("姓名已更新");
      } else {
        const data = await res.json();
        toast.error(data.error?.message || "更新失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("请填写所有密码字段");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("新密码至少 6 个字符");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        toast.success("密码已更新");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        toast.error(data.error?.message || "更新失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Name */}
      <section>
        <h2 className="text-base font-medium text-foreground mb-3">基本信息</h2>
        <div className="max-w-md space-y-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">邮箱</label>
            <input
              type="email"
              value={currentEmail}
              disabled
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-secondary/50 text-muted-foreground cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">姓名</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-3 py-2 border border-input rounded-md text-sm bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
              />
              <button
                onClick={handleSaveName}
                disabled={savingName || name.trim() === currentName}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {savingName ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Password */}
      <section>
        <h2 className="text-base font-medium text-foreground mb-3">修改密码</h2>
        <div className="max-w-md space-y-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">当前密码</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少 6 个字符"
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-card text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md text-sm bg-card text-foreground focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
            />
          </div>
          <button
            onClick={handleChangePassword}
            disabled={savingPassword}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {savingPassword ? "更新中..." : "更新密码"}
          </button>
        </div>
      </section>
    </div>
  );
}
