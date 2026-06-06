import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Genie cron requires GeniLink-provided workspace/project scheduling context." },
    { status: 410 }
  );
}
