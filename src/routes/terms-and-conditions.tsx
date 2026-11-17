import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalHead } from "@/lib/legal";

export const Route = createFileRoute("/terms-and-conditions")({
  head: () => legalHead("terms-and-conditions", "customer"),
  component: () => <LegalPage slug="terms-and-conditions" audience="customer" />,
});
