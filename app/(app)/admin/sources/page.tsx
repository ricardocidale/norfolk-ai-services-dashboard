import { ExpenseSourcesClient } from "@/components/admin/expense-sources-client";
import { getExpenseSourceStatuses } from "@/lib/admin/expense-sources";

export const dynamic = "force-dynamic";

export default function AdminSourcesPage() {
  const initialStatuses = getExpenseSourceStatuses();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Expense sources
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Each AI vendor is tied to a data source: automated APIs (where
          supported) or manual entry and batch import. Use{" "}
          <strong>Test API</strong> to confirm keys reach OpenAI or Anthropic
          without running a full cost sync.
        </p>
      </div>
      <ExpenseSourcesClient initialStatuses={initialStatuses} />
    </div>
  );
}
