import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SetupNotice() {
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-6 px-6 py-20">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Database not ready</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Point{" "}
            <code className="rounded-md bg-muted px-1.5 py-0.5 text-foreground text-sm">
              DATABASE_URL
            </code>{" "}
            at PostgreSQL (local Docker or{" "}
            <a
              className="font-medium text-primary underline-offset-4 hover:underline"
              href="https://neon.tech"
              target="_blank"
              rel="noopener noreferrer"
            >
              Neon
            </a>
            ), then run migrations and seed.
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Copy{" "}
              <code className="rounded bg-muted px-1 text-foreground">
                .env.example
              </code>{" "}
              to{" "}
              <code className="rounded bg-muted px-1 text-foreground">.env</code>
            </li>
            <li>
              <code className="rounded bg-muted px-1 text-foreground">
                docker compose up -d
              </code>{" "}
              or use a Neon connection string
            </li>
            <li>
              <code className="rounded bg-muted px-1 text-foreground">
                npx prisma migrate dev
              </code>
            </li>
            <li>
              <code className="rounded bg-muted px-1 text-foreground">
                npm run db:seed
              </code>
            </li>
            <li>
              <code className="rounded bg-muted px-1 text-foreground">
                npm run dev
              </code>
            </li>
          </ol>
          <Alert>
            <AlertTitle>Documentation</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              See{" "}
              <code className="rounded bg-muted px-1 text-foreground">
                CLAUDE.md
              </code>{" "}
              for stack choices and API notes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
