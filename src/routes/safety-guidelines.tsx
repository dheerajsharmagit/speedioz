import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalHead } from "@/lib/legal";

export const Route = createFileRoute("/safety-guidelines")({
  head: () => legalHead("safety-guidelines", "customer"),
  component: () => <LegalPage slug="safety-guidelines" audience="customer" />,
});
