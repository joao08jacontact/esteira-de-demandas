import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VolumeCardProps {
  title: string;
  rows: [string, number][];
}

export function VolumeCard({ title, rows }: VolumeCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <div className="text-sm text-muted-foreground">Sem dados</div>}
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-sm">
            <span className="text-foreground">{k || "—"}</span>
            <span className="font-medium" data-testid={`volume-${k}`}>{v}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
