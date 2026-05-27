import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/partner/onboard")({
  component: () => (
    <div className="min-h-screen grid place-items-center px-6 py-16">
      <div className="max-w-lg text-center">
        <h1 className="font-display text-4xl">List your property</h1>
        <p className="mt-3 text-muted-foreground">Partner onboarding form — building next.</p>
      </div>
    </div>
  ),
});
