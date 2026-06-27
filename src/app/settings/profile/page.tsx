import { auth } from "@/lib/auth/config";
import { buildGeniLinkLoginUrl } from "@/lib/auth/genilink-login";
import { redirect } from "next/navigation";
import { ProfileClient } from "@/components/profile-client";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildGeniLinkLoginUrl("/settings/profile"));
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground tracking-tight mb-6">
        个人资料
      </h1>
      <ProfileClient
        currentName={session.user.name || ""}
        currentEmail={session.user.email || ""}
      />
    </div>
  );
}
