import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { apiError, ERROR_CODES, responses } from "@/lib/errors";
import bcrypt from "bcryptjs";

// POST /api/user/password - Change password
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return responses.unauthorized();
  }

  const body = await req.json();
  const { currentPassword, newPassword } = body as {
    currentPassword: string;
    newPassword: string;
  };

  if (!currentPassword || !newPassword) {
    return responses.badRequest(
      apiError("invalid_request_error", ERROR_CODES.MISSING_PARAMETER, "当前密码和新密码不能为空")
    );
  }

  if (newPassword.length < 6) {
    return responses.badRequest(
      apiError("invalid_request_error", ERROR_CODES.INVALID_PARAMETER, "新密码至少 6 个字符", { param: "newPassword" })
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return responses.unauthorized();
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return responses.badRequest(
      apiError("invalid_request_error", ERROR_CODES.INVALID_PARAMETER, "当前密码不正确", { param: "currentPassword" })
    );
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: newHash },
  });

  return NextResponse.json({ success: true });
}
