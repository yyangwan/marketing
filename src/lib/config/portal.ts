/** Portal 服务地址与共享密钥配置（D8）。 */

export function getPortalBaseUrl(): string {
  return process.env.GENILINK_PORTAL_URL || "http://127.0.0.1:3001";
}

/** ContentOS → Portal 额度回调共享密钥；未配置时回调失败（fail-closed）。 */
export function getUsageCallbackSecret(): string | null {
  return process.env.CONTENT_USAGE_CALLBACK_SECRET || null;
}
