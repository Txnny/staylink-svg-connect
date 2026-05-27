import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/redirects")({
  component: () => (
    <div className="px-6 lg:px-10 py-10 max-w-7xl mx-auto">
      <h1 className="font-display text-3xl">Redirects</h1>
      <p className="mt-2 text-muted-foreground">Full queue management — coming next.</p>
    </div>
  ),
});
