import { z } from "zod";

export const avatarGeneratePromptSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(4, "Prompt is too short")
    .max(500, "Prompt must be 500 characters or fewer"),
});

export type AvatarGeneratePromptInput = z.infer<typeof avatarGeneratePromptSchema>;
