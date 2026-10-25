/** Published dates, updated independently of course creation dates. Review before each new academic year. */
export const ACADEMIC_CALENDAR = {
  version: '2026-2027.2025-12-04',
  sourceUrl: 'https://oigusaktid.taltech.ee/akadeemilise-kalendri-kinnitamine-jargmiseks-oppeaastaks/',
  verifiedAt: '2025-12-04', reviewBy: '2027-06-01', validThrough: '2027-08-29',
  terms: [
    { start: '2025-09-01', teachingEnd: '2025-12-20', end: '2026-01-25' },
    { start: '2026-02-02', teachingEnd: '2026-05-24', end: '2026-06-15' },
    { start: '2026-08-31', teachingEnd: '2026-12-19', end: '2027-01-24' },
    { start: '2027-02-01', teachingEnd: '2027-05-23', end: '2027-06-13' },
  ],
} as const;
