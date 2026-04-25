export async function publishToWeChat(
  title: string,
  content: string,
  _thumbMediaId?: string
): Promise<{ mediaId: string } | { error: string }> {
  if (process.env.MOCK_WECHAT === "true") {
    return { mediaId: `mock_${Date.now()}` };
  }

  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;
  if (!appId || !appSecret) {
    return { error: "WeChat API credentials not configured" };
  }

  try {
    const tokenRes = await fetch(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
    );
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return { error: "Failed to get WeChat access token" };
    }

    const res = await fetch(
      `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articles: [
            {
              title,
              content,
              thumb_media_id: _thumbMediaId || "",
              author: "AI 生成",
              digest: content.replace(/<[^>]*>/g, "").slice(0, 120),
            },
          ],
        }),
      }
    );

    const data = await res.json();
    if (data.media_id) {
      return { mediaId: data.media_id };
    }
    return { error: JSON.stringify(data) };
  } catch (err) {
    return { error: String(err) };
  }
}
