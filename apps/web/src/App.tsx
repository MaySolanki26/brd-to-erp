import { useState } from 'react';
import {
  // Primitives
  Button,
  Input,
  Textarea,
  Label,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Switch,
  Slider,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Separator,
  Skeleton,
  Progress,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Calendar,
  // Composites
  ToastProvider,
  toast,
  PageShell,
  InformativeBar,
  ActionBar,
  ErrorBoundary,
  StatusBadge,
  SearchInput,
  StatCard,
  SwitcherBar,
  type SwitcherItem,
  UserAvatar,
  AvatarGroup,
  type AvatarGroupItem,
  ProgressRing,
  CopyButton,
  TruncatedText,
  ViewToggle,
  type ViewMode,
  FilterButton,
  ConfirmDialog,
  TableSkeleton,
  CardListSkeleton,
  SettingsSection,
  SettingsField,
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
  PanelRight,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Download,
  Eye,
  Bell,
  Shield,
  Palette,
  Globe,
  ChevronRight,
  Info,
  Component,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  NAV                                                                */
/* ------------------------------------------------------------------ */

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'components', label: 'Components', icon: Component },
  { key: 'settings', label: 'Settings', icon: Settings },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]['key'];

/* ------------------------------------------------------------------ */
/*  MOCK DATA                                                          */
/* ------------------------------------------------------------------ */

const DOCUMENTS = [
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

function DashboardContent() {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileText} label="Total BRDs" value={24} iconClassName="bg-primary/10 text-primary" />
        <StatCard icon={TrendingUp} label="In Progress" value={8} iconClassName="bg-info/10 text-info" />
        <StatCard icon={Clock} label="Pending Review" value={5} iconClassName="bg-warning/10 text-warning" />
        <StatCard icon={CheckCircle2} label="Completed" value={11} iconClassName="bg-success/10 text-success" />
      </div>

      {/* Recent documents */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Documents</CardTitle>
          <CardDescription>Latest BRD submissions across all projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DOCUMENTS.slice(0, 4).map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <div>
                    <span className="text-sm font-medium text-foreground">{doc.name}</span>
                    <p className="text-xs text-muted-foreground">{doc.id} &middot; {doc.author}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge label={doc.status} size="xs" />
                  <span className="text-xs text-muted-foreground">{doc.date}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Progress overview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sprint Progress</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <ProgressRing progress={72} size="lg" />
            <p className="text-xs text-muted-foreground">72% of sprint goals completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Document Completion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">UI/UX Design</span>
                <span className="font-medium">45%</span>
              </div>
              <Progress value={45} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AvatarGroup participants={TEAM_MEMBERS} max={4} size="md" />
            <p className="text-xs text-muted-foreground">{TEAM_MEMBERS.length} active members</p>
            <Separator />
            {TEAM_MEMBERS.slice(0, 3).map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <UserAvatar name={m.name} className="h-6 w-6 text-[10px]" />
                <span className="text-xs text-foreground">{m.name}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DOCUMENTS PAGE — full table                                        */
/* ------------------------------------------------------------------ */

function DocumentsContent() {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('tabs');
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const filtered = DOCUMENTS.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.id.toLowerCase().includes(search.toLowerCase()),
  );

  if (showSkeleton) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Loading documents...</h3>
          <Button size="xs" variant="outline" onClick={() => setShowSkeleton(false)}>
            Stop Loading
          </Button>
        </div>
        <TableSkeleton
          columns={[
            { kind: 'text', widthClass: 'w-16' },
            { kind: 'text', widthClass: 'w-40' },
            { kind: 'avatar' },
            { kind: 'badge' },
            { kind: 'badge' },
            { kind: 'text', widthClass: 'w-20' },
            { kind: 'icon' },
          ]}
          rows={5}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search documents..." size="sm" />
          <FilterButton activeCount={0} />
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
        </div>
        <div className="flex items-center gap-2">
          <Button size="xs" variant="outline" onClick={() => setShowSkeleton(true)}>
            Show Skeleton
          </Button>
          <Button size="xs" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Document
          </Button>
        </div>
      </div>

      {/* Table view */}
      {viewMode === 'tabs' ? (
        <Card>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{doc.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TruncatedText text={doc.name} className="text-sm font-medium max-w-[240px]" />
                        <CopyButton value={doc.name} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar name={doc.author} className="h-6 w-6 text-[10px]" />
                        <span className="text-xs">{doc.author}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={doc.priority === 'Critical' ? 'destructive' : doc.priority === 'High' ? 'default' : 'outline'}
                      >
                        {doc.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={doc.status} size="xs" />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{doc.date}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toast.success(`Viewing ${doc.name}`)}>
                            <Eye className="mr-2 h-3.5 w-3.5" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success(`Editing ${doc.name}`)}>
                            <Edit className="mr-2 h-3.5 w-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success('Copied to clipboard')}>
                            <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="mr-2 h-3.5 w-3.5" /> Export
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmOpen(true)}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No documents match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        /* Card list view */
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => (
            <Card key={doc.id} className="cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {doc.id}
                  </Badge>
                  <StatusBadge label={doc.status} size="xs" />
                </div>
                <CardTitle className="text-sm">{doc.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <UserAvatar name={doc.author} className="h-5 w-5 text-[9px]" />
                    {doc.author}
                  </div>
                  <span>{doc.date}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete document?"
        description="This action cannot be undone. The document and all its versions will be permanently removed."
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={() => {
          toast.success('Document deleted');
          setConfirmOpen(false);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TEAM PAGE                                                          */
/* ------------------------------------------------------------------ */

function TeamContent() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Team Members</h3>
          <p className="text-xs text-muted-foreground">{TEAM_MEMBERS.length} people in this workspace</p>
        </div>
        <Button size="xs" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Invite Member
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {TEAM_MEMBERS.map((member, i) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <UserAvatar name={member.name} className="h-8 w-8 text-xs" />
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.name.toLowerCase().replace(' ', '.')}@company.com
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={i === 0 ? 'default' : 'outline'}>
                    {i === 0 ? 'Admin' : i < 3 ? 'Editor' : 'Viewer'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge label={i < 4 ? 'Active' : 'Invited'} size="xs" />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  COMPONENTS SHOWCASE PAGE                                           */
/* ------------------------------------------------------------------ */

function ComponentsContent() {
  const [sliderVal, setSliderVal] = useState([40]);
  const [switchOn, setSwitchOn] = useState(true);
  const [checkVal, setCheckVal] = useState(true);
  const [dateVal, setDateVal] = useState<Date | undefined>(undefined);
  const [showCardSkeleton, setShowCardSkeleton] = useState(false);

  return (
    <div className="space-y-8">
      {/* ---- Form Controls ---- */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-foreground">Form Controls</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Inputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Enter your name..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" placeholder="Tell us about yourself..." rows={3} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Selection Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="terms"
                  checked={checkVal}
                  onCheckedChange={(v) => setCheckVal(v === true)}
                />
                <Label htmlFor="terms" className="cursor-pointer">Accept terms and conditions</Label>
              </div>

              <div className="flex items-center justify-between">
                <Label>Enable notifications</Label>
                <Switch checked={switchOn} onCheckedChange={setSwitchOn} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Volume</Label>
                  <span className="text-xs text-muted-foreground">{sliderVal[0]}%</span>
                </div>
                <Slider value={sliderVal} onValueChange={setSliderVal} max={100} step={1} />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ---- Overlays ---- */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-foreground">Overlays & Popups</h2>
        <Card>
          <CardContent className="flex flex-wrap gap-3 pt-6">
            {/* Dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">Open Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New BRD</DialogTitle>
                  <DialogDescription>Fill in the details below to create a new Business Requirements Document.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="dlg-title">Document Title</Label>
                    <Input id="dlg-title" placeholder="Enter title..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dlg-desc">Description</Label>
                    <Textarea id="dlg-desc" placeholder="Brief description..." rows={3} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button onClick={() => toast.success('Document created!')}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Sheet */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <PanelRight className="h-3.5 w-3.5" />
                  Open Sheet
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Document Details</SheetTitle>
                  <SheetDescription>View and edit the document properties.</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input defaultValue="ERP Integration Spec" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="In Progress" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="review">Pending Review</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Textarea rows={4} placeholder="Add notes..." />
                  </div>
                  <Separator />
                  <Button className="w-full" onClick={() => toast.success('Saved!')}>Save Changes</Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    Hover for Tooltip
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This is a tooltip built with Radix UI</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">Open Popover</Button>
              </PopoverTrigger>
              <PopoverContent className="w-72">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Quick Filter</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox id="f1" />
                      <Label htmlFor="f1" className="cursor-pointer text-xs">In Progress</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="f2" />
                      <Label htmlFor="f2" className="cursor-pointer text-xs">Completed</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="f3" />
                      <Label htmlFor="f3" className="cursor-pointer text-xs">Draft</Label>
                    </div>
                  </div>
                  <Button size="xs" className="w-full">Apply</Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Dropdown menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">Dropdown Menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem><Eye className="mr-2 h-3.5 w-3.5" /> View</DropdownMenuItem>
                <DropdownMenuItem><Edit className="mr-2 h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                <DropdownMenuItem><Copy className="mr-2 h-3.5 w-3.5" /> Duplicate</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Toast triggers */}
            <Button size="sm" variant="outline" onClick={() => toast.success('Success toast!')}>
              Success Toast
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast.error('Error toast!')}>
              Error Toast
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* ---- Data Display ---- */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-foreground">Data Display</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Badges & Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Badges & Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Badge variants</p>
                <div className="flex flex-wrap gap-2">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                </div>
              </div>
              <Separator />
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Status badges (auto-detect tone)</p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label="Active" />
                  <StatusBadge label="Pending" />
                  <StatusBadge label="In Progress" />
                  <StatusBadge label="Completed" />
                  <StatusBadge label="Rejected" />
                  <StatusBadge label="Archived" />
                </div>
              </div>
              <Separator />
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Explicit tones</p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge label="Success" tone="success" />
                  <StatusBadge label="Warning" tone="warning" />
                  <StatusBadge label="Danger" tone="danger" />
                  <StatusBadge label="Info" tone="info" />
                  <StatusBadge label="Brand" tone="brand" />
                  <StatusBadge label="Neutral" tone="neutral" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Avatars & CopyButton */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Avatars & Utilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">UserAvatar sizes</p>
                <div className="flex items-end gap-3">
                  <UserAvatar name="May Solanki" className="h-6 w-6 text-[9px]" />
                  <UserAvatar name="Alex Chen" className="h-8 w-8 text-xs" />
                  <UserAvatar name="Sarah Kim" className="h-10 w-10 text-sm" />
                  <UserAvatar name="James Liu" className="h-12 w-12 text-base" />
                </div>
              </div>
              <Separator />
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">AvatarGroup</p>
                <AvatarGroup participants={TEAM_MEMBERS} max={3} size="md" />
              </div>
              <Separator />
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">CopyButton</p>
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 text-xs">npm install @brd/ui</code>
                  <CopyButton value="npm install @brd/ui" />
                </div>
              </div>
              <Separator />
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">TruncatedText (resize to see)</p>
                <TruncatedText
                  text="This is a very long text that will be truncated when it overflows the container width"
                  className="text-sm max-w-[200px]"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ---- Accordion & Calendar ---- */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-foreground">Content & Navigation</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Accordion</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="req">
                  <AccordionTrigger>What is a BRD?</AccordionTrigger>
                  <AccordionContent>
                    A Business Requirements Document (BRD) captures the high-level business needs
                    and objectives that a solution must address. It serves as the bridge between
                    stakeholders and the technical team.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="process">
                  <AccordionTrigger>How does the BRD-to-ERP process work?</AccordionTrigger>
                  <AccordionContent>
                    The process involves uploading a BRD document, extracting requirements using
                    AI-powered analysis, mapping them to ERP modules, and generating implementation
                    specifications automatically.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="formats">
                  <AccordionTrigger>What file formats are supported?</AccordionTrigger>
                  <AccordionContent>
                    We support PDF, DOCX, and Markdown files. Documents can also be created directly
                    in the platform using the built-in editor.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Calendar</CardTitle>
              <CardDescription>
                {dateVal ? `Selected: ${dateVal.toLocaleDateString()}` : 'Pick a date'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={dateVal}
                onSelect={setDateVal}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ---- Tabs inside showcase ---- */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-foreground">Tabs & Progress</h2>
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="buttons">
              <TabsList>
                <TabsTrigger value="buttons">Buttons</TabsTrigger>
                <TabsTrigger value="progress">Progress</TabsTrigger>
                <TabsTrigger value="skeleton">Skeleton</TabsTrigger>
              </TabsList>

              <TabsContent value="buttons" className="space-y-4 pt-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Variants</p>
                  <div className="flex flex-wrap gap-2">
                    <Button>Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="destructive">Destructive</Button>
                    <Button variant="link">Link</Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Sizes</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="xs">Extra Small</Button>
                    <Button size="sm">Small</Button>
                    <Button size="default">Default</Button>
                    <Button size="lg">Large</Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="progress" className="space-y-6 pt-4">
                <div className="flex flex-wrap items-end gap-6">
                  <div className="flex flex-col items-center gap-1">
                    <ProgressRing progress={25} size="md" />
                    <span className="text-xs text-muted-foreground">Q1</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <ProgressRing progress={50} size="md" />
                    <span className="text-xs text-muted-foreground">Q2</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <ProgressRing progress={75} size="md" />
                    <span className="text-xs text-muted-foreground">Q3</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <ProgressRing progress={100} size="md" />
                    <span className="text-xs text-muted-foreground">Q4</span>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">25%</p>
                    <Progress value={25} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">50%</p>
                    <Progress value={50} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">75%</p>
                    <Progress value={75} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">100%</p>
                    <Progress value={100} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="skeleton" className="space-y-4 pt-4">
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant={showCardSkeleton ? 'default' : 'outline'}
                    onClick={() => setShowCardSkeleton(!showCardSkeleton)}
                  >
                    {showCardSkeleton ? 'Hide' : 'Show'} Card Skeleton
                  </Button>
                </div>
                {showCardSkeleton ? (
                  <CardListSkeleton rows={3} />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                    <Skeleton className="h-20 w-full rounded-lg" />
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-20 rounded-md" />
                      <Skeleton className="h-8 w-20 rounded-md" />
                      <Skeleton className="h-8 w-20 rounded-md" />
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SETTINGS PAGE                                                      */
/* ------------------------------------------------------------------ */

function SettingsContent() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
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

      <SettingsSection title="Notifications" subtitle="Configure how you receive alerts" icon={Bell}>
        <SettingsField label="Email Notifications" id="notif-email" hint="Receive updates via email">
          <Switch defaultChecked />
        </SettingsField>
        <SettingsField label="Push Notifications" id="notif-push" hint="Browser push notifications">
          <Switch />
        </SettingsField>
      </SettingsSection>

      <SettingsSection title="Appearance" subtitle="Customize the look and feel" icon={Palette}>
        <SettingsField label="Dense Mode" id="dense" hint="Compact spacing for data-heavy views">
          <Switch defaultChecked />
        </SettingsField>
      </SettingsSection>

      <SettingsSection title="Security" subtitle="Manage access and permissions" icon={Shield}>
        <SettingsField label="Two-Factor Authentication" id="2fa" hint="Add an extra layer of security">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Enable 2FA
          </Button>
        </SettingsField>
        <SettingsField label="API Key" id="api-key" hint="Use this key for API access">
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 text-xs">brd_sk_••••••••••••</code>
            <CopyButton value="brd_sk_example_key_12345" />
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SWITCHER ITEMS                                                     */
/* ------------------------------------------------------------------ */

const SWITCHER_ITEMS: SwitcherItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'documents', label: 'Documents', icon: FileText, count: DOCUMENTS.length },
  { key: 'team', label: 'Team', icon: Users, count: TEAM_MEMBERS.length },
];

/* ------------------------------------------------------------------ */
/*  APP SHELL                                                          */
/* ------------------------------------------------------------------ */

export function App(): React.JSX.Element {
  const [activeNav, setActiveNav] = useState<NavKey>('dashboard');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeNav) {
      case 'dashboard':
        return activeTab === 'documents' ? <DocumentsContent /> : activeTab === 'team' ? <TeamContent /> : <DashboardContent />;
      case 'documents':
        return <DocumentsContent />;
      case 'team':
        return <TeamContent />;
      case 'components':
        return <ComponentsContent />;
      case 'settings':
        return <SettingsContent />;
    }
  };

  return (
    <ErrorBoundary>
      <ToastProvider>
        <div className="flex h-screen bg-background">
          {/* Sidebar */}
          <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
            <div className="flex h-14 items-center gap-2 px-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                B
              </div>
              <span className="text-sm font-semibold text-foreground">BRD Platform</span>
            </div>
            <Separator />
            <nav className="flex-1 space-y-1 p-2">
              {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActiveNav(key);
                    if (key === 'dashboard') setActiveTab('dashboard');
                    else if (key === 'documents') setActiveTab('documents');
                    else if (key === 'team') setActiveTab('team');
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    activeNav === key
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                  {label}
                  {key === 'documents' && (
                    <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {DOCUMENTS.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <Separator />
            <div className="p-3">
              <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
                <UserAvatar name="May Solanki" className="h-8 w-8 text-xs" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">May Solanki</p>
                  <p className="truncate text-[10px] text-muted-foreground">Admin</p>
                </div>
                <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground" />
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex flex-1 flex-col overflow-hidden">
            <PageShell>
              <InformativeBar
                title={
                  activeNav === 'components'
                    ? 'Component Library'
                    : activeNav === 'settings'
                      ? 'Settings'
                      : 'BRD Platform'
                }
                badge={
                  activeNav === 'components' ? (
                    <Badge variant="outline">64 components</Badge>
                  ) : activeNav === 'settings' ? undefined : (
                    <Badge variant="outline">MVP</Badge>
                  )
                }
                info={
                  activeNav === 'components'
                    ? 'All extracted UI primitives and composites'
                    : activeNav === 'settings'
                      ? 'Manage your workspace'
                      : undefined
                }
              >
                {activeNav !== 'settings' && activeNav !== 'components' && (
                  <Button size="xs" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    New BRD
                  </Button>
                )}
              </InformativeBar>

              {activeNav === 'dashboard' && (
                <ActionBar bordered>
                  <SwitcherBar
                    items={SWITCHER_ITEMS}
                    value={activeTab}
                    onChange={setActiveTab}
                    variant="box"
                  />
                  <div className="ml-auto flex items-center gap-2">
                    <SearchInput value={search} onChange={setSearch} placeholder="Search..." size="sm" />
                  </div>
                </ActionBar>
              )}

              <PageShell.Body padded>
                {renderContent()}
              </PageShell.Body>
            </PageShell>
          </main>
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}
