import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Registration is managed by GeniLink." },
    { status: 410 }
  );
}
