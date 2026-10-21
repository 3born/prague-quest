// Game content. Answers are intentionally NOT in this file: the judge keeps the key privately.
window.PQ = {
  CONFIG: {
    // Edit before game day. Prague is UTC+1 in winter (CET) and UTC+2 in summer (CEST).
    startAt: '2026-11-14T13:00:00+01:00',
    finishAt: '2026-11-14T16:00:00+01:00',
    startPlace: 'Old Town Square, by the Astronomical Clock',
    finishPlace: 'the pub',
    graceMinutes: 5,
    // CARTO basemaps now need a free key (https://carto.com/basemaps/apikey). Paste it here and
    // restrict it to 3born.github.io in the CARTO dashboard. Empty = OpenStreetMap tiles instead.
    cartoKey: '',
    // WhatsApp number answers are sent to (country code, no + or spaces).
    judgePhone: '',
    // All photos go to the Facebook chat. Optional: paste its Messenger link (m.me/...) to show
    // an "Open photo chat" button.
    photoChatName: 'the Facebook chat',
    photoChatUrl: '',
    teams: {
      a: { name: 'Team A', members: ['Calle', 'Fanny', 'Tessan', 'Måns'] },
      b: { name: 'Team B', members: ['Fredrik', 'Axel', 'Maja', 'Eskil', 'Brorsson'] },
    },
  },

  ROLES: [
    { name: 'Navigator', does: 'Leads the way and keeps an eye on the map.' },
    { name: 'Photographer', does: 'Frames the team selfie and posts it to the Facebook chat.' },
    { name: 'Riddle-solver', does: 'Reads the question aloud and leads the hunt for the answer.' },
    { name: 'Translator', does: 'Handles Czech signs, menus and talking to locals.' },
    { name: 'Scorekeeper', does: 'Types the answer and taps "Send to judge".' },
  ],

  // Coordinates are approximate: verify each pin in Google Maps before game day.
  STOPS: [
    {
      id: 1,
      name: 'Astronomical Clock',
      area: 'Old Town Square',
      lat: 50.08697, lng: 14.42068,
      intro: 'Running since 1410, the Orloj is the oldest astronomical clock still working. Watch the dial: it shows the sky, not just the time.',
      question: 'Which Latin words are written on the left (east) side of the dial\'s horizon line?',
      hint: 'Find where the blue sky meets the dark earth on the big dial. The small words sit just above that line.',
      bonus: 'Which zodiac sign is the golden Sun hand in right now? Note the time you looked.',
    },
    {
      id: 2,
      name: 'St. John of Nepomuk',
      area: 'Charles Bridge',
      lat: 50.08655, lng: 14.41228,
      intro: 'The oldest statue on the bridge (1683). Legend says the saint was thrown into the Vltava from here, and touching the bronze brings luck and a return to Prague.',
      question: 'How many stars circle his head, and which animal is in the polished bronze relief?',
      hint: 'Count above, then look down at the base: the luckiest spots are the shiniest ones.',
      bonus: 'Find the small brass cross on the bridge railing that marks where he was thrown. Get it in a photo.',
    },
    {
      id: 3,
      name: 'Černý fountain',
      area: 'Franz Kafka Museum, Cihelná 2b',
      lat: 50.08827, lng: 14.40962,
      intro: 'In the courtyard of the Kafka Museum, David Černý\'s two bronze men turn their hips and write with water. Cheeky, very Prague.',
      question: 'What shape is the pool the two men stand in?',
      hint: 'Forget circles and squares. Look at the outline as if it were drawn on a map.',
      bonus: 'Take a photo of the fountain with one teammate reacting as dramatically as they can.',
    },
    {
      id: 4,
      name: 'Lennon Wall',
      area: 'Velkopřevorské náměstí',
      lat: 50.08640, lng: 14.40695,
      intro: 'Covered in Beatles lyrics and protest graffiti since the 1980s, the wall gets repainted all the time. What you see today won\'t be there next month.',
      question: 'Which country\'s embassy is directly across from the wall?',
      hint: 'Turn around. Look for a flag and a plaque on the palace facing the wall.',
      bonus: 'Find a Beatles lyric or a Lennon reference on the wall today and write the words down.',
    },
    {
      id: 5,
      name: 'Petřín Tower',
      area: 'Petřín Hill',
      lat: 50.08354, lng: 14.39508,
      intro: 'Prague\'s mini Eiffel Tower, built for the 1891 Jubilee Exhibition. Walk up through the orchards or take the funicular. No ticket needed for this one.',
      question: 'Stand at the base. Guess how many steps lead to the top. Closest guess wins.',
      hint: 'The upper viewing platform is about 55 m up, and a typical step rises around 18 cm.',
      bonus: 'Find the Hunger Wall (Hladová zeď) nearby and get it in a team photo.',
    },
    {
      id: 6,
      name: 'St. Vitus Cathedral',
      area: 'Prague Castle, Golden Gate (south side)',
      lat: 50.09043, lng: 14.40088,
      intro: 'Kings were crowned here. On the south side, the Golden Gate glitters with a 14th-century Venetian glass mosaic of about a million tiny pieces.',
      question: 'What scene does the gold mosaic show?',
      hint: 'Look above the three arches. Who sits in the middle, and what is happening on either side?',
      bonus: 'Find a gargoyle on the cathedral and copy its face in your selfie.',
    },
  ],

  SNYT: {
    points: 2,
    text: 'The team that drinks the most šnyts before it\'s back at the finish gets +2. Post a photo of every šnyt in the Facebook chat. If it\'s a tie, both teams get the points.',
    url: 'https://www.pilsnerurquell.com/stories/foam-is-flavour-three-pilsner-urquell-pours/',
  },

  EXTRAS: [
    { id: 'cafe', name: 'Rest stop', points: 2, text: 'Sit down for 15 minutes. The team that drinks the most Hladinkas at its rest stop gets +2 (a tie gives both teams the points). Post a photo of your table in the Facebook chat.' },
    { id: 'local', name: 'Local challenge', points: 0, text: 'Just for fun: order something in Czech, or ask a local for their favourite spot in Prague.' },
  ],
};
