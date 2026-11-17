import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalHead } from "@/lib/legal";

export const Route = createFileRoute("/cancellation-policy")({
  head: () => legalHead("cancellation-policy", "customer"),
  component: () => <LegalPage slug="cancellation-policy" audience="customer" />,
});
