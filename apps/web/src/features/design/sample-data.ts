export type SampleStatus = 'OPEN' | 'CONFIRMED' | 'NEEDS_REVIEW';

export interface SampleRequirement {
  id: string;
  title: string;
  description: string;
  status: SampleStatus;
  owner: string | null;
  modules: string[];
  updatedAt: string;
  mine: boolean;
}

export const SAMPLE_STATUS_LABELS: Record<SampleStatus, string> = {
  OPEN: 'Open',
  CONFIRMED: 'Confirmed',
  NEEDS_REVIEW: 'Needs review',
};

export const SAMPLE_STATUS_TONES: Record<SampleStatus, 'warning' | 'success' | 'danger'> = {
  OPEN: 'warning',
  CONFIRMED: 'success',
  NEEDS_REVIEW: 'danger',
};

/** Invented rows for the design page. Nothing here comes from, or goes to, the server. */
export const SAMPLE_REQUIREMENTS: SampleRequirement[] = [
  {
    id: 'r1',
    title: 'Send invoices within 3 days of delivery',
    description:
      'Every delivered order must be invoiced within three calendar days, or the account manager is alerted.',
    status: 'OPEN',
    owner: 'Asha Rao',
    modules: ['Billing', 'Orders', 'Alerts', 'Accounts', 'Reports'],
    updatedAt: '2026-10-16T08:30:00.000Z',
    mine: true,
  },
  {
    id: 'r2',
    title: 'VAT is 20% on every invoice',
    description: 'The VAT rate is applied to the invoice total, rounded to two decimals.',
    status: 'CONFIRMED',
    owner: 'Ben Ortiz',
    modules: ['Billing'],
    updatedAt: '2026-10-15',
    mine: false,
  },
  {
    id: 'r3',
    title: 'Credit notes need approver sign-off',
    description: 'A credit note above 500 requires an approver before it posts to the ledger.',
    status: 'NEEDS_REVIEW',
    owner: null,
    modules: ['Billing', 'Approvals'],
    updatedAt: '2026-10-14T16:05:00.000Z',
    mine: true,
  },
  {
    id: 'r4',
    title: 'Customers can download statements as PDF',
    description: 'A statement covers one calendar month and lists invoices, credits and payments.',
    status: 'OPEN',
    owner: 'Asha Rao',
    modules: ['Accounts'],
    updatedAt: '2026-10-12',
    mine: false,
  },
];

export interface SampleComment {
  id: string;
  author: string;
  text: string;
  time: string;
}

export const SAMPLE_ACTIVITY = [
  { id: 'a1', text: 'Status set to Open', time: '16 Oct, 2026' },
  { id: 'a2', text: 'Linked to the Billing module', time: '15 Oct, 2026' },
  { id: 'a3', text: 'Extracted from Billing BRD', time: '14 Oct, 2026' },
];

export const SAMPLE_COMMENTS: SampleComment[] = [
  { id: 'c1', author: 'Ben Ortiz', text: 'Does the 3 days include weekends?', time: 'Yesterday' },
];

export const SAMPLE_MODULE_OPTIONS = [
  'Billing',
  'Orders',
  'Alerts',
  'Accounts',
  'Reports',
  'Approvals',
].map((name) => ({
  value: name.toLowerCase(),
  label: name,
}));
