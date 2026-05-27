import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/properties")({
  component: () => <ComingSoon title="Properties" />,
});
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="px-6 lg:px-10 py-10 max-w-7xl mx-auto">
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="mt-2 text-muted-foreground">This section is next on the build queue.</p>
    </div>
  );
}
