import { auth } from "@/lib/auth/config";
import { buildGeniLinkLoginUrl } from "@/lib/auth/genilink-login";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BrandVoiceClient } from "@/components/brand-voice-client";

export default async function BrandVoicePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildGeniLinkLoginUrl("/settings/brand-voice"));
  }

  const cookieStore = await cookies();
  const workspaceId = session.user.workspaceId ?? cookieStore.get("genilink-workspace")?.value;
  if (!workspaceId) {
    redirect(buildGeniLinkLoginUrl("/settings/brand-voice"));
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground tracking-tight mb-2">
        品牌调性管理
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        创建和管理品牌声音样本，AI 将根据这些样本生成符合品牌风格的内容。
      </p>

      <BrandVoiceClient workspaceId={workspaceId} />
    </div>
  );
}
