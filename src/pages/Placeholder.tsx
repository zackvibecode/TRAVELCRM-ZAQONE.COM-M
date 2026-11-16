import { Card, CardContent } from "@/components/ui/card";

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        {title}
      </h1>
      <Card>
        <CardContent className="flex h-64 items-center justify-center text-muted-foreground">
          <p className="text-sm">
            {title} — coming soon in a later phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
