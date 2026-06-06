import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Password is managed by GeniLink." },
    { status: 410 }
  );
}
