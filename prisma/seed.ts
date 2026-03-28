import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.expense.count();
  if (count > 0) {
    console.log("Skip seed: expenses already exist.");
    return;
  }

  await prisma.expense.createMany({
    data: [
      {
        provider: "CURSOR",
        billingAccount: "NORFOLK_GROUP",
        amount: "60",
        currency: "USD",
        incurredAt: new Date(),
        label: "Example: Cursor Pro (replace with your invoice)",
        source: "seed",
      },
      {
        provider: "ANTHROPIC",
        billingAccount: "NORFOLK_AI",
        amount: "120",
        currency: "USD",
        incurredAt: new Date(),
        label: "Example: Claude API usage",
        source: "seed",
      },
      {
        provider: "OPENAI",
        billingAccount: "CIDALE",
        amount: "85.5",
        currency: "USD",
        incurredAt: new Date(),
        label: "Example: OpenAI API",
        source: "seed",
      },
      {
        provider: "GEMINI",
        billingAccount: "NORFOLK_GROUP",
        amount: "42",
        currency: "USD",
        incurredAt: new Date(),
        label: "Example: Gemini / Google AI Studio",
        source: "seed",
      },
      {
        provider: "REPLIT",
        billingAccount: "CIDALE",
        amount: "25",
        currency: "USD",
        incurredAt: new Date(),
        label: "Example: Replit Core",
        source: "seed",
      },
    ],
  });

  console.log("Seeded sample expenses.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
