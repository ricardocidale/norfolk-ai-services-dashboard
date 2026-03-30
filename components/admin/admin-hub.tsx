"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  Unplug,
  Mail,
  Users,
  Settings2,
  Info,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BILLING_ACCOUNT_LABEL,
  BILLING_ACCOUNT_ORDER,
} from "@/lib/billing-accounts";
import { ExpenseSourcesClient } from "./expense-sources-client";
import { EmailScanClient } from "./email-scan-client";
import { AdminUsersClient } from "./admin-users-client";
import { DisplayPrefsCard } from "./display-prefs-card";
import type { ExpenseSourceStatus } from "@/lib/admin/expense-sources";
import type { AdminUserRow } from "@/lib/admin/clerk-user-dto";

type AccountInfo = {
  email: string;
  billingAccount: string;
  connected: boolean;
  tokenExpiry: string | null;
  lastSyncAt: string | null;
};

type ScanResult = {
  id: string;
  gmailEmail: string;
  gmailMessageId: string;
  subject: string;
  fromEmail: string;
  receivedAt: string;
  parsedVendor: string | null;
  parsedAmount: string | null;
  parsedCurrency: string | null;
  parsedDate: string | null;
  confidence: number | null;
  status: string;
  expenseId: string | null;
  rawSnippet: string | null;
};

export type AdminHubProps = {
  expenseSources: ExpenseSourceStatus[];
  gmailAccounts: AccountInfo[];
  scanResults: ScanResult[];
  userRows: AdminUserRow[];
  userTotalCount: number;
  userOffset: number;
  userLimit: number;
};

const TAB_IDS = ["vendors", "email-scanner", "users", "settings"] as const;
type TabId = (typeof TAB_IDS)[number];

function isTabId(v: string | null): v is TabId {
  return TAB_IDS.includes(v as TabId);
}

function AdminHubInner(props: AdminHubProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: TabId = isTabId(rawTab) ? rawTab : "vendors";

  const onTabChange = (value: string): void => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`/admin?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
            Norfolk AI
          </Badge>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Manage vendor integrations, email scanning, user access, and app
          settings. API keys are configured in Vercel Environment Variables —
          never stored or displayed here.
        </p>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Info className="size-3 opacity-60" />
            Billing accounts:
          </span>
          {BILLING_ACCOUNT_ORDER.map((ba) => (
            <span key={ba} className="font-medium text-foreground">
              {ba.replace("_", " ")}
              <span className="ml-1 font-normal text-muted-foreground">
                ({BILLING_ACCOUNT_LABEL[ba]})
              </span>
            </span>
          ))}
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap gap-1">
          <TabsTrigger value="vendors" className="gap-1.5 text-xs sm:text-sm">
            <Unplug className="size-3.5" />
            Vendors
          </TabsTrigger>
          <TabsTrigger
            value="email-scanner"
            className="gap-1.5 text-xs sm:text-sm"
          >
            <Mail className="size-3.5" />
            Email scanner
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5 text-xs sm:text-sm">
            <Users className="size-3.5" />
            Users
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm">
            <Settings2 className="size-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vendors" className="mt-6 space-y-2">
          <p className="text-sm text-muted-foreground">
            Each vendor is linked to a billing email and a data source. Use{" "}
            <strong>Test API</strong> to verify credentials, or{" "}
            <strong>Sync now</strong> to pull usage data.
          </p>
          <ExpenseSourcesClient initialStatuses={props.expenseSources} />
        </TabsContent>

        <TabsContent value="email-scanner" className="mt-6 space-y-2">
          <p className="text-sm text-muted-foreground">
            Connect Gmail accounts to scan for AI vendor invoices. Emails are
            parsed by Claude AI and presented for approval before importing.
          </p>
          <EmailScanClient
            accounts={props.gmailAccounts}
            initialResults={props.scanResults}
          />
        </TabsContent>

        <TabsContent value="users" className="mt-6 space-y-2">
          <p className="text-sm text-muted-foreground">
            Clerk-backed user list. Manage access, bans, locks, and profile
            photos. Password resets happen via the sign-in page or{" "}
            <a
              href="https://dashboard.clerk.com"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Clerk Dashboard
            </a>
            .
          </p>
          <AdminUsersClient
            rows={props.userRows}
            totalCount={props.userTotalCount}
            offset={props.userOffset}
            limit={props.userLimit}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            App-wide display preferences. Changes are saved in your browser.
          </p>
          <DisplayPrefsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function AdminHub(props: AdminHubProps): React.JSX.Element {
  return (
    <Suspense>
      <AdminHubInner {...props} />
    </Suspense>
  );
}
