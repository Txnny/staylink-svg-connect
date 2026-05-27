import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/request")({
  component: () => (
    <div className="min-h-screen grid place-items-center px-6 py-16">
      <div className="max-w-lg text-center">
        <h1 className="font-display text-4xl">Need a room?</h1>
        <p className="mt-3 text-muted-foreground">Public traveller request form — building next.</p>
      </div>
    </div>
  ),
});
