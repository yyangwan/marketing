import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Workspace invites are managed by GeniLink." },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Workspace invites are managed by GeniLink." },
    { status: 410 }
  );
}
