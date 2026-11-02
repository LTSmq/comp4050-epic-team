import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json(
      { authenticated: false, message: "Invalid or expired session" },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        id: user.userId,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    },
    { status: 200 }
  );
}
