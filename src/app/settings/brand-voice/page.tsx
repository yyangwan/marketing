import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { BrandVoiceClient } from "@/components/brand-voice-client";

export default async function BrandVoicePage() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    redirect("/login");
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-foreground tracking-tight mb-2">
        哣品牌调性管理
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        创建和管理品牌声音样本，AI 将根据这些样本生成符合品牌风格的内容。
      </p>

      <BrandVoiceClient workspaceId={session.user.workspaceId} />
    </div>
  );
}
