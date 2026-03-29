import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAppAdmin } from "@/lib/admin/is-app-admin";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["ban", "unban", "lock", "unlock", "removeAvatar"]) }),
  z.object({
    action: z.literal("delete"),
    confirmUserId: z.string().min(1),
  }),
]);

type Params = { params: Promise<{ userId: string }> };

export async function POST(request: Request, ctx: Params) {
  if (!(await isAppAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId: targetId } = await ctx.params;
  if (!targetId?.startsWith("user_")) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action payload" }, { status: 400 });
  }

  const { action } = parsed.data;

  if (action === "delete") {
    if (parsed.data.confirmUserId !== targetId) {
      return NextResponse.json(
        { error: "confirmUserId must match the user being deleted" },
        { status: 400 },
      );
    }
    await clerkClient.users.deleteUser(targetId);
    return NextResponse.json({ ok: true, message: "User deleted" });
  }

  try {
    switch (action) {
      case "ban":
        await clerkClient.users.banUser(targetId);
        break;
      case "unban":
        await clerkClient.users.unbanUser(targetId);
        break;
      case "lock":
        await clerkClient.users.lockUser(targetId);
        break;
      case "unlock":
        await clerkClient.users.unlockUser(targetId);
        break;
      case "removeAvatar":
        await clerkClient.users.deleteUserProfileImage(targetId);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Clerk request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
