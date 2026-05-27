import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/earnings")({
  component: () => (
    <div className="px-6 lg:px-10 py-10 max-w-7xl mx-auto">
      <h1 className="font-display text-3xl">Earnings &amp; invoicing</h1>
      <p className="mt-2 text-muted-foreground">Monthly statements and invoice exports — coming next.</p>
    </div>
  ),
});
