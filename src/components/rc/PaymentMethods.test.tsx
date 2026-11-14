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
      payment="upi"
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
  it("offers enabled UPI and card checkout when Razorpay is configured", () => {
    const { html, radios } = render(configured);
    expect(radios).toHaveLength(3);
    expect(radios[0]).toContain("Cash");
    expect(radios[1]).toContain("UPI");
    expect(radios[2]).toContain("Card");
    expect(radios.every((radio) => !radio.includes('disabled=""'))).toBe(true);
    expect(radios[1]).toContain('aria-checked="true"');
    expect(html).toContain("Test checkout: no real money");
  });
  it("keeps all payment options visible while checking without enabling an unconfigured checkout", () => {
    const { html, radios } = render(null, true);
    expect(html).toContain("Checking online payment options");
    expect(radios).toHaveLength(3);
    expect(radios[0]).not.toContain('disabled=""');
    expect(radios[1]).toContain('disabled=""');
    expect(radios[2]).toContain('disabled=""');
  });
  it("offers a retry for configuration errors and missing keys instead of silently hiding online payments", () => {
    const scenarios: [PaymentConfiguration | null, boolean][] = [
      [null, true],
      [{ ...configured, configured: false, onlineMethods: [] }, false],
    ];
    for (const [configuration, failed] of scenarios) {
      const { html, radios } = render(configuration, false, failed);
      expect(radios).toHaveLength(3);
      expect(html).toContain("Retry online payments");
      expect(radios[1]).toContain('disabled=""');
      expect(radios[2]).toContain('disabled=""');
      expect(html).toContain(
        failed ? "Could not check online payment options" : "temporarily unavailable",
      );
    }
    expect(render(configured).radios.every((radio) => !radio.includes('disabled=""'))).toBe(true);
  });
  it("honours the backend's enabled methods and never enables wallet or an unrelated gateway", () => {
    const upiOnly = { ...configured, onlineMethods: ["UPI"] };
    expect(isPaymentMethodAvailable("upi", upiOnly)).toBe(true);
    expect(isPaymentMethodAvailable("card", upiOnly)).toBe(false);
    expect(isPaymentMethodAvailable("wallet", configured)).toBe(false);
    expect(isPaymentMethodAvailable("card", { ...configured, provider: "stripe" })).toBe(false);
    expect(isPaymentMethodAvailable("cash", null)).toBe(true);
  });
});
