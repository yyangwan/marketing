import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { step, completed } = body;

  const updateData: {
    onboardingStep?: string;
    onboardingCompleted?: boolean;
  } = {};

  if (step !== undefined) {
    updateData.onboardingStep = step;
  }
  if (completed !== undefined) {
    updateData.onboardingCompleted = completed;
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
  });

  return NextResponse.json({
    onboardingStep: user.onboardingStep,
    onboardingCompleted: user.onboardingCompleted,
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      onboardingStep: true,
      onboardingCompleted: true,
    },
  });

  return NextResponse.json(user);
}
