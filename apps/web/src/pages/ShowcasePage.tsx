import { useState, type FormEvent } from 'react';
import {
  // Primitives
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  Progress,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  TooltipProvider,
  // Composites — existing
  toast,
  PageShell,
  StatusBadge,
  SearchInput,
  StatCard,
  UserAvatar,
  AvatarGroup,
  type AvatarGroupItem,
  ProgressRing,
  CopyButton,
  FilterButton,
  ConfirmDialog,
  SettingsSection,
  SettingsField,
  // App Shell
  AppShell,
  AppSidebar,
  AppSidebarMobile,
  AppHeader,
  useSidebarState,
  type NavItem,
  type BreadcrumbItem,
  type AppShellUser,
  // NoAccess
  NoAccess,
  // DataTable
  DataTable,
  type DataTableColumnDef,
  type SortState,
  type PaginationState,
  // Page Patterns
  ListPage,
  DetailPage,
  type DetailPageTab,
  FormPage,
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
  Edit,
  Trash2,
  Eye,
  Bell,
  Shield,
  Palette,
  Globe,
  ShieldX,
  ClipboardList,
  History,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

type PageKey = 'dashboard' | 'documents' | 'doc-detail' | 'team' | 'settings' | 'no-access' | 'new-document';

/* ------------------------------------------------------------------ */
/*  NAV                                                                */
/* ------------------------------------------------------------------ */

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    key: 'documents',
    label: 'Documents',
    icon: FileText,
    badge: <Badge variant="outline" className="text-[10px] px-1.5 py-0">8</Badge>,
  },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'no-access', label: 'Restricted', icon: ShieldX },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const CURRENT_USER: AppShellUser = {
  name: 'May Solanki',
  email: 'may@brdplatform.io',
  role: 'Admin',
};

/* ------------------------------------------------------------------ */
/*  MOCK DATA                                                          */
/* ------------------------------------------------------------------ */

interface Document {
  id: string;
  name: string;
  status: string;
  author: string;
  priority: string;
  date: string;
}

const ALL_DOCUMENTS: Document[] = [
  { id: 'BRD-001', name: 'ERP Integration Spec', status: 'In Progress', author: 'May Solanki', priority: 'High', date: '2025-01-10' },
  { id: 'BRD-002', name: 'Payment Gateway Requirements', status: 'Completed', author: 'Alex Chen', priority: 'Critical', date: '2025-01-08' },
  { id: 'BRD-003', name: 'User Auth Module', status: 'Pending Review', author: 'Sarah Kim', priority: 'Medium', date: '2025-01-05' },
  { id: 'BRD-004', name: 'Inventory Management', status: 'Draft', author: 'James Liu', priority: 'Low', date: '2025-01-03' },
  { id: 'BRD-005', name: 'Report Engine v2', status: 'In Progress', author: 'May Solanki', priority: 'High', date: '2025-01-02' },
  { id: 'BRD-006', name: 'Notification Service', status: 'Rejected', author: 'Alex Chen', priority: 'Medium', date: '2024-12-28' },
  { id: 'BRD-007', name: 'Dashboard Analytics', status: 'Completed', author: 'Sarah Kim', priority: 'High', date: '2024-12-22' },
  { id: 'BRD-008', name: 'Multi-tenant Architecture', status: 'Active', author: 'James Liu', priority: 'Critical', date: '2024-12-20' },
];

const TEAM_MEMBERS: AvatarGroupItem[] = [
  { id: '1', name: 'May Solanki', avatarUrl: undefined },
  { id: '2', name: 'Alex Chen', avatarUrl: undefined },
  { id: '3', name: 'Sarah Kim', avatarUrl: undefined },
  { id: '4', name: 'James Liu', avatarUrl: undefined },
  { id: '5', name: 'Priya Patel', avatarUrl: undefined },
];

/* ------------------------------------------------------------------ */
/*  DASHBOARD PAGE                                                     */
/* ------------------------------------------------------------------ */

function ShowcaseDashboard() {
  return (
    <PageShell>
      <PageShell.Body padded scroll>
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={FileText} label="Total BRDs" value={24} iconClassName="bg-primary/10 text-primary" />
            <StatCard icon={TrendingUp} label="In Progress" value={8} iconClassName="bg-info/10 text-info" />
            <StatCard icon={Clock} label="Pending Review" value={5} iconClassName="bg-warning/10 text-warning" />
            <StatCard icon={CheckCircle2} label="Completed" value={11} iconClassName="bg-success/10 text-success" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Documents</CardTitle>
                <CardDescription>Latest BRD submissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ALL_DOCUMENTS.slice(0, 4).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                        <div>
                          <span className="text-sm font-medium text-foreground">{doc.name}</span>
                          <p className="text-xs text-muted-foreground">{doc.id} &middot; {doc.author}</p>
                        </div>
                      </div>
                      <StatusBadge label={doc.status} size="xs" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sprint Progress</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <ProgressRing progress={72} size="lg" />
                <p className="text-xs text-muted-foreground">72% of sprint goals completed</p>
                <Separator />
                <div className="w-full space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">Requirements</span>
                      <span className="font-medium">85%</span>
                    </div>
                    <Progress value={85} />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">Technical Specs</span>
                      <span className="font-medium">60%</span>
                    </div>
                    <Progress value={60} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageShell.Body>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/*  DOCUMENTS PAGE — DataTable + ListPage                              */
/* ------------------------------------------------------------------ */

function ShowcaseDocuments({ onViewDoc }: { onViewDoc: (doc: Document) => void }) {
  const [search, setSearch] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sort, setSort] = useState<SortState | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, pageSize: 25, total: ALL_DOCUMENTS.length });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = ALL_DOCUMENTS.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: DataTableColumnDef<Document>[] = [
    { id: 'id', header: 'ID', sortable: true, width: 100, cell: (row) => <span className="font-mono text-xs text-muted-foreground">{row.id}</span> },
    { id: 'name', header: 'Name', sortable: true, cell: (row) => <span className="text-sm font-medium">{row.name}</span> },
    {
      id: 'author', header: 'Author', cell: (row) => (
        <div className="flex items-center gap-2">
          <UserAvatar name={row.author} className="h-6 w-6 text-[10px]" />
          <span className="text-xs">{row.author}</span>
        </div>
      ),
    },
    {
      id: 'priority', header: 'Priority', cell: (row) => (
        <Badge variant={row.priority === 'Critical' ? 'destructive' : row.priority === 'High' ? 'default' : 'outline'}>
          {row.priority}
        </Badge>
      ),
    },
    { id: 'status', header: 'Status', cell: (row) => <StatusBadge label={row.status} size="xs" /> },
    { id: 'date', header: 'Date', sortable: true, cell: (row) => <span className="text-xs text-muted-foreground">{row.date}</span> },
  ];

  return (
    <>
      <ListPage
        state="ready"
        actionBarChildren={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Search documents..." size="sm" />
            <FilterButton activeCount={0} />
          </>
        }
        actionBarRight={
          <Button size="xs" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Document
          </Button>
        }
      >
        <DataTable
          columns={columns}
          data={filtered}
          getRowId={(row) => row.id}
          sort={sort}
          onSort={setSort}
          pagination={pagination}
          onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
          onPageSizeChange={(s) => setPagination((prev) => ({ ...prev, pageSize: s, page: 1 }))}
          selectable
          selected={selected}
          onSelectionChange={setSelected}
          stickyHeader
          onRowClick={onViewDoc}
          rowActions={[
            { key: 'view', label: 'View', icon: Eye, onClick: onViewDoc },
            { key: 'edit', label: 'Edit', icon: Edit, onClick: (row) => toast.success(`Editing ${row.name}`) },
            { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onClick: () => setConfirmOpen(true) },
          ]}
          emptyTitle="No documents found"
          emptyDescription="Try adjusting your search or create a new document."
        />
      </ListPage>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete document?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={() => {
          toast.success('Document deleted');
          setConfirmOpen(false);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  DOCUMENT DETAIL PAGE — DetailPage with tabs                        */
/* ------------------------------------------------------------------ */

const DETAIL_TABS: DetailPageTab[] = [
  { key: 'overview', label: 'Overview', icon: Eye },
  { key: 'requirements', label: 'Requirements', icon: ClipboardList, count: 12 },
  { key: 'history', label: 'History', icon: History, count: 5 },
];

function ShowcaseDocumentDetail({ doc, onBack }: { doc: Document; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <DetailPage
      state="ready"
      title={doc.name}
      onBack={onBack}
      badge={<StatusBadge label={doc.status} size="xs" />}
      headerRight={
        <Button size="xs" variant="outline" className="gap-1.5">
          <Edit className="h-3.5 w-3.5" />
          Edit
        </Button>
      }
      tabs={DETAIL_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div className="p-5">
        {activeTab === 'overview' && (
          <div className="mx-auto max-w-2xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Document Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ID</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{doc.id}</span>
                    <CopyButton value={doc.id} />
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Author</span>
                  <div className="flex items-center gap-2">
                    <UserAvatar name={doc.author} className="h-5 w-5 text-[9px]" />
                    <span>{doc.author}</span>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Priority</span>
                  <Badge variant={doc.priority === 'Critical' ? 'destructive' : 'outline'}>{doc.priority}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span>{doc.date}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Team</CardTitle>
              </CardHeader>
              <CardContent>
                <AvatarGroup participants={TEAM_MEMBERS.slice(0, 3)} max={3} size="md" />
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'requirements' && (
          <div className="mx-auto max-w-2xl space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-3 py-3">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm">Requirement {i + 1}: {['User authentication flow', 'Data export API', 'Notification system', 'Role-based access', 'Audit logging'][i]}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="mx-auto max-w-2xl space-y-3">
            {['Created document', 'Updated requirements', 'Changed status to In Progress', 'Added team members', 'Updated priority'].map((entry, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <History className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm">{entry}</p>
                  <p className="text-xs text-muted-foreground">{i + 1} day{i > 0 ? 's' : ''} ago</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DetailPage>
  );
}

/* ------------------------------------------------------------------ */
/*  NEW DOCUMENT PAGE — FormPage                                       */
/* ------------------------------------------------------------------ */

function ShowcaseNewDocument({ onBack }: { onBack: () => void }) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success('Document created!');
      onBack();
    }, 1500);
  };

  return (
    <FormPage
      state="ready"
      title="New Document"
      onBack={onBack}
      onSubmit={handleSubmit}
      onCancel={onBack}
      submitLabel="Create Document"
      submitting={submitting}
      size="md"
    >
      <div className="space-y-6">
        <SettingsSection title="Details" subtitle="Basic document information" icon={FileText}>
          <SettingsField label="Title" id="doc-title" hint="A descriptive name for this BRD">
            <Input placeholder="Enter document title..." />
          </SettingsField>
          <SettingsField label="Priority" id="doc-priority" hint="How urgent is this document?">
            <Select>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsSection>
      </div>
    </FormPage>
  );
}

/* ------------------------------------------------------------------ */
/*  TEAM PAGE — DataTable reuse                                        */
/* ------------------------------------------------------------------ */

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

const TEAM_DATA: TeamMember[] = TEAM_MEMBERS.map((m, i) => ({
  id: m.id,
  name: m.name,
  email: `${m.name.toLowerCase().replace(' ', '.')}@company.com`,
  role: i === 0 ? 'Admin' : i < 3 ? 'Editor' : 'Viewer',
  status: i < 4 ? 'Active' : 'Invited',
}));

function ShowcaseTeam() {
  const columns: DataTableColumnDef<TeamMember>[] = [
    {
      id: 'name', header: 'Member', cell: (row) => (
        <div className="flex items-center gap-3">
          <UserAvatar name={row.name} className="h-8 w-8 text-xs" />
          <div>
            <p className="text-sm font-medium">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'role', header: 'Role', cell: (row) => (
        <Badge variant={row.role === 'Admin' ? 'default' : 'outline'}>{row.role}</Badge>
      ),
    },
    { id: 'status', header: 'Status', cell: (row) => <StatusBadge label={row.status} size="xs" /> },
  ];

  return (
    <ListPage
      state="ready"
      actionBarRight={
        <Button size="xs" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Invite Member
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={TEAM_DATA}
        getRowId={(row) => row.id}
      />
    </ListPage>
  );
}

/* ------------------------------------------------------------------ */
/*  SETTINGS PAGE — FormPage                                           */
/* ------------------------------------------------------------------ */

function ShowcaseSettings() {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.success('Settings saved!');
  };

  return (
    <FormPage
      state="ready"
      title="Settings"
      onSubmit={handleSubmit}
      submitLabel="Save Changes"
      size="md"
    >
      <div className="space-y-6">
        <SettingsSection title="General" subtitle="Basic workspace settings" icon={Globe}>
          <SettingsField label="Workspace Name" id="ws-name" hint="The display name for your workspace">
            <Input defaultValue="BRD Platform" className="max-w-xs" />
          </SettingsField>
          <SettingsField label="Default Language" id="ws-lang" hint="Primary language for documents">
            <Select>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="English" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsSection>

        <SettingsSection title="Notifications" subtitle="Configure alerts" icon={Bell}>
          <SettingsField label="Email Notifications" id="notif-email" hint="Receive updates via email">
            <Switch defaultChecked />
          </SettingsField>
          <SettingsField label="Push Notifications" id="notif-push" hint="Browser push notifications">
            <Switch />
          </SettingsField>
        </SettingsSection>

        <SettingsSection title="Appearance" subtitle="Look and feel" icon={Palette}>
          <SettingsField label="Dense Mode" id="dense" hint="Compact spacing for data-heavy views">
            <Switch defaultChecked />
          </SettingsField>
        </SettingsSection>

        <SettingsSection title="Security" subtitle="Access and permissions" icon={Shield}>
          <SettingsField label="Two-Factor Auth" id="2fa" hint="Extra layer of security">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Enable 2FA
            </Button>
          </SettingsField>
          <SettingsField label="API Key" id="api-key" hint="For programmatic access">
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-xs">brd_sk_••••••••••••</code>
              <CopyButton value="brd_sk_example_key_12345" />
            </div>
          </SettingsField>
        </SettingsSection>
      </div>
    </FormPage>
  );
}

/* ------------------------------------------------------------------ */
/*  NO ACCESS PAGE                                                     */
/* ------------------------------------------------------------------ */

function ShowcaseNoAccess() {
  return (
    <PageShell>
      <PageShell.Body scroll>
        <NoAccess variant="full" />
      </PageShell.Body>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/*  SHOWCASE SHELL                                                     */
/* ------------------------------------------------------------------ */

function getBreadcrumbs(page: PageKey, doc?: Document | null): BreadcrumbItem[] {
  const home: BreadcrumbItem = { label: 'Home' };
  switch (page) {
    case 'dashboard':
      return [home, { label: 'Dashboard' }];
    case 'documents':
      return [home, { label: 'Documents' }];
    case 'doc-detail':
      return [home, { label: 'Documents' }, { label: doc?.name ?? 'Detail' }];
    case 'new-document':
      return [home, { label: 'Documents' }, { label: 'New Document' }];
    case 'team':
      return [home, { label: 'Team' }];
    case 'settings':
      return [home, { label: 'Settings' }];
    case 'no-access':
      return [home, { label: 'Restricted' }];
    default:
      return [home];
  }
}

export function ShowcasePage() {
  const { collapsed, toggle } = useSidebarState();
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const activeKey = activePage === 'doc-detail' || activePage === 'new-document' ? 'documents' : activePage;

  const handleNavClick = (key: string) => {
    setActivePage(key as PageKey);
    setSelectedDoc(null);
    setMobileOpen(false);
  };

  const navItems: NavItem[] = NAV_ITEMS.map((item) => ({
    ...item,
    onClick: () => handleNavClick(item.key),
  }));

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <ShowcaseDashboard />;
      case 'documents':
        return (
          <ShowcaseDocuments
            onViewDoc={(doc) => {
              setSelectedDoc(doc);
              setActivePage('doc-detail');
            }}
          />
        );
      case 'doc-detail':
        return selectedDoc ? (
          <ShowcaseDocumentDetail doc={selectedDoc} onBack={() => setActivePage('documents')} />
        ) : null;
      case 'new-document':
        return <ShowcaseNewDocument onBack={() => setActivePage('documents')} />;
      case 'team':
        return <ShowcaseTeam />;
      case 'settings':
        return <ShowcaseSettings />;
      case 'no-access':
        return <ShowcaseNoAccess />;
      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <AppShell
        sidebar={
          <AppSidebar
            items={navItems}
            activeKey={activeKey}
            collapsed={collapsed}
            onToggle={toggle}
            branding={
              collapsed ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                  B
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                    B
                  </div>
                  <span className="text-sm font-semibold text-foreground">BRD Platform</span>
                </div>
              )
            }
            user={CURRENT_USER}
            onLogout={() => toast.success('Logged out')}
          />
        }
      >
        {/* Mobile sidebar */}
        <AppSidebarMobile
          items={navItems}
          activeKey={activeKey}
          open={mobileOpen}
          onOpenChange={setMobileOpen}
          branding={
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                B
              </div>
              <span className="text-sm font-semibold text-foreground">BRD Platform</span>
            </div>
          }
          user={CURRENT_USER}
          onLogout={() => toast.success('Logged out')}
        />

        {/* Header */}
        <AppHeader
          breadcrumbs={getBreadcrumbs(activePage, selectedDoc)}
          user={CURRENT_USER}
          onLogout={() => toast.success('Logged out')}
          onMobileMenuOpen={() => setMobileOpen(true)}
          userMenuActions={[
            { key: 'settings', label: 'Settings', icon: Settings, onClick: () => setActivePage('settings') },
          ]}
        />

        {/* Page content */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {renderPage()}
        </main>
      </AppShell>
    </TooltipProvider>
  );
}
