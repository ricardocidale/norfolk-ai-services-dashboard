"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { BookOpen, Check, Copy, ExternalLink } from "lucide-react";
import {
  PLAYBOOK_SECTIONS,
  buildAiAssistantBrief,
  playbookSectionStatusLine,
  type PlaybookHints,
  type PlaybookSection,
} from "@/lib/admin/integration-playbook-sections";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function RichParagraphs({ text }: { text: string }): React.JSX.Element {
  const paras = text.split(/\n\n+/).filter(Boolean);
  return (
    <>
      {paras.map((p, i) => (
        <p
          key={i}
          className="mt-2 text-sm leading-relaxed text-muted-foreground first:mt-0"
        >
          {formatInlineBold(p)}
        </p>
      ))}
    </>
  );
}

function formatInlineBold(s: string): React.ReactNode {
  const re = /\*\*(.+?)\*\*/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) {
      out.push(s.slice(last, m.index));
    }
    out.push(
      <strong key={key++} className="font-medium text-foreground">
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out.length > 0 ? out : s;
}

function CopyTextButton({
  label,
  text,
  className,
}: {
  label: string;
  text: string;
  className?: string;
}): React.JSX.Element {
  const [done, setDone] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
    } catch {
      /* ignore */
    }
  }, [text]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-1.5", className)}
      onClick={onCopy}
    >
      {done ? (
        <Check className="size-3.5 text-emerald-500" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {label}
    </Button>
  );
}

function SectionCard({
  section,
  hints,
}: {
  section: PlaybookSection;
  hints: PlaybookHints;
}): React.JSX.Element {
  const status = playbookSectionStatusLine(section.id, hints);

  return (
    <AccordionItem
      value={section.id}
      id={section.id}
      className="scroll-mt-24 border-b border-border px-1"
    >
      <AccordionTrigger className="py-4 hover:no-underline">
        <span className="flex flex-col items-start gap-1 text-left sm:flex-row sm:items-center sm:gap-3">
          <span className="font-semibold text-foreground">{section.title}</span>
          {status ? (
            <Badge variant="secondary" className="max-w-full whitespace-normal font-normal">
              {status}
            </Badge>
          ) : null}
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pb-6 pt-0">
        <p className="text-sm text-muted-foreground">{section.summary}</p>

        <ol className="list-decimal space-y-4 pl-5 text-sm">
          {section.steps.map((step, i) => (
            <li key={i} className="pl-1 marker:font-medium">
              <span className="font-medium text-foreground">{step.title}</span>
              {step.body ? <RichParagraphs text={step.body} /> : null}
            </li>
          ))}
        </ol>

        {section.envKeys && section.envKeys.length > 0 ? (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium text-foreground">Environment names</p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">
              {section.envKeys.join("\n")}
            </pre>
            <CopyTextButton
              className="mt-2"
              label="Copy env names"
              text={section.envKeys.join("\n")}
            />
          </div>
        ) : null}

        {section.links && section.links.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {section.links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {l.label}
                  <ExternalLink className="size-3 opacity-70" />
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        {section.verify && section.verify.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {section.verify.map((v) => {
              const external = v.href.startsWith("http");
              if (external) {
                return (
                  <a
                    key={v.href}
                    href={v.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                  >
                    {v.label}
                    <ExternalLink className="size-3" />
                  </a>
                );
              }
              return (
                <Link
                  key={v.href}
                  href={v.href}
                  className="inline-flex items-center rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  {v.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  );
}

export function IntegrationPlaybookClient({
  hints,
}: {
  hints: PlaybookHints;
}): React.JSX.Element {
  const brief = buildAiAssistantBrief(hints);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6 lg:max-w-4xl">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <BookOpen className="size-8 text-primary" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">
            Integration playbook
          </h1>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Step-by-step guidance to find APIs, OAuth clients, and environment
          variables — without pasting secrets into chat. Status badges reflect{" "}
          <strong className="text-foreground">whether this server sees env vars</strong>
          , not whether they are valid.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            ← Admin home
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href="/admin?tab=vendors"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Vendors & sync
          </Link>
        </div>
      </header>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">On this page</CardTitle>
          <CardDescription>
            Jump to a section (anchors work for sharing links).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <nav className="flex flex-col gap-1 sm:columns-2 sm:gap-x-6">
            {PLAYBOOK_SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="break-inside-avoid text-sm text-primary underline-offset-4 hover:underline"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Brief for your AI assistant</CardTitle>
          <CardDescription>
            Redacted template: env <strong>presence</strong> only, no secrets.
            Paste into Cursor / Claude after adding your question at the bottom.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {brief}
          </pre>
          <CopyTextButton label="Copy brief" text={brief} />
        </CardContent>
      </Card>

      <Accordion
        type="multiple"
        defaultValue={["safety", "vercel"]}
        className="rounded-xl border bg-card px-2 sm:px-4"
      >
        {PLAYBOOK_SECTIONS.map((section) => (
          <SectionCard key={section.id} section={section} hints={hints} />
        ))}
      </Accordion>
    </div>
  );
}
