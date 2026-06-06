import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json(
    { error: "Workspaces are managed by GeniLink." },
    { status: 410 }
  );
}
