import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI, PersonGeneration } from "@google/genai";
import { jsonErr, jsonOk } from "@/lib/http/api-response";
import { avatarGeneratePromptSchema } from "@/lib/validations/profile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return jsonErr("Unauthorized", 401, { code: "UNAUTHORIZED" });
  }

  const apiKey =
    process.env.GOOGLE_GENAI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return jsonErr(
      "Image generation is not configured. Set GOOGLE_GENAI_API_KEY (or GEMINI_API_KEY) on the server.",
      503,
      { code: "NOT_CONFIGURED" },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON body", 400, { code: "INVALID_JSON" });
  }

  const parsed = avatarGeneratePromptSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(
      parsed.error.flatten().fieldErrors.prompt?.[0] ?? "Invalid prompt",
      400,
      { code: "VALIDATION" },
    );
  }

  const model =
    process.env.IMAGEN_MODEL?.trim() || "imagen-3.0-generate-002";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateImages({
      model,
      prompt: `Square profile avatar, centered subject, clean simple background, friendly, suitable as a user icon: ${parsed.data.prompt}`,
      config: {
        numberOfImages: 1,
        aspectRatio: "1:1",
        outputMimeType: "image/png",
        personGeneration: PersonGeneration.ALLOW_ADULT,
      },
    });

    const first = res.generatedImages?.[0];
    const bytes = first?.image?.imageBytes;
    if (!bytes) {
      const reason = first?.raiFilteredReason ?? "No image returned";
      return jsonErr(`Generation blocked or empty: ${reason}`, 422, {
        code: "GENERATION_BLOCKED",
      });
    }

    return jsonOk({
      mimeType: first.image?.mimeType ?? "image/png",
      imageBase64: bytes,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Image generation failed";
    return jsonErr(message, 502, { code: "GENERATION_FAILED" });
  }
}
