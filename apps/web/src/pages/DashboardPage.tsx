import { Card, CardHeader, CardTitle, StatCard, StatGrid, useSetPageHeader } from '@brd/ui';
import { useAuth } from '@/features/auth/hooks/use-auth';

/** The home page: a stats strip and a first-steps panel, in the template's panel style. */
export function DashboardPage() {
  const { user } = useAuth();
  const title = `Welcome back, ${user?.name ?? 'User'}`;
  // The title lives in the top bar; outside the app shell it is shown here instead.
  const inTopBar = useSetPageHeader(title, 'BRD Platform dashboard');

  return (
    <div className="uab-page">
      {!inTopBar && <h1 className="uab-page-title">{title}</h1>}
      <StatGrid>
        <StatCard label="Total BRDs" value={0} />
        <StatCard label="In progress" value={0} />
        <StatCard label="Pending review" value={0} />
        <StatCard label="Completed" value={0} />
      </StatGrid>
      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
        </CardHeader>
        <p className="uab-muted">
          Upload your first BRD document to begin extracting requirements and generating ERP module
          mappings.
        </p>
      </Card>
    </div>
  );
}
