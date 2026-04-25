"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wand2, Copy, Check } from "lucide-react";

const PLATFORMS = [
  { id: "wechat", name: "微信公众号", color: "#07C160", icon: "💬" },
  { id: "weibo", name: "微博", color: "#E6162D", icon: "🔥" },
  { id: "xiaohongshu", name: "小红书", color: "#FF2442", icon: "📕" },
  { id: "douyin", name: "抖音", color: "#000000", icon: "🎵" },
] as const;

type Platform = (typeof PLATFORMS)[number]["id"];

export default function PlaygroundPage() {
  const [topic, setTopic] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["wechat"]);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<Record<Platform, string>>({} as Record<Platform, string>);
  const [copied, setCopied] = useState<Platform | null>(null);

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("请输入内容主题");
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error("请至少选择一个平台");
      return;
    }

    setGenerating(true);
    setResults({} as Record<Platform, string>);

    // Simulate AI generation for playground
    setTimeout(() => {
      const mockResults: Record<Platform, string> = {
        wechat: `<h2>${topic}</h2>
<p>在当今快速变化的时代，${keyPoints || "我们需要不断思考如何进步"}。本文将深入探讨这一话题，为您提供实用的洞察和建议。</p>
<h3>核心要点</h3>
<ul>
  <li>要点一：深入分析现状与挑战</li>
  <li>要点二：探索解决方案与最佳实践</li>
  <li>要点三：总结关键建议与行动计划</li>
</ul>
<h3>深度分析</h3>
<p>通过对行业的观察和研究，我们发现...</p>
<p><strong>结论：</strong>只有持续学习和适应变化，才能在竞争中保持领先。</p>`,
        weibo: `【${topic}】${keyPoints || ""} 💡

深入分析这一话题，我们发现关键在于：

✅ 认清现状，明确方向
✅ 持续学习，不断迭代
✅ 行动至上，知行合一

这个时代不缺想法，缺的是执行力。从今天开始，用行动证明价值。#${topic.replace(/\s+/g, "")} #干货分享`,
        xiaohongshu: `${topic} ✨

💭 作为一个深度关注这个话题的人，今天来聊聊我的思考...

📌 核心观点
${keyPoints || "1. 关键在于执行力\n2. 持续迭代很重要\n3. 结果说明一切"}

🌟 实用建议
• 从小事做起，建立习惯
• 定期复盘，调整方向
• 找到同频的伙伴

📚 经验总结
经过这段时间的实践，我发现最重要的是...

#成长干货 #${topic.replace(/\s+/g, "")} #经验分享`,
        douyin: `【视频脚本：${topic}】

⏱️ 时长：60秒

🎬 [镜头1] 开场 (0-5秒)
画面：博主出镜，手势吸引注意
文案："关于${topic}，很多人都想错了..."

🎬 [镜头2] 痛点 (5-15秒)
画面：快速切换相关场景
文案："你是不是也遇到过这些问题？"

🎬 [镜头3] 方案 (15-45秒)
画面：展示3个关键步骤
${keyPoints ? `文案：keyPoints.split('\n').map((p, i) => `步骤${i+1}：${p}`).join('\n')` : `文案："今天分享3个方法，每个都经过验证..."`}

🎬 [镜头4] 总结 (45-60秒)
画面：博主总结，CTA
文案："关注我，下期分享更多干货！"

🎵 BGM：轻快节奏感
📱 字幕：重点文字高亮`,
      };

      const filteredResults: Partial<Record<Platform, string>> = {};
      selectedPlatforms.forEach((p) => {
        filteredResults[p] = mockResults[p];
      });

      setResults(filteredResults as Record<Platform, string>);
      setGenerating(false);
      toast.success("内容生成完成！");
    }, 1500);
  };

  const handleCopy = (platform: Platform, content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(platform);
    toast.success("已复制到剪贴板");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium mb-4">
              <Wand2 className="w-4 h-4" />
              交互式教程
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              ContentOS API 教程
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              无需注册，无需 API Key。直接体验 AI 内容生成的强大功能。
              输入主题，选择平台，即可生成符合平台调性的内容。
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Input Section */}
          <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                1. 输入内容主题
              </h2>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：2024年企业数字化转型的关键趋势"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                2. 添加要点（可选）
              </h2>
              <textarea
                value={keyPoints}
                onChange={(e) => setKeyPoints(e.target.value)}
                placeholder="每行一个要点，例如：&#10;• 云原生架构成为标配&#10;• AI 驱动的数据分析&#10;• 安全与合规的重要性"
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                3. 选择目标平台
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {PLATFORMS.map((platform) => {
                  const isSelected = selectedPlatforms.includes(platform.id as Platform);
                  return (
                    <button
                      key={platform.id}
                      onClick={() => togglePlatform(platform.id as Platform)}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all
                        ${isSelected
                          ? "border-current bg-opacity-10"
                          : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                        }
                      `}
                      style={{
                        borderColor: isSelected ? platform.color : undefined,
                        backgroundColor: isSelected ? `${platform.color}15` : undefined,
                      }}
                    >
                      <span className="text-xl">{platform.icon}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{platform.name}</span>
                      {isSelected && (
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: platform.color }}>
                          已选
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
              className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  开始生成
                </>
              )}
            </button>
          </div>

          {/* Output Section */}
          <div className="space-y-6">
            {Object.keys(results).length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wand2 className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400">
                  填写左侧表单并点击"开始生成"，AI 将为您创作多平台内容
                </p>
              </div>
            ) : (
              <>
                {Object.entries(results).map(([platform, content]) => {
                  const platformInfo = PLATFORMS.find((p) => p.id === platform);
                  if (!platformInfo) return null;
                  return (
                    <div
                      key={platform}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                      <div
                        className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
                        style={{ backgroundColor: `${platformInfo.color}15` }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{platformInfo.icon}</span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {platformInfo.name}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopy(platform as Platform, content)}
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                          {copied === platform ? (
                            <Check className="w-5 h-5 text-green-500" />
                          ) : (
                            <Copy className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      <div className="p-4 max-h-80 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans">
                          {content}
                        </pre>
                      </div>
                    </div>
                  );
                })}

                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
                  <h3 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-2">
                    🎉 生成完成！下一步？
                  </h3>
                  <p className="text-sm text-indigo-700 dark:text-indigo-400 mb-4">
                    这是教程演示模式。在生产环境中，ContentOS 将使用真实的 AI 模型为您生成更高质量的内容。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href="https://github.com/yourusername/marketing"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                    >
                      查看源码
                    </a>
                    <a
                      href="/docs/api"
                      className="text-sm px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 rounded-lg transition-colors"
                    >
                      阅读 API 文档
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* API Example Section */}
        <div className="mt-16 bg-gray-900 dark:bg-black rounded-xl p-8 overflow-hidden">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-4 text-gray-400 text-sm">Terminal</span>
          </div>
          <pre className="text-sm text-gray-300 overflow-x-auto">
            <code>{`# 1. 克隆项目
git clone https://github.com/yourusername/marketing.git
cd marketing

# 2. 配置环境变量
cat > .env.local << EOF
DATABASE_URL="file:./prisma/dev.db"
DEEPSEEK_API_KEY="your_api_key_here"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
EOF

# 3. 初始化并启动
npm install
npm run db:setup
npm run dev

# 4. 访问 http://localhost:3000
# 5. 创建第一个 Brief，体验 AI 内容生成`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
