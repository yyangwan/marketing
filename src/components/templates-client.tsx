"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AITemplate, TemplateVariable, TemplateVariableType } from "@/types";

interface TemplateFormData {
  name: string;
  description: string;
  template: string;
  variables: TemplateVariable[];
}

const VARIABLE_TYPE_LABELS: Record<TemplateVariableType, string> = {
  text: "单行文本",
  number: "数字",
  textarea: "多行文本",
};

export function TemplatesClient({ workspaceId }: { workspaceId: string }) {
  const [templates, setTemplates] = useState<AITemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("");
  const [variables, setVariables] = useState<TemplateVariable[]>([]);

  // Load templates
  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load templates");
        setLoading(false);
      });
  }, []);

  const resetForm = () => {
    setName("");
    setDescription("");
    setTemplate("");
    setVariables([]);
    setEditingId(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (t: AITemplate) => {
    setName(t.name);
    setDescription(t.description || "");
    setTemplate(t.template);
    try {
      const parsedVariables = JSON.parse(t.variables);
      setVariables(parsedVariables);
    } catch {
      setVariables([]);
    }
    setEditingId(t.id);
    setDialogOpen(true);
  };

  const addVariable = () => {
    const newVar: TemplateVariable = {
      id: `var-${Date.now()}`,
      name: "",
      type: "text",
      label: "",
      required: false,
    };
    setVariables([...variables, newVar]);
  };

  const updateVariable = (index: number, updates: Partial<TemplateVariable>) => {
    const newVariables = [...variables];
    newVariables[index] = { ...newVariables[index], ...updates };
    setVariables(newVariables);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const validateVariableName = (name: string): boolean => {
    // Whitelist: lowercase letters, numbers, underscore only
    return /^[a-z0-9_]+$/.test(name);
  };

  const extractVariablesFromTemplate = (): string[] => {
    const regex = /\{([a-z0-9_]+)\}/g;
    const found = new Set<string>();
    let match;
    while ((match = regex.exec(template)) !== null) {
      found.add(match[1]);
    }
    return Array.from(found);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("请输入模板名称");
      return;
    }

    if (!template.trim()) {
      toast.error("请输入模板内容");
      return;
    }

    // Validate variable names
    const varNameRegex = /^[a-z0-9_]+$/;
    for (const v of variables) {
      if (!v.name || !varNameRegex.test(v.name)) {
        toast.error(
          `变量名 "${v.name}" 无效。只能使用小写字母、数字和下划线。`
        );
        return;
      }
    }

    setSubmitting(true);

    const body: TemplateFormData = {
      name: name.trim(),
      description: description.trim(),
      template: template.trim(),
      variables,
    };

    const url = editingId ? `/api/templates/${editingId}` : "/api/templates";
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
          setTemplates((prev) =>
            prev.map((t) => (t.id === editingId ? result : t))
          );
          toast.success("模板已更新");
        } else {
          setTemplates((prev) => [result, ...prev]);
          toast.success("模板已创建");
        }
        setDialogOpen(false);
        resetForm();
      } else {
        const data = await res.json();
        toast.error(data.error || data.message || "操作失败");
      }
    } catch (error) {
      toast.error("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个模板吗？")) return;

    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        toast.success("模板已删除");
      } else {
        const data = await res.json();
        toast.error(data.error || "删除失败");
      }
    } catch (error) {
      toast.error("网络错误，请重试");
    }
  };

  const detectedVars = extractVariablesFromTemplate();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">已创建的模板</h2>
        <Button onClick={openCreateDialog}>+ 新建模板</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">还没有模板</p>
          <Button onClick={openCreateDialog} variant="outline">
            创建第一个模板
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="border rounded-lg p-4 space-y-3 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <h3 className="font-medium">{t.name}</h3>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(t)}
                  >
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(t.id)}
                  >
                    删除
                  </Button>
                </div>
              </div>
              {t.description && (
                <p className="text-sm text-muted-foreground">
                  {t.description}
                </p>
              )}
              <div className="text-xs text-muted-foreground">
                {JSON.parse(t.variables).length} 个变量
              </div>
              <div className="text-xs text-muted-foreground truncate font-mono bg-secondary/50 p-2 rounded">
                {t.template.slice(0, 100)}
                {t.template.length > 100 && "..."}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <form onSubmit={handleSubmit}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "编辑模板" : "新建模板"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  模板名称 *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：微信公众号文章"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">描述</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="简要描述这个模板的用途"
                  rows={2}
                />
              </div>

              {/* Template Content */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  模板内容 *
                </label>
                <Textarea
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder="使用 {变量名} 插入变量，例如：{title} - {company_name} 的{product_name}是一款..."
                  rows={6}
                  className="font-mono text-sm"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  使用 <code className="bg-secondary px-1 rounded">
                    {"{变量名}"}
                  </code>{" "}
                  格式插入变量
                </p>
                {/* Detected variables hint */}
                {detectedVars.length > 0 && (
                  <div className="mt-2 p-2 bg-secondary/50 rounded">
                    <p className="text-xs text-muted-foreground mb-1">
                      检测到的变量：
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {detectedVars.map((v) => (
                        <span
                          key={v}
                          className="text-xs px-2 py-1 bg-primary/10 rounded"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Variables */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">
                    变量定义
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addVariable}
                  >
                    + 添加变量
                  </Button>
                </div>
                {variables.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    暂无变量。点击上方按钮添加变量以定义表单字段。
                  </p>
                ) : (
                  <div className="space-y-3">
                    {variables.map((v, index) => (
                      <div
                        key={v.id}
                        className="flex gap-2 items-start p-3 border rounded"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex gap-2">
                            <Input
                              value={v.name}
                              onChange={(e) =>
                                updateVariable(index, { name: e.target.value })
                              }
                              placeholder="变量名 (小写字母、数字、下划线)"
                              className="font-mono text-sm flex-1"
                              required
                            />
                            <Select
                              value={v.type}
                              onValueChange={(value: TemplateVariableType) =>
                                updateVariable(index, { type: value })
                              }
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(VARIABLE_TYPE_LABELS).map(
                                  ([type, label]) => (
                                    <SelectItem key={type} value={type}>
                                      {label}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <Input
                            value={v.label || ""}
                            onChange={(e) =>
                              updateVariable(index, { label: e.target.value })
                            }
                            placeholder="显示标签（可选）"
                            className="text-sm"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeVariable(index)}
                        >
                          删除
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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
