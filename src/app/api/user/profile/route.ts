import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { apiError, ERROR_CODES, responses } from "@/lib/errors";

// PATCH /api/user/profile - Update current user's name
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const body = await req.json();
  const { name } = body as { name: string };

  if (!name || name.trim().length === 0) {
    return responses.badRequest(
      apiError("invalid_request_error", ERROR_CODES.MISSING_PARAMETER, "姓名不能为空", { param: "name" })
    );
  }

  if (name.trim().length > 50) {
    return responses.badRequest(
      apiError("invalid_request_error", ERROR_CODES.INVALID_PARAMETER, "姓名不能超过 50 个字符", { param: "name" })
    );
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: name.trim() },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json(updated);
}
