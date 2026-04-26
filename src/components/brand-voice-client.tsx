"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { BrandVoice } from "@/types";

const SAMPLE_PLACEHOLDERS = [
  "请输入品牌内容示例...",
  "请输入品牌内容示例...",
  "请输入品牌内容示例...",
  "请输入品牌内容示例...",
  "请输入品牌内容示例...",
];

interface BrandVoiceFormData {
  name: string;
  description: string;
  guidelines: string;
  samples: string[];
}

export function BrandVoiceClient({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [brandVoices, setBrandVoices] = useState<BrandVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [guidelines, setGuidelines] = useState("");
  const [samples, setSamples] = useState(["", "", "", "", ""]);

  // Load brand voices
  useEffect(() => {
    fetch(`/api/brand-voices`)
      .then((r) => r.json())
      .then((data) => {
        setBrandVoices(data);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load brand voices");
        setLoading(false);
      });
  }, []);

  const resetForm = () => {
    setName("");
    setDescription("");
    setGuidelines("");
    setSamples(["", "", "", "", ""]);
    setEditingId(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (bv: BrandVoice) => {
    setName(bv.name);
    setDescription(bv.description || "");
    setGuidelines(bv.guidelines || "");
    try {
      const parsedSamples = JSON.parse(bv.samples);
      const paddedSamples = [...parsedSamples, ...Array(5 - parsedSamples.length).fill("")];
      setSamples(paddedSamples);
    } catch {
      setSamples(["", "", "", "", ""]);
    }
    setEditingId(bv.id);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validSamples = samples.filter((s) => s.trim().length > 0);
    if (validSamples.length === 0) {
      toast.error("请至少输入一个内容示例");
      return;
    }

    setSubmitting(true);

    const body: BrandVoiceFormData = {
      name: name.trim(),
      description: description.trim(),
      guidelines: guidelines.trim(),
      samples: validSamples,
    };

    const url = editingId ? `/api/brand-voices/${editingId}` : "/api/brand-voices";
    const method = editingId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const result = await res.json();
        if (editingId) {
          setBrandVoices((prev) =>
            prev.map((bv) => (bv.id === editingId ? result : bv))
          );
          toast.success("品牌调性已更新");
        } else {
          setBrandVoices((prev) => [result, ...prev]);
          toast.success("品牌调性已创建");
        }
        setDialogOpen(false);
        resetForm();
      } else {
        const data = await res.json();
        toast.error(data.error || "操作失败");
      }
    } catch (error) {
      toast.error("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个品牌调性吗？")) return;

    try {
      const res = await fetch(`/api/brand-voices/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setBrandVoices((prev) => prev.filter((bv) => bv.id !== id));
        toast.success("品牌调性已删除");
      } else {
        const data = await res.json();
        toast.error(data.error || data.message || "删除失败");
      }
    } catch (error) {
      toast.error("网络错误，请重试");
    }
  };

  const updateSample = (index: number, value: string) => {
    const newSamples = [...samples];
    newSamples[index] = value;
    setSamples(newSamples);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">已创建的品牌调性</h2>
        <Button onClick={openCreateDialog}>+ 新建品牌调性</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : brandVoices.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">还没有品牌调性</p>
          <Button onClick={openCreateDialog} variant="outline">
            创建第一个品牌调性
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {brandVoices.map((bv) => (
            <div
              key={bv.id}
              className="border rounded-lg p-4 space-y-3 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <h3 className="font-medium">{bv.name}</h3>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(bv)}
                  >
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(bv.id)}
                  >
                    删除
                  </Button>
                </div>
              </div>
              {bv.description && (
                <p className="text-sm text-muted-foreground">
                  {bv.description}
                </p>
              )}
              <div className="text-xs text-muted-foreground">
                {JSON.parse(bv.samples).length} 个示例内容
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <form onSubmit={handleSubmit}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "编辑品牌调性" : "新建品牌调性"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium mb-1">名称 *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：专业科技博客风格"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">描述</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="简要描述这个品牌调性的特点"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  调性指南（Dos and Don'ts）
                </label>
                <Textarea
                  value={guidelines}
                  onChange={(e) => setGuidelines(e.target.value)}
                  placeholder="例如：使用专业但易懂的语言，避免行业黑话，每段不超过3句话..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  内容示例 *（至少1个，最多5个）
                </label>
                <div className="space-y-2">
                  {samples.map((sample, index) => (
                    <Textarea
                      key={index}
                      value={sample}
                      onChange={(e) => updateSample(index, e.target.value)}
                      placeholder={SAMPLE_PLACEHOLDERS[index]}
                      rows={3}
                      className="text-sm"
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  每个示例最多 500 字符
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "保存中..." : editingId ? "更新" : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </form>
      </Dialog>
    </div>
  );
}
