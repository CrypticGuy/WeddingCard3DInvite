// ─────────────────────────────────────────────────────────────
//  Everything guests read lives here. Edit this file only.
//  Dates use the venue's timezone offset (+05:30 = India).
// ─────────────────────────────────────────────────────────────

export const invite = {
  couple: { first: 'Parushi', second: 'Rishabh' },
  timeZone: 'Asia/Kolkata',

  // Optional recording. Put the file in public/ and name it here, for example
  // 'music.mp3'. Leave empty to use the built-in tanpura and bansuri score.
  music: '',

  // Envelope + card wording
  envelopeLine: "You're invited",
  cardIntro: 'Together with their families',
  cardOutro: 'are getting married',

  // Hero line under the names, and the closing note
  heroLine: 'Four celebrations on one tiny world. Come walk with us.',
  closingTitle: 'See you there',
  closingNote: 'Bring your dancing shoes. The pup is bringing the thread.',

  // Countdown runs to the event flagged `main: true`.
  // PLACEHOLDER DATES AND VENUES: replace with the real ones.
  events: [
    {
      id: 'mehendi',
      title: 'Mehendi',
      tagline: 'Henna, swings and garden songs',
      start: '2027-02-12T16:00:00+05:30',
      end: '2027-02-12T20:00:00+05:30',
      venue: 'Venue to be announced',
      address: '',
      mapUrl: '',
      dress: 'Garden greens',
    },
    {
      id: 'haldi',
      title: 'Haldi',
      tagline: 'Turmeric, marigolds and laughter',
      start: '2027-02-13T10:30:00+05:30',
      end: '2027-02-13T13:30:00+05:30',
      venue: 'Venue to be announced',
      address: '',
      mapUrl: '',
      dress: 'Sunshine yellows',
    },
    {
      id: 'sangeet',
      title: 'Sangeet',
      tagline: 'A night of music and lanterns',
      start: '2027-02-13T19:30:00+05:30',
      end: '2027-02-13T23:30:00+05:30',
      venue: 'Venue to be announced',
      address: '',
      mapUrl: '',
      dress: 'Dusk lilacs and sparkle',
    },
    {
      id: 'wedding',
      title: 'Wedding',
      tagline: 'Seven steps around the sacred fire',
      start: '2027-02-14T18:00:00+05:30',
      end: '2027-02-14T23:00:00+05:30',
      venue: 'Venue to be announced',
      address: '',
      mapUrl: '',
      dress: 'Blush and gold',
      main: true,
    },
  ],
};
