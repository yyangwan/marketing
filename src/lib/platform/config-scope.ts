export type PlatformConfigContext = {
  workspaceId: string;
  projectId?: string;
  userId?: string;
};

export function getPlatformConfigScope(context: PlatformConfigContext, fallbackUserId: string) {
  return {
    workspaceId: context.workspaceId,
    projectId: context.projectId || context.workspaceId,
    userId: context.userId || fallbackUserId,
  };
}

export function getPlatformConfigKey(
  context: PlatformConfigContext,
  fallbackUserId: string,
  platform: string,
) {
  return {
    ...getPlatformConfigScope(context, fallbackUserId),
    platform,
  };
}
