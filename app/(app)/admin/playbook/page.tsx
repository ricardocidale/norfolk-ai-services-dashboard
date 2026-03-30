import { IntegrationPlaybookClient } from "@/components/admin/integration-playbook-client";
import { getPlaybookHints } from "@/lib/admin/integration-playbook-hints";

export const dynamic = "force-dynamic";

export default function AdminPlaybookPage(): React.JSX.Element {
  const hints = getPlaybookHints();
  return <IntegrationPlaybookClient hints={hints} />;
}
