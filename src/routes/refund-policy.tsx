import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalHead } from "@/lib/legal";

export const Route = createFileRoute("/refund-policy")({
  head: () => legalHead("refund-policy", "customer"),
  component: () => <LegalPage slug="refund-policy" audience="customer" />,
});
