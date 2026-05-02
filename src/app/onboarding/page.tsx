import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { OnboardingTour } from "@/components/onboarding-tour";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    redirect("/login");
  }

  // If already completed, redirect to home
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompleted: true, onboardingStep: true },
  });

  if (user?.onboardingCompleted) {
    redirect("/");
  }

  return (
    <OnboardingTour
      currentStep={(user?.onboardingStep as any) || "welcome"}
      workspaceId={session.user.workspaceId}
    />
  );
}
