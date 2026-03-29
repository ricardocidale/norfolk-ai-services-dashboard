import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI, PersonGeneration } from "@google/genai";
import { NextResponse } from "next/server";
import { avatarGeneratePromptSchema } from "@/lib/validations/profile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey =
    process.env.GOOGLE_GENAI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Image generation is not configured. Set GOOGLE_GENAI_API_KEY (or GEMINI_API_KEY) on the server.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = avatarGeneratePromptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.prompt?.[0] ?? "Invalid prompt" },
      { status: 400 },
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
      return NextResponse.json(
        { error: `Generation blocked or empty: ${reason}` },
        { status: 422 },
      );
    }

    return NextResponse.json({
      mimeType: first.image?.mimeType ?? "image/png",
      imageBase64: bytes,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
