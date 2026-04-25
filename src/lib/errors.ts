/**
 * Standardized error format across all ContentOS API endpoints.
 * Follows Stripe API error structure for consistency.
 *
 * { error: { type, code, message, param, doc_url, deprecation } }
 *
 * Error types:
 * - api_error: Internal API error (500-level)
 * - authentication_error: Failed auth (401)
 * - invalid_request_error: Invalid parameters (400)
 * - not_found_error: Resource missing (404)
 * - rate_limit_error: Too many requests (429)
 *
 * @version 1.0.0
 */

export interface ContentOSError {
  error: {
    type: "api_error" | "authentication_error" | "invalid_request_error" | "not_found_error" | "rate_limit_error";
    code: string;
    message: string;
    param?: string;
    doc_url?: string;
    deprecation?: {
      since: string;      // Version when deprecated
      remove_at: string;  // Version when it will be removed
      migration_url: string;  // Migration guide link
    };
  };
}

export const ERROR_CODES = {
  // Authentication (401)
  MISSING_SESSION: "missing_session",
  INVALID_TOKEN: "invalid_token",

  // Authorization (403)
  NO_WORKSPACE: "no_workspace",
  INSUFFICIENT_PERMISSIONS: "insufficient_permissions",

  // Invalid Request (400)
  MISSING_PARAMETER: "missing_parameter",
  INVALID_PARAMETER: "invalid_parameter",
  VALIDATION_FAILED: "validation_failed",

  // Not Found (404)
  PROJECT_NOT_FOUND: "project_not_found",
  WORKSPACE_NOT_FOUND: "workspace_not_found",
  CONTENT_NOT_FOUND: "content_not_found",

  // Rate Limit (429)
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",

  // API Error (500)
  LLM_API_ERROR: "llm_api_error",
  DATABASE_ERROR: "database_error",
  INTERNAL_ERROR: "internal_error",
} as const;

export const DOCS_BASE = "https://docs.contentos.dev/errors";

/**
 * Create a standardized error response
 */
export function apiError(
  type: ContentOSError["error"]["type"],
  code: string,
  message: string,
  extras?: { param?: string; doc_url?: string; deprecation?: ContentOSError["error"]["deprecation"] }
): ContentOSError {
  return {
    error: {
      type,
      code,
      message,
      ...extras,
      doc_url: extras?.doc_url || `${DOCS_BASE}/${code}`,
    },
  };
}

/**
 * Create a deprecated error with migration information
 */
export function deprecatedError(
  oldCode: string,
  newCode: string,
  since: string,
  removeAt: string,
  extras?: { param?: string; migration_url?: string }
): ContentOSError {
  return apiError(
    "invalid_request_error",
    oldCode,
    `[已弃用] 此 API 已在 ${since} 版本中弃用，将在 ${removeAt} 版本中移除。请改用 "${newCode}"。`,
    {
      ...extras,
      deprecation: {
        since,
        remove_at: removeAt,
        migration_url: extras?.migration_url || `${DOCS_BASE}/migration/${since}-to-${removeAt}`,
      },
    }
  );
}

/**
 * Common error helpers
 */
export const errors = {
  unauthorized: () =>
    apiError("authentication_error", ERROR_CODES.MISSING_SESSION, "请先登录"),

  noWorkspace: () =>
    apiError("authentication_error", ERROR_CODES.NO_WORKSPACE, "您还没有加入任何工作区"),

  missingParam: (param: string) =>
    apiError(
      "invalid_request_error",
      ERROR_CODES.MISSING_PARAMETER,
      `缺少必需参数: ${param}`,
      { param }
    ),

  projectNotFound: (projectId: string) =>
    apiError(
      "not_found_error",
      ERROR_CODES.PROJECT_NOT_FOUND,
      `项目不存在: ${projectId}`,
      { param: "projectId" }
    ),

  workspaceNotFound: (workspaceId: string) =>
    apiError(
      "not_found_error",
      ERROR_CODES.WORKSPACE_NOT_FOUND,
      `工作区不存在: ${workspaceId}`,
      { param: "workspaceId" }
    ),

  llmError: (originalMessage: string) =>
    apiError(
      "api_error",
      ERROR_CODES.LLM_API_ERROR,
      `AI 生成服务暂时不可用，请稍后重试。原始错误: ${originalMessage}`
    ),
};

/**
 * Wrap NextResponse.json to standardize error handling
 */
import { NextResponse } from "next/server";

export function ErrorResponse(
  error: ContentOSError,
  status: number = 400
): Response {
  return NextResponse.json(error, { status });
}

/**
 * Helper responses for common status codes
 */
export const responses = {
  unauthorized: () => ErrorResponse(errors.unauthorized(), 401),
  forbidden: (error: ContentOSError) => ErrorResponse(error, 403),
  badRequest: (error: ContentOSError) => ErrorResponse(error, 400),
  notFound: (error: ContentOSError) => ErrorResponse(error, 404),
  rateLimit: (error: ContentOSError) => ErrorResponse(error, 429),
  serverError: (error: ContentOSError) => ErrorResponse(error, 500),
};
