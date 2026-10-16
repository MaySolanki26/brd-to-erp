import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToastProvider,
  toast,
  PageShell,
  InformativeBar,
  ActionBar,
  EmptyState,
  ErrorBoundary,
  StatusBadge,
  SearchInput,
  StatCard,
  SwitcherBar,
  type SwitcherItem,
} from '@brd/ui';
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle2,
} from 'lucide-react';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'settings', label: 'Settings', icon: Settings },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]['key'];

function DashboardContent() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          label="Total BRDs"
          value={24}
          iconClassName="bg-primary/10 text-primary"
        />
        <StatCard
          icon={TrendingUp}
          label="In Progress"
          value={8}
          iconClassName="bg-info/10 text-info"
        />
        <StatCard
          icon={Clock}
          label="Pending Review"
          value={5}
          iconClassName="bg-warning/10 text-warning"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={11}
          iconClassName="bg-success/10 text-success"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Documents</CardTitle>
          <CardDescription>Latest BRD submissions across all projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: 'ERP Integration Spec', status: 'In Progress', date: '2 hours ago' },
              { name: 'Payment Gateway Requirements', status: 'Completed', date: '1 day ago' },
              { name: 'User Auth Module', status: 'Pending', date: '3 days ago' },
              { name: 'Inventory Management', status: 'Draft', date: '5 days ago' },
            ].map((doc) => (
              <div
                key={doc.name}
                className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-xl font-medium text-foreground">{doc.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge label={doc.status} size="xs" />
                  <span className="text-lg text-muted-foreground">{doc.date}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Component Library</CardTitle>
            <CardDescription>Design system primitives</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <StatusBadge label="Active" tone="success" />
              <StatusBadge label="Pending" tone="warning" />
              <StatusBadge label="Failed" tone="danger" />
              <StatusBadge label="In Progress" tone="info" />
              <StatusBadge label="Archived" tone="neutral" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tabs Example</CardTitle>
            <CardDescription>Tabbed content using Radix primitives</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="pt-3">
                <p className="text-lg text-muted-foreground">
                  This is the overview tab content. The design system uses a dense
                  typography scale (xxs=9px through 9xl=96px) optimized for data-heavy
                  interfaces.
                </p>
              </TabsContent>
              <TabsContent value="details" className="pt-3">
                <p className="text-lg text-muted-foreground">
                  Detail tab content with semantic color tokens for success, warning,
                  destructive, and info states.
                </p>
              </TabsContent>
              <TabsContent value="history" className="pt-3">
                <p className="text-lg text-muted-foreground">
                  History tab content. All components are built on Radix UI headless
                  primitives.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DocumentsContent() {
  return (
    <EmptyState
      title="No documents yet"
      description="Create your first BRD document to get started."
      icon={FileText}
      actionLabel="New Document"
      onAction={() => toast.success('Create document clicked')}
      fill
    />
  );
}

const SWITCHER_ITEMS: SwitcherItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'documents', label: 'Documents', icon: FileText, count: 24 },
  { key: 'team', label: 'Team', icon: Users, count: 6 },
];

export function App(): React.JSX.Element {
  const [activeNav, setActiveNav] = useState<NavKey>('dashboard');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <ErrorBoundary>
      <ToastProvider>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
          <div className="flex h-14 items-center gap-2 px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xl font-bold">
              B
            </div>
            <span className="text-2xl font-semibold text-foreground">BRD Platform</span>
          </div>
          <Separator />
          <nav className="flex-1 space-y-1 p-2">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveNav(key);
                  setActiveTab(key);
                }}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-lg font-medium transition-colors ${
                  activeNav === key
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                {label}
              </button>
            ))}
          </nav>
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                MS
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-medium text-foreground">May Solanki</p>
                <p className="truncate text-xs text-muted-foreground">Admin</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <PageShell>
            <InformativeBar
              title="BRD Platform"
              badge={<Badge variant="outline">MVP</Badge>}
              info="Design System Demo"
            >
              <Button size="xs" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                New BRD
              </Button>
            </InformativeBar>

            <ActionBar bordered>
              <SwitcherBar
                items={SWITCHER_ITEMS}
                value={activeTab}
                onChange={setActiveTab}
                variant="box"
              />
              <div className="ml-auto flex items-center gap-2">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search..."
                  size="sm"
                />
              </div>
            </ActionBar>

            <PageShell.Body padded>
              {activeTab === 'dashboard' && <DashboardContent />}
              {activeTab === 'documents' && <DocumentsContent />}
              {activeTab === 'team' && (
                <EmptyState
                  title="Team Management"
                  description="Invite team members to collaborate on BRD documents."
                  icon={Users}
                  actionLabel="Invite Member"
                  onAction={() => toast.success('Invite clicked')}
                  fill
                />
              )}
            </PageShell.Body>
          </PageShell>
        </main>
      </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}
