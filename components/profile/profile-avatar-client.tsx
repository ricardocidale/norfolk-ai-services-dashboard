"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const PRESET_COLORS = [
  "#1E2D45",
  "#0097A7",
  "#FFC107",
  "#7C4DFF",
  "#E91E63",
  "#4CAF50",
];

function canvasColorPngFile(hex: string): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 256, 256);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not create image"));
          return;
        }
        resolve(new File([blob], "avatar.png", { type: "image/png" }));
      },
      "image/png",
      1,
    );
  });
}

export function ProfileAvatarClient() {
  const { user, isLoaded } = useUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");

  const applyFile = useCallback(
    async (file: File) => {
      if (!user) return;
      setError(null);
      setOk(null);
      setBusy(true);
      try {
        await user.setProfileImage({ file });
        await user.reload();
        setOk("Profile image updated.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update image");
      } finally {
        setBusy(false);
      }
    },
    [user],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !f.type.startsWith("image/")) {
      setError("Choose an image file (PNG, JPEG, WebP, …).");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("File must be 5 MB or smaller.");
      return;
    }
    void applyFile(f);
  };

  const onPreset = async (hex: string) => {
    try {
      const file = await canvasColorPngFile(hex);
      await applyFile(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preset failed");
    }
  };

  const onGenerate = async () => {
    if (!user) return;
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const res = await fetch("/api/profile/avatar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = (await res.json()) as {
        error?: string;
        imageBase64?: string;
        mimeType?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Generation failed");
        return;
      }
      if (!data.imageBase64) {
        setError("No image in response");
        return;
      }
      const bin = atob(data.imageBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: data.mimeType ?? "image/png",
      });
      const file = new File([blob], "avatar-ai.png", {
        type: data.mimeType ?? "image/png",
      });
      await user.setProfileImage({ file });
      await user.reload();
      setOk("Avatar generated and applied.");
      setPrompt("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  if (!isLoaded) {
    return (
      <p className="text-sm text-muted-foreground">Loading profile…</p>
    );
  }

  if (!user) {
    return (
      <p className="text-sm text-muted-foreground">You must be signed in.</p>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Account & security</CardTitle>
          <CardDescription>
            Email, password, connected accounts, and MFA are managed by Clerk.
            Open the full profile to change them.
          </CardDescription>
          <Button asChild variant="secondary" className="mt-2 w-fit">
            <Link href="/user-profile">Open account settings</Link>
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile photo</CardTitle>
          <CardDescription>
            Upload a file, pick a solid color tile, or generate a square avatar
            with Google Imagen (Gemini API). Your image is stored in Clerk.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {ok ? (
            <p className="text-sm text-green-600 dark:text-green-400">{ok}</p>
          ) : null}

          <Tabs defaultValue="upload">
            <TabsList variant="line">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="presets">Color tiles</TabsTrigger>
              <TabsTrigger value="ai">AI (Imagen)</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-4 space-y-3">
              <Label htmlFor="avatar-file">Image file</Label>
              <Input
                id="avatar-file"
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={onFileChange}
              />
              <p className="text-xs text-muted-foreground">
                Max 5 MB. Clerk accepts common raster formats.
              </p>
            </TabsContent>
            <TabsContent value="presets" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Quick illustration-style avatars (flat color squares).
              </p>
              <div className="flex flex-wrap gap-3">
                {PRESET_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    disabled={busy}
                    title={hex}
                    className="size-14 rounded-xl border border-border shadow-sm ring-offset-2 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    style={{ backgroundColor: hex }}
                    onClick={() => void onPreset(hex)}
                  />
                ))}
              </div>
            </TabsContent>
            <TabsContent value="ai" className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Uses the server{" "}
                <code className="rounded bg-muted px-1">GOOGLE_GENAI_API_KEY</code>{" "}
                (or <code className="rounded bg-muted px-1">GEMINI_API_KEY</code>)
                and Imagen. Optional:{" "}
                <code className="rounded bg-muted px-1">IMAGEN_MODEL</code>{" "}
                (default{" "}
                <code className="rounded bg-muted px-1">imagen-3.0-generate-002</code>
                ).
              </p>
              <Label htmlFor="ai-prompt">Describe your avatar</Label>
              <Input
                id="ai-prompt"
                value={prompt}
                disabled={busy}
                placeholder="e.g. friendly robot with Norfolk teal accents"
                onChange={(e) => setPrompt(e.target.value)}
              />
              <Button
                type="button"
                disabled={busy || prompt.trim().length < 4}
                onClick={() => void onGenerate()}
              >
                {busy ? "Working…" : "Generate & apply"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
