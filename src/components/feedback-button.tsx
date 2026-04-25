"use client";

import { useState } from "react";
import { MessageCircle, X, Send, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { track, analyticsConsent } from "@/lib/analytics";

type FeedbackType = "bug" | "feature" | "general";

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);

    try {
      // Track feedback submission
      track("feedback.submitted", {
        type,
        has_email: !!email,
      });

      // In production, send to feedback service
      // For now, open GitHub issue pre-filled
      const title = type === "bug" ? "[BUG] " : type === "feature" ? "[FEATURE] " : "[FEEDBACK] ";
      const body = [
        `**类型**: ${type}`,
        `**反馈**:\n${message}`,
        email ? `\n**联系邮箱**: ${email}` : "",
        `\n---\n*从 ContentOS 应用内提交*`,
      ].join("\n");

      const url = new URL("https://github.com/yourusername/marketing/issues/new");
      url.searchParams.set("title", title + message.substring(0, 50) + "...");
      url.searchParams.set("body", body);

      window.open(url.toString(), "_blank");

      setSent(true);
      toast.success("感谢您的反馈！");

      setTimeout(() => {
        setIsOpen(false);
        setSent(false);
        setMessage("");
        setEmail("");
      }, 2000);
    } catch (err) {
      toast.error("提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickFeedback = (sentiment: "positive" | "negative") => {
    track("feedback.submitted", {
      type: "quick",
      sentiment,
    });

    toast.success(sentiment === "positive" ? "很高兴您喜欢 ContentOS！" : "我们会继续改进");

    // Optionally pre-fill a GitHub issue
    const url = new URL("https://github.com/yourusername/marketing/issues/new");
    url.searchParams.set("title", `[${sentiment === "positive" ? "👍" : "👎"}] 快速反馈`);
    url.searchParams.set("body", `**反馈**: ${sentiment === "positive" ? "用户满意" : "需要改进"}\n\n---\n*从 ContentOS 应用内提交*`);
    window.open(url.toString(), "_blank");

    setIsOpen(false);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        title="发送反馈"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Feedback Dialog */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed bottom-24 right-6 z-50 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
            {sent ? (
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ThumbsUp className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  反馈已提交
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  感谢您的反馈，这将帮助我们改进 ContentOS
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    发送反馈
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Feedback */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    ContentOS 对您有用吗？
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickFeedback("positive")}
                      className="flex-1 py-2 px-3 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      有用
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickFeedback("negative")}
                      className="flex-1 py-2 px-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      需改进
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    或详细描述您的问题或建议：
                  </p>

                  {/* Feedback Type */}
                  <div className="flex gap-2 mb-3">
                    {[
                      { value: "bug", label: "Bug" },
                      { value: "feature", label: "功能建议" },
                      { value: "general", label: "其他" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setType(option.value as FeedbackType)}
                        className={`flex-1 py-1.5 px-3 text-xs rounded-lg border transition-colors ${
                          type === option.value
                            ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400"
                            : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {/* Message */}
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="描述您遇到的问题或建议..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
                    required
                  />

                  {/* Email (optional) */}
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="联系邮箱（可选）"
                    className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || !message.trim()}
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>提交中...</>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      提交反馈
                    </>
                  )}
                </button>

                {/* Privacy Notice */}
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
                  反馈将公开提交到 GitHub Issues
                </p>
              </form>
            )}
          </div>
        </>
      )}
    </>
  );
}
