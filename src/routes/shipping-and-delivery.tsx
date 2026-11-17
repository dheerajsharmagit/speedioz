import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalHead } from "@/lib/legal";

export const Route = createFileRoute("/shipping-and-delivery")({
  head: () => legalHead("shipping-and-delivery", "customer"),
  component: () => <LegalPage slug="shipping-and-delivery" audience="customer" />,
});
