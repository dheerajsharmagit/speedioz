export function shouldShowPickupOtp(status: string) {
  return ["MATCHED", "ARRIVING", "accepted", "arriving", "matched"].includes(status);
}
export function PickupOtp({ otp }: { otp: string }) {
  return (
    <section
      className="mx-6 mb-5 rounded-2xl border-2 border-primary/40 bg-primary/5 p-5 text-center"
      aria-label="Pickup OTP"
    >
      <h3 className="text-sm font-bold">Your pickup OTP</h3>
      <p className="my-3 font-mono text-4xl font-extrabold tracking-[0.35em] text-primary">
        {/^\d{4}$/.test(otp) ? otp : "••••"}
      </p>
      <p className="text-xs text-muted-foreground">
        Share this code only when your captain reaches you. It stays here until the captain verifies
        it and starts the ride.
      </p>
    </section>
  );
}
