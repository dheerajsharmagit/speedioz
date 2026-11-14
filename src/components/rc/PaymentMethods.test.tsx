import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PaymentConfiguration } from "../../lib/api";
import { isPaymentMethodAvailable } from "../../lib/payments";
import { PaymentMethods } from "./PaymentMethods";

const configured: PaymentConfiguration = {
  provider: "razorpay",
  configured: true,
  mode: "test",
  onlineMethods: ["UPI", "CARD"],
};
function render(configuration: PaymentConfiguration | null, checking = false, failed = false) {
  const html = renderToStaticMarkup(
    <PaymentMethods
      payment="wallet"
      configuration={configuration}
      checking={checking}
      failed={failed}
      onChange={() => {}}
      onRetry={() => {}}
    />,
  );
  return { html, radios: html.match(/<button[^>]*role="radio"[\s\S]*?<\/button>/g) ?? [] };
}
describe("customer payment options", () => {
  it("offers wallet funding or destination collection when Razorpay is configured", () => {
    const { html, radios } = render(configured);
    expect(radios).toHaveLength(2);
    expect(radios[0]).toContain("RideHer wallet");
    expect(radios[1]).toContain("Pay at the end");
    expect(radios.every((radio) => !radio.includes('disabled=""'))).toBe(true);
    expect(radios[0]).toContain('aria-checked="true"');
    expect(html).toContain("Test wallet");
  });
  it("keeps all payment options visible while checking without enabling an unconfigured checkout", () => {
    const { html, radios } = render(null, true);
    expect(html).toContain("Checking online payment options");
    expect(radios).toHaveLength(2);
    expect(radios[0]).not.toContain('disabled=""');
    expect(radios[1]).not.toContain('disabled=""');
  });
  it("offers a retry for configuration errors and missing keys instead of silently hiding online payments", () => {
    const scenarios: [PaymentConfiguration | null, boolean][] = [
      [null, true],
      [{ ...configured, configured: false, onlineMethods: [] }, false],
    ];
    for (const [configuration, failed] of scenarios) {
      const { html, radios } = render(configuration, false, failed);
      expect(radios).toHaveLength(2);
      expect(html).toContain("Retry online payments");
      expect(radios.every((radio) => !radio.includes('disabled=""'))).toBe(true);
      expect(html).toContain(
        failed ? "Could not check wallet top-up availability" : "temporarily unavailable",
      );
    }
    expect(render(configured).radios.every((radio) => !radio.includes('disabled=""'))).toBe(true);
  });
  it("honours the backend's enabled methods and never enables wallet or an unrelated gateway", () => {
    const upiOnly = { ...configured, onlineMethods: ["UPI"] };
    expect(isPaymentMethodAvailable("upi", upiOnly)).toBe(true);
    expect(isPaymentMethodAvailable("card", upiOnly)).toBe(false);
    expect(isPaymentMethodAvailable("wallet", configured)).toBe(false);
    expect(isPaymentMethodAvailable("wallet", configured, 100, 100)).toBe(true);
    expect(isPaymentMethodAvailable("wallet", configured, 99.99, 100)).toBe(false);
    expect(isPaymentMethodAvailable("wallet", null, 100, 80)).toBe(true);
    expect(isPaymentMethodAvailable("card", { ...configured, provider: "stripe" })).toBe(false);
    expect(isPaymentMethodAvailable("cash", null)).toBe(true);
  });
});
