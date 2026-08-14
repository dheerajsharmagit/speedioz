import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { storage } from "@/lib/api";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Rider onboarding — RIDEHER" },
      { name: "description", content: "Complete your rider onboarding and verification before booking." },
    ],
  }),
  component: OnboardingPage,
});

const steps = [
  { title: "Create rider account", description: "Your account is created and ready for verification." },
  { title: "Upload documents", description: "Add your identity, address proof, and profile photo." },
  { title: "Admin review", description: "Our ops team checks your rider profile and documents." },
  { title: "Approved access", description: "Once approved, you can book rides normally." },
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
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Rider account</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Finish your rider setup.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Set up your account first, then submit your verification documents for approval.
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
          <p className="text-sm font-bold">Documents to upload</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Government ID, address proof, and a profile photo.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="mt-auto h-14 w-full rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-sm transition-transform active:scale-[0.98]"
        >
          {submitted ? "Submitted for review" : "Submit rider documents"}
        </button>
      </div>
    </div>
  );
}
