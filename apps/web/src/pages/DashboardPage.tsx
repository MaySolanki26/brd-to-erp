import { Card, CardContent, CardHeader, CardTitle, StatCard, PageShell, InformativeBar, Badge } from '@brd/ui';
import { FileText, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/use-auth';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <PageShell>
      <InformativeBar
        title={`Welcome back, ${user?.name ?? 'User'}`}
        badge={<Badge variant="outline">MVP</Badge>}
        info="BRD Platform Dashboard"
      />
      <PageShell.Body padded>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={FileText} label="Total BRDs" value={0} iconClassName="bg-primary/10 text-primary" />
          <StatCard icon={TrendingUp} label="In Progress" value={0} iconClassName="bg-info/10 text-info" />
          <StatCard icon={Clock} label="Pending Review" value={0} iconClassName="bg-warning/10 text-warning" />
          <StatCard icon={CheckCircle2} label="Completed" value={0} iconClassName="bg-success/10 text-success" />
        </div>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-muted-foreground">
              Upload your first BRD document to begin extracting requirements and generating ERP module mappings.
            </p>
          </CardContent>
        </Card>
      </PageShell.Body>
    </PageShell>
  );
}
