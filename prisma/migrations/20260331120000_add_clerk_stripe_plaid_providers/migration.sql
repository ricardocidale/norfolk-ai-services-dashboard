-- AlterEnum: CLERK, STRIPE, PLAID immediately before OTHER (each inserts before OTHER, last wins closest to OTHER)
ALTER TYPE "AiProvider" ADD VALUE 'CLERK' BEFORE 'OTHER';
ALTER TYPE "AiProvider" ADD VALUE 'STRIPE' BEFORE 'OTHER';
ALTER TYPE "AiProvider" ADD VALUE 'PLAID' BEFORE 'OTHER';
