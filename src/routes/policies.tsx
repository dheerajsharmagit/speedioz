import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalHead } from "@/lib/legal";

export const Route = createFileRoute("/policies")({
  head: () => legalHead("policies", "customer"),
  component: () => <LegalPage slug="policies" audience="customer" />,
});
