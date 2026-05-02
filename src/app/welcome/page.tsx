import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    redirect("/login");
  }

  // Redirect to the new onboarding flow
  redirect("/onboarding");
}
