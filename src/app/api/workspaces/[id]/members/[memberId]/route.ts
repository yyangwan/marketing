import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json(
    { error: "Workspace members are managed by GeniLink." },
    { status: 410 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Workspace members are managed by GeniLink." },
    { status: 410 }
  );
}
