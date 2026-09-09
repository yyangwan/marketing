const DEEPSEEK_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "";

/** 默认 120s 超时：全生命周期覆盖响应体，不在收到响应头时提前清除（设计 §13.2）。 */
const DEFAULT_TIMEOUT_MS = 120_000;

export class LLMError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public originalError: string
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export interface CallLLMOptions {
  temperature?: number;
  maxTokens?: number;
  /** 请求整个生命周期的硬超时（毫秒）。 */
  timeoutMs?: number;
  responseFormat?: { type: "json_object" };
  /** 外部取消信号（例如 worker 租约丢失时中止生成）。 */
  signal?: AbortSignal;
}

export async function callLLM(
  prompt: string,
  systemPrompt?: string,
  opts: CallLLMOptions = {}
): Promise<string> {
  if (process.env.MOCK_AI === "true" || !DEEPSEEK_KEY) {
    return mockResponse(prompt);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", onExternalAbort);
  }

  try {
    const res = await fetch(`${DEEPSEEK_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
          { role: "user", content: prompt },
        ],
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 4000,
        ...(opts.responseFormat ? { response_format: opts.responseFormat } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new LLMError(
        `LLM API error: ${res.status} ${err}`,
        res.status,
        err
      );
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new LLMError("LLM request timed out", 408, "timeout");
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (opts.signal) {
      opts.signal.removeEventListener("abort", onExternalAbort);
    }
  }
}

/** 请求 JSON 输出并解析；内容为空或非法 JSON 时抛 LLMError（不可重试的输出错误）。 */
export async function callLLMJson<T>(
  prompt: string,
  systemPrompt?: string,
  opts: CallLLMOptions = {}
): Promise<T> {
  const content = await callLLM(prompt, systemPrompt, {
    ...opts,
    responseFormat: { type: "json_object" },
  });
  if (!content) {
    throw new LLMError("LLM returned empty content", 422, "empty_content");
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new LLMError("LLM returned invalid JSON", 422, "invalid_json");
  }
}

function mockResponse(prompt: string): Promise<string> {
  const wechatMatch = prompt.match(/微信公众号/);
  const weiboMatch = prompt.match(/微博/);

  // Check if this is a quality evaluation request (via environment variable)
  const isQualityEvaluation = process.env.MOCK_QUALITY_EVALUATION === "true";

  if (isQualityEvaluation) {
    // Return mock quality evaluation JSON
    return Promise.resolve(JSON.stringify({
      quality: 7,
      engagement: 6,
      brandVoice: 7,
      platformFit: 8,
      sentiment: 7,
      topicConsistency: 7,
      originality: 6,
      suggestions: [
        "可以增加更多具体案例来增强说服力",
        "建议使用更生动的语言提升吸引力",
        "可以适当加入互动元素增加参与度"
      ]
    }));
  }

  if (wechatMatch) {
    return Promise.resolve(
      `<h2>引言</h2><p>在当今数字化快速发展的时代，企业面临的竞争日益激烈。如何在这个充满挑战的环境中脱颖而出，成为每个企业管理者需要思考的核心问题。</p><h2>核心观点</h2><p>首先，我们需要认识到创新不仅仅是技术层面的突破，更是思维方式的革新。企业需要建立鼓励创新的内部机制，让每一位员工都能成为创新的参与者。</p><p>其次，客户体验的提升是推动业务增长的关键因素。通过深入了解客户需求，提供个性化的服务和产品，可以有效提升客户满意度和忠诚度。</p><h2>实践建议</h2><ul><li>建立跨部门协作机制，打破信息孤岛</li><li>定期开展客户满意度调研，及时调整策略</li><li>投资员工培训，提升团队整体能力</li></ul><h2>总结</h2><p>企业的发展需要系统性的思考和持续的努力。通过创新驱动、客户导向和团队建设三大支柱，企业可以在竞争中保持领先优势，实现可持续发展。</p>`
    );
  }

  if (weiboMatch) {
    return Promise.resolve(
      "创新不是口号，是行动 💡 从今天开始，用客户思维重塑你的业务流程，让每一次互动都有温度。#企业管理 #创新驱动 #客户体验"
    );
  }

  return Promise.resolve("<p>这是一段由 AI 生成的示例内容。请配置 DEEPSEEK_API_KEY 以使用真实的 AI 生成功能。</p>");
}
