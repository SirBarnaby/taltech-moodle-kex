import { describe, expect, it } from 'vitest';
import { parseCode, parseCourseName, parseSemester, splitTitle } from '../../src/data/names';

describe('parseCourseName: the 6 TalTech fullnames from my_courses.html', () => {
  const cases: [string, string, string, string, number, string][] = [
    ['IAS0230 Basics of Embedded Systems (2026 autumn)', 'IAS0230', 'Basics of Embedded Systems', 'autumn', 2026, ''],
    ['ITI8801 Cloud Architectures and DevOps (2026 autumn)', 'ITI8801', 'Cloud Architectures & DevOps', 'autumn', 2026, ''],
    ['EMT0140 Asjade internet tööstusele (2026 sügis)', 'EMT0140', 'Asjade internet tööstusele', 'autumn', 2026, ''],
    ['MMO5770 MMO5500 Management and Leadership (2026 sügis)', 'MMO5770', 'Management & Leadership', 'autumn', 2026, ''],
    ['ITB8833 E-riigi infotehnoloogilised lahendused / Digital state ICT solutions (2026 sügis/autumn)', 'ITB8833', 'Digital state ICT solutions', 'autumn', 2026, ''],
    ['IEE2630 Tarkade asjade võrgud (2026 sügis)', 'IEE2630', 'Tarkade asjade võrgud', 'autumn', 2026, ''],
  ];
  it.each(cases)('%s', (full, code, name, season, year) => {
    const r = parseCourseName('', full);
    expect(r.code).toBe(code);
    expect(r.name).toBe(name);
    expect(r.semester).toEqual({ season, year });
  });

  it('keeps the Estonian half when the UI language is et', () => {
    expect(parseCourseName('', 'ITB8833 E-riigi infotehnoloogilised lahendused / Digital state ICT solutions (2026 sügis/autumn)', '', 'et').name).toBe(
      'E-riigi infotehnoloogilised lahendused',
    );
  });
});

describe('parseCourseName: the 6 lab fullnames ("<name> (<code>)")', () => {
  const lab: [string, string, string, string][] = [
    ['ITI8801', 'Cloud Architectures and DevOps (2026 autumn) (ITI8801)', 'Cloud Architectures & DevOps', 'autumn'],
    ['EMT0140', 'Asjade internet tööstusele (2026 sügis) (EMT0140)', 'Asjade internet tööstusele', 'autumn'],
    ['IAS0230', 'Basics of Embedded Systems (2026 autumn) (IAS0230)', 'Basics of Embedded Systems', 'autumn'],
    ['MMO5770', 'MMO5500 Management and Leadership (2026 sügis) (MMO5770)', 'Management & Leadership', 'autumn'],
    ['ITB8833', 'E-riigi infotehnoloogilised lahendused / Digital state ICT solutions (2026 sügis/autumn) (ITB8833)', 'Digital state ICT solutions', 'autumn'],
    ['IEE2630', 'Tarkade asjade võrgud (2026 sügis) (IEE2630)', 'Tarkade asjade võrgud', 'autumn'],
  ];
  it.each(lab)('%s', (short, full, name, season) => {
    const r = parseCourseName(short, full, short);
    expect(r.code).toBe(short);
    expect(r.name).toBe(name);
    expect(r.semester).toEqual({ season, year: 2026 });
  });
});

describe('code, semester fallbacks and title split', () => {
  it('prefers the shortname, then fullname, then idnumber', () => {
    expect(parseCode('ABC1234', 'XYZ9999 Something', '')).toBe('ABC1234');
    expect(parseCode('misc', 'Intro XYZ9999', '')).toBe('XYZ9999');
    expect(parseCode('misc', 'Intro', 'QRS1111')).toBe('QRS1111');
  });
  it('derives the semester from the date when the name has none', () => {
    expect(parseSemester('No semester', new Date('2026-10-15'))).toEqual({ season: 'autumn', year: 2026 });
    expect(parseSemester('No semester', new Date('2027-01-10'))).toEqual({ season: 'autumn', year: 2026 });
    expect(parseSemester('No semester', new Date('2027-03-10'))).toEqual({ season: 'spring', year: 2027 });
  });
  it('splits the hero title', () => {
    expect(splitTitle('Cloud Architectures & DevOps')).toEqual(['Cloud Architectures', '& DevOps']);
    expect(splitTitle('Embedded Systems Design Basics')).toEqual(['Embedded Systems', 'Design Basics']);
    expect(splitTitle('Networks')).toEqual(['Networks']);
  });
});
