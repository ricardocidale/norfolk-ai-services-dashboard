"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminUserRow } from "@/lib/admin/clerk-user-dto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiErrorMessageFromBody } from "@/lib/http/api-response";

type Props = {
  rows: AdminUserRow[];
  totalCount: number;
  offset: number;
  limit: number;
};

async function postAction(
  userId: string,
  body: Record<string, string>,
): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch(`/api/admin/users/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: apiErrorMessageFromBody(data) ?? res.statusText };
  }
  return { ok: true };
}

function fmt(ts: number | null) {
  if (ts == null) return "—";
  return new Date(ts).toLocaleString();
}

export function AdminUsersClient({ rows, totalCount, offset, limit }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (userId: string, body: Record<string, string>) => {
    setBusyId(userId);
    setMessage(null);
    const r = await postAction(userId, body);
    setBusyId(null);
    if (r.error) {
      setMessage(r.error);
      return;
    }
    setMessage("Updated.");
    router.refresh();
  };

  const prev = Math.max(0, offset - limit);
  const next = offset + limit < totalCount ? offset + limit : null;

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => router.push(`/admin?tab=users&offset=${prev}`)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={next === null}
              onClick={() =>
                next != null && router.push(`/admin?tab=users&offset=${next}`)
              }
            >
              Next
            </Button>
            <span className="self-center text-xs text-muted-foreground">
              Showing {offset + 1}–{Math.min(offset + rows.length, totalCount)}{" "}
              of {totalCount}
            </span>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {u.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.imageUrl}
                            alt=""
                            className="size-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="size-8 rounded-full bg-muted" />
                        )}
                        <div>
                          <div className="font-mono text-xs">{u.id}</div>
                          <div className="text-sm">{u.primaryEmail || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {[u.firstName, u.lastName].filter(Boolean).join(" ") ||
                              "—"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.banned ? (
                          <Badge variant="destructive">Banned</Badge>
                        ) : null}
                        {u.locked ? <Badge variant="secondary">Locked</Badge> : null}
                        {!u.banned && !u.locked ? (
                          <Badge variant="outline">Active</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fmt(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === u.id}
                          onClick={() =>
                            void run(u.id, { action: "removeAvatar" })
                          }
                        >
                          Clear photo
                        </Button>
                        {u.banned ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === u.id}
                            onClick={() => void run(u.id, { action: "unban" })}
                          >
                            Unban
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busyId === u.id}
                            onClick={() => void run(u.id, { action: "ban" })}
                          >
                            Ban
                          </Button>
                        )}
                        {u.locked ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === u.id}
                            onClick={() => void run(u.id, { action: "unlock" })}
                          >
                            Unlock
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === u.id}
                            onClick={() => void run(u.id, { action: "lock" })}
                          >
                            Lock
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={busyId === u.id}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Permanently delete user ${u.id}? This cannot be undone.`,
                              )
                            ) {
                              return;
                            }
                            if (
                              window.prompt(
                                `Type the user id to confirm: ${u.id}`,
                              ) !== u.id
                            ) {
                              return;
                            }
                            void run(u.id, {
                              action: "delete",
                              confirmUserId: u.id,
                            });
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
      </div>
    </div>
  );
}
