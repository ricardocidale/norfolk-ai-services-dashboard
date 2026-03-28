"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExpenseForm } from "@/components/dashboard/expense-form";

export function AddExpenseClient() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <ExpenseForm
        onCreated={async () => {
          router.refresh();
        }}
      />
      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
