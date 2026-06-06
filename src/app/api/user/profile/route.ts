import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json(
    { error: "User profile is managed by GeniLink." },
    { status: 410 }
  );
}
