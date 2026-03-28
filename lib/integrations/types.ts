import type { AiProvider } from "@prisma/client";

export type SyncResult = {
  ok: boolean;
  message: string;
  imported: number;
  provider: AiProvider;
};
