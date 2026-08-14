import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { storage } from "@/lib/api";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Customer onboarding — RIDEHER" },
      { name: "description", content: "Complete your customer setup and start booking rides." },
    ],
  }),
  component: OnboardingPage,
});

const steps = [
  { title: "Create customer account", description: "Your account is ready for secure ride booking." },
  { title: "Set your trip preferences", description: "Choose your pickup, destination, and ride type." },
  { title: "Book instantly", description: "Request a ride and track your captain in real time." },
  { title: "Ride with confidence", description: "Travel safely with verified women captains and live trip updates." },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!storage.getUser()) {
      navigate({ to: "/auth", search: { mode: "signup" } });
    }
  }, [navigate]);

  const handleSubmit = () => {
    setSubmitted(true);
    window.setTimeout(() => {
      navigate({ to: "/ride" });
    }, 1100);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[430px] flex-col gap-6 border-x border-border bg-background px-6 py-10">
        <Link to="/" className="text-lg font-extrabold uppercase tracking-tighter">
          RIDE<span className="text-primary">HER</span>
        </Link>

        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Customer account</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Finish your trip setup.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Create your account and get ready to book safe rides in minutes.
          </p>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.title} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-black text-primary">
                0{index + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">{step.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-border bg-card p-4">
          <p className="text-sm font-bold">What you can do next</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Save trip preferences, request rides, and track your captain in real time.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="mt-auto h-14 w-full rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-sm transition-transform active:scale-[0.98]"
        >
          {submitted ? "Ready to ride" : "Continue to booking"}
        </button>
      </div>
    </div>
  );
}
