export interface SampleNotification {
  id: string;
  title: string;
  body: string;
  time: string;
}

/** Placeholder content until live notifications exist; the bell labels it as sample data. */
export const SAMPLE_NOTIFICATIONS: SampleNotification[] = [
  {
    id: 'sample-1',
    title: 'A question needs your answer',
    body: 'Three open questions were added to a project you work on.',
    time: '2 hours ago',
  },
  {
    id: 'sample-2',
    title: 'A source finished processing',
    body: 'New requirements were found and are ready to review.',
    time: 'Yesterday',
  },
  {
    id: 'sample-3',
    title: 'A report is waiting for approval',
    body: 'An analyst submitted an understanding report.',
    time: '2 days ago',
  },
];
