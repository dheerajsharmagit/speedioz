import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalHead } from "@/lib/legal";

export const Route = createFileRoute("/captain-agreement")({
  head: () => legalHead("captain-agreement", "customer"),
  component: () => <LegalPage slug="captain-agreement" audience="customer" />,
});
