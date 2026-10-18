// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseCode, parseCourseName, parseSemester, splitTitle } from '../../src/data/names';

describe('course names', () => {
  it('parses the TalTech fullnames and the lab "<name> (<code>)" form into code, name and semester', () => {
    // [fullname, code, name, shortname for the lab form]
    const cases: [string, string, string, string?][] = [
      ['IAS0230 Basics of Embedded Systems (2026 autumn)', 'IAS0230', 'Basics of Embedded Systems'],
      ['ITI8801 Cloud Architectures and DevOps (2026 autumn)', 'ITI8801', 'Cloud Architectures & DevOps'],
      ['EMT0140 Asjade internet tööstusele (2026 sügis)', 'EMT0140', 'Asjade internet tööstusele'],
      ['MMO5770 MMO5500 Management and Leadership (2026 sügis)', 'MMO5770', 'Management & Leadership'],
      ['ITB8833 E-riigi infotehnoloogilised lahendused / Digital state ICT solutions (2026 sügis/autumn)', 'ITB8833', 'Digital state ICT solutions'],
      ['IEE2630 Tarkade asjade võrgud (2026 sügis)', 'IEE2630', 'Tarkade asjade võrgud'],
      ['Cloud Architectures and DevOps (2026 autumn) (ITI8801)', 'ITI8801', 'Cloud Architectures & DevOps', 'ITI8801'],
      ['MMO5500 Management and Leadership (2026 sügis) (MMO5770)', 'MMO5770', 'Management & Leadership', 'MMO5770'],
      ['E-riigi infotehnoloogilised lahendused / Digital state ICT solutions (2026 sügis/autumn) (ITB8833)', 'ITB8833', 'Digital state ICT solutions', 'ITB8833'],
      ['Tarkade asjade võrgud (2026 sügis) (IEE2630)', 'IEE2630', 'Tarkade asjade võrgud', 'IEE2630'],
    ];
    for (const [full, code, name, short] of cases) {
      const r = parseCourseName(short ?? '', full, short ?? '');
      expect([r.code, r.name, r.semester], full).toEqual([code, name, { season: 'autumn', year: 2026 }]);
    }
    expect(parseCourseName('', 'ITB8833 E-riigi infotehnoloogilised lahendused / Digital state ICT solutions (2026 sügis/autumn)', '', 'et').name).toBe('E-riigi infotehnoloogilised lahendused');
  });

  it('falls back from shortname to fullname to idnumber, and derives the semester from the date', () => {
    expect(parseCode('ABC1234', 'XYZ9999 Something', '')).toBe('ABC1234');
    expect(parseCode('misc', 'Intro XYZ9999', '')).toBe('XYZ9999');
    expect(parseCode('misc', 'Intro', 'QRS1111')).toBe('QRS1111');
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
