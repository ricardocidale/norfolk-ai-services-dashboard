import { AddExpenseClient } from "@/components/expenses/add-expense-client";

export const dynamic = "force-dynamic";

export default function AddExpensePage() {
  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add expense</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manual line item for when API sync or import is not available. Most
          spend should come from vendor sync configured by an app admin (sidebar{" "}
          <span className="font-medium text-foreground">Admin</span> → Expense
          sources).
        </p>
      </div>
      <AddExpenseClient />
    </div>
  );
}
