// The review list. Add a version here and it appears on the versions page.
// status: 'draft' | 'in review' | 'chosen'
export const versions = [
  {
    id: 'v1',
    title: 'The tiny planet',
    status: 'in review',
    summary: 'One continuous 3D world. The envelope opens on the names, then the view travels around a pastel planet from event to event.',
    notes: ['Full 3D throughout', 'Vivaldi, Spring'],
  },
  {
    id: 'v2',
    title: 'The moving storybook',
    status: 'draft',
    summary: 'The 3D opening dissolves into paint: a watercolour scene for each event, then back out to the globe for the countdown.',
    notes: ['3D opening and finale, painted events', 'Scroll back to step back through the scenes'],
  },
  {
    id: 'v3',
    title: 'The moving storybook, tap to open',
    status: 'draft',
    summary: 'The same storybook and paintings with a simpler opening: one tap turns the sealed envelope over and it opens, and the scenes play on their own.',
    notes: ['Variation of V2', 'One tap opens the envelope'],
  },
];
