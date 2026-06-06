import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Projects are managed by GeniLink." },
    { status: 410 }
  );
}

export async function POST(req: Request) {
  void req;
  return NextResponse.json(
    { error: "Projects are managed by GeniLink." },
    { status: 410 }
  );
}
