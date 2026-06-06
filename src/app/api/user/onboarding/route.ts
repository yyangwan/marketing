import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ onboardingStep: "complete", onboardingCompleted: true });
}

export async function POST() {
  return NextResponse.json({ onboardingStep: "complete", onboardingCompleted: true });
}
