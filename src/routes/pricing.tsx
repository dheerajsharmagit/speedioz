import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalHead } from "@/lib/legal";

export const Route = createFileRoute("/pricing")({
  head: () => legalHead("pricing", "customer"),
  component: () => <LegalPage slug="pricing" audience="customer" />,
});
