import { clerkClient } from "@clerk/nextjs/server";
import { jsonErr, jsonOk } from "@/lib/http/api-response";
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
    return jsonErr("Forbidden", 403, { code: "FORBIDDEN" });
  }

  const { userId: targetId } = await ctx.params;
  if (!targetId?.startsWith("user_")) {
    return jsonErr("Invalid user id", 400, { code: "INVALID_USER_ID" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON", 400, { code: "INVALID_JSON" });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr("Invalid action payload", 400, { code: "VALIDATION" });
  }

  const { action } = parsed.data;

  const clerk = await clerkClient();

  if (action === "delete") {
    if (parsed.data.confirmUserId !== targetId) {
      return jsonErr(
        "confirmUserId must match the user being deleted",
        400,
        { code: "CONFIRM_MISMATCH" },
      );
    }
    await clerk.users.deleteUser(targetId);
    return jsonOk({ message: "User deleted" });
  }

  try {
    switch (action) {
      case "ban":
        await clerk.users.banUser(targetId);
        break;
      case "unban":
        await clerk.users.unbanUser(targetId);
        break;
      case "lock":
        await clerk.users.lockUser(targetId);
        break;
      case "unlock":
        await clerk.users.unlockUser(targetId);
        break;
      case "removeAvatar":
        await clerk.users.deleteUserProfileImage(targetId);
        break;
      default:
        return jsonErr("Unknown action", 400, { code: "UNKNOWN_ACTION" });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Clerk request failed";
    return jsonErr(message, 502, { code: "CLERK_ERROR" });
  }

  return jsonOk({});
}
