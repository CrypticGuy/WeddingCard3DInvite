// The review list. Add a version here and it appears on the home page.
// status: 'draft' | 'in review' | 'chosen'
export const versions = [
  {
    id: 'v1',
    title: 'The tiny planet',
    status: 'in review',
    summary: 'One continuous 3D world. The beagle opens the envelope, then walks around a pastel planet from event to event.',
    notes: ['Full 3D throughout', 'Vivaldi, Spring'],
  },
  {
    id: 'v2',
    title: 'The moving storybook',
    status: 'draft',
    summary: 'The 3D opening dissolves into paint: four watercolour scenes the beagle walks through, then back out to the globe for the countdown.',
    notes: ['3D opening and finale, painted events', 'The pup shuffles backward when you scroll back'],
  },
  {
    id: 'v3',
    title: 'The moving storybook, without the pup',
    status: 'draft',
    summary: 'The same storybook and paintings with no dog anywhere: one tap turns the sealed envelope over and it opens, and the scenes play on their own.',
    notes: ['Variation of V2', 'No beagle, in 3D or in paint'],
  },
];
