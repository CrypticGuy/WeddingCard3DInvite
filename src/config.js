// ─────────────────────────────────────────────────────────────
//  Everything guests read lives here. Edit this file only.
//  Dates use the venue's timezone offset (+05:30 = India).
// ─────────────────────────────────────────────────────────────

export const invite = {
  couple: { first: 'Parushi', second: 'Rishabh' },
  timeZone: 'Asia/Kolkata',

  // Background music, from public/v1/music. Licence details are in CREDITS.md there,
  // and this recording needs its credit line kept. Leave music empty for silence.
  // Named without an extension: phones on lower tiers get the smaller -lo.mp3 file.
  music: 'music/vivaldi-spring',
  musicCredit: 'Music: Vivaldi, Spring. John Harrison, violin. <a href="https://commons.wikimedia.org/wiki/File:Vivaldi_-_Four_Seasons_1_Spring_mvt_1_Allegro_-_John_Harrison_violin.oga" target="_blank" rel="noopener">CC BY-SA 4.0</a>',

  // Envelope + card wording
  envelopeLine: "You're invited",
  cardIntro: 'Together with their families',
  cardOutro: 'are getting married',

  // Hero line under the names, and the closing note
  heroLine: 'Three celebrations over two February evenings in Delhi. Come walk with us.',
  closingTitle: 'See you there',
  closingNote: 'Bring your dancing shoes. We will save you a spot on the floor.',

  // The hint at the foot of the opening screen: one line for mice, one for touch screens.
  scrollCue: { mouse: 'Scroll to see the events', touch: 'Swipe up to see the events' },

  // One entry per celebration, in order. The `id` picks the 3D scene, colours and card
  // art (mehendi, wedding, reception), so keep those three as they are.
  //   start     when it begins, with the venue's offset (+05:30 is India)
  //   end       optional. Without it the card says "6:00 PM onwards", and calendars get
  //             a four hour slot
  //   tagline   the line under the title; dress is the "Wear" line
  //   venue, address, near   shown on the card; near is an optional landmark
  //   maps      optional exact Google Maps link (a dropped pin). Empty searches Google
  //             Maps for "venue, address"
  //   sky       optional: the 3D sky follows the start time (morning blue to night
  //             indigo). Pick one by hand as an hour (sky: 19.5) or a name: morning,
  //             afternoon, golden, sunset, dusk, night
  // The countdown runs to the event flagged `main: true`.
  events: [
    {
      id: 'mehendi',
      title: 'Mehendi & Sangeet',
      tagline: 'Henna, music and dancing',
      start: '2027-02-09T18:00:00+05:30',
      venue: 'Vardaan by Sandoz',
      address: 'Dilli Haat, Netaji Subhash Place, Pitampura, Delhi 110034',
      near: 'Near Guru Gobind Singh College',
      maps: '',
      dress: 'Bright and festive',
    },
    {
      id: 'wedding',
      title: 'Wedding',
      tagline: 'Pheras under the evening sky',
      start: '2027-02-10T17:30:00+05:30',
      venue: 'City Park Green Resort',
      address: 'Palla Bhaktawar Pur Road, Bakoli, G.T. Karnal Road (NH-1), New Delhi 110039',
      maps: '',
      dress: 'Traditional finery',
      main: true,
    },
    {
      id: 'reception',
      title: 'Reception',
      tagline: 'Dinner and celebrations',
      start: '2027-02-10T20:00:00+05:30',
      venue: 'City Park Green Resort',
      address: 'Palla Bhaktawar Pur Road, Bakoli, G.T. Karnal Road (NH-1), New Delhi 110039',
      maps: '',
      dress: 'Evening glamour',
    },
  ],
};
