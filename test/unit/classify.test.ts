import { describe, expect, it } from 'vitest';
import {
  classifyFormat, classifyKind, countsAsResource, firstSentence, inTab, iconFileType, kindWord, monoLabel, splitName, subtitleFor, topicSubtitle, verbFor,
} from '../../src/data/classify';
import type { Format, Kind } from '../../src/data/model';

type Row = [modname: string, name: string, icon: string | undefined, kind: Kind, format: Format, sectionTitle?: string];

const PDF = 'f/pdf';
const TABLE: Row[] = [
  // the three iteration3 rows
  ['resource', 'Kubernetes — lecture slides', PDF, 'lecture', 'PDF'],
  ['resource', 'Practice 6: Deploy a service', PDF, 'practical', 'PDF'],
  ['url', 'Week 6: Lecture recording', undefined, 'recording', 'VIDEO'],
  // lab fixture and captures
  ['resource', 'Lecture 1 slides: What is cloud?', PDF, 'lecture', 'PDF'],
  ['url', 'Reading: What is cloud?', undefined, 'reading', 'LINK'],
  ['page', 'Lab notes 1', undefined, 'practical', 'PAGE'],
  ['assign', 'Lab 1: What is cloud?', undefined, 'assignment', 'ASSIGNMENT'],
  ['quiz', 'Quiz 1', undefined, 'quiz', 'QUIZ'],
  ['forum', 'Announcements', undefined, 'discussion', 'FORUM'],
  ['forum', 'Q&A forum', undefined, 'discussion', 'FORUM'],
  // modules that are not content
  ['label', 'Welcome to the course', undefined, 'note', 'TOOL'],
  ['workshop', 'Peer review', undefined, 'assignment', 'ASSIGNMENT'],
  ['h5pactivity', 'Interactive video', undefined, 'practical', 'H5P'],
  ['feedback', 'Course feedback', undefined, 'survey', 'SURVEY'],
  ['choice', 'Pick a topic', undefined, 'survey', 'SURVEY'],
  ['survey', 'COLLES', undefined, 'survey', 'SURVEY'],
  ['questionnaire', 'Mid-term questionnaire', undefined, 'survey', 'SURVEY'],
  ['glossary', 'Terms', undefined, 'tool', 'TOOL'],
  ['wiki', 'Team wiki', undefined, 'tool', 'TOOL'],
  ['data', 'Project database', undefined, 'tool', 'TOOL'],
  ['attendance', 'Attendance', undefined, 'tool', 'TOOL'],
  ['scheduler', 'Office hours', undefined, 'tool', 'TOOL'],
  ['lti', 'Echo360 Lecture Recordings', undefined, 'recording', 'VIDEO'],
  ['lti', 'Code runner', undefined, 'tool', 'TOOL'],
  ['bigbluebuttonbn', 'Webinar 3', undefined, 'recording', 'VIDEO'],
  ['zoom', 'Consultation', undefined, 'tool', 'TOOL'],
  // recordings by name or file type
  ['resource', 'Loengu salvestus 4', 'f/mpeg', 'recording', 'VIDEO'],
  ['resource', 'Intro', 'f/video', 'recording', 'VIDEO'],
  ['resource', 'Podcast', 'f/mp3', 'recording', 'AUDIO'],
  ['url', 'Panopto session', undefined, 'recording', 'VIDEO'],
  ['url', 'YouTube: Docker in 100 seconds', undefined, 'recording', 'VIDEO'],
  ['url', 'Veebinar: Pilvearhitektuur', undefined, 'recording', 'VIDEO'],
  ['resource', 'Streaming guide', PDF, 'recording', 'PDF'],
  // practical
  ['resource', 'Praktikum 3: Linux käsurida', PDF, 'practical', 'PDF'],
  ['resource', 'Harjutus 2', 'f/document', 'practical', 'DOC'],
  ['resource', 'Exercise sheet 5', 'f/spreadsheet', 'practical', 'SHEET'],
  ['page', 'Tutorial: Git branching', undefined, 'practical', 'PAGE'],
  ['resource', 'Seminar 4 tasks', PDF, 'practical', 'PDF'],
  ['resource', 'Kodutöö 1 juhend', 'f/document', 'practical', 'DOC'],
  ['resource', 'Project brief', PDF, 'practical', 'PDF'],
  ['resource', 'Labor 5', 'f/archive', 'practical', 'ZIP'],
  ['resource', 'Homework 2', 'f/text', 'practical', 'TEXT'],
  // lectures
  ['resource', 'Loeng 3: Virtuaalmasinad', PDF, 'lecture', 'PDF'],
  ['resource', 'Slaidid: Konteinerid', 'f/powerpoint', 'lecture', 'SLIDES'],
  ['resource', 'Esitlus', 'f/powerpoint', 'lecture', 'SLIDES'],
  ['resource', 'Konspekt', 'f/document', 'lecture', 'DOC'],
  ['resource', 'Presentation: Cloud economics', 'f/powerpoint', 'lecture', 'SLIDES'],
  ['resource', 'Lecture notes', 'f/unknown', 'lecture', 'FILE'],
  // reading
  ['resource', 'Artikkel: Serverless', PDF, 'reading', 'PDF'],
  ['url', 'Paper: Borg at Google', undefined, 'reading', 'LINK'],
  ['book', 'Course handbook', undefined, 'reading', 'BOOK'],
  ['resource', 'Peatükk 4', PDF, 'reading', 'PDF'],
  ['url', 'Reference documentation', undefined, 'reading', 'LINK'],
  // material (default) and section-title tie-breakers
  ['resource', 'Course schedule', PDF, 'material', 'PDF'],
  ['folder', 'Materials', undefined, 'material', 'FOLDER'],
  ['resource', 'Photo of the whiteboard', 'f/jpeg', 'material', 'IMAGE'],
  ['resource', 'Starter code', 'f/sourcecode', 'material', 'CODE'],
  ['resource', 'Cheat sheet', 'f/html', 'material', 'CODE'],
  ['resource', 'Diagram', 'f/svg', 'material', 'IMAGE'],
  ['imscp', 'Package', undefined, 'material', 'FILE'],
  ['scorm', 'Module', undefined, 'material', 'FILE'],
  ['lesson', 'Branching lesson', undefined, 'material', 'FILE'],
  ['resource', 'Worksheet', PDF, 'practical', 'PDF', 'Labs'],
  ['resource', 'Clip', undefined, 'recording', 'VIDEO', 'Echo 360 Lecture Recordings'],
  ['resource', 'Roman numerals', PDF, 'material', 'PDF'],
  // word-start boundary: no match inside other words
  ['resource', 'Multitasking', PDF, 'material', 'PDF'],
  ['resource', 'Collaboration', PDF, 'material', 'PDF'],
  ['resource', 'Õppematerjal: Pilv', PDF, 'material', 'PDF'],
  ['resource', 'Ülesanne 1', PDF, 'practical', 'PDF'],
];

describe('classify: kind and format table', () => {
  it('has at least 60 cases', () => {
    expect(TABLE.length).toBeGreaterThanOrEqual(60);
  });
  it.each(TABLE)('%s "%s" (%s) -> %s / %s', (modname, name, iconKey, kind, format, sectionTitle) => {
    const input = { modname, name, iconKey, sectionTitle };
    const k = classifyKind(input);
    expect(k).toBe(kind);
    expect(classifyFormat(input, k)).toBe(format);
  });
});

describe('classify: helpers', () => {
  it('reads the file type from an icon key', () => {
    expect(iconFileType('http://x/theme/image.php/boost/core/1/f/pdf?filtericon=1')).toBe('pdf');
    expect(iconFileType('/f/powerpoint-24')).toBe('powerpoint');
    expect(iconFileType('url/monologo')).toBeUndefined();
  });
  it('maps kinds to tabs', () => {
    expect(inTab('lecture', 'lectures')).toBe(true);
    expect(inTab('recording', 'lectures')).toBe(true);
    expect(inTab('practical', 'lectures')).toBe(false);
    expect(inTab('assignment', 'labs')).toBe(true);
    expect(inTab('quiz', 'labs')).toBe(true);
    expect(inTab('discussion', 'labs')).toBe(false);
    expect(inTab('discussion', 'all')).toBe(true);
  });
  it('builds the mono label', () => {
    expect(monoLabel('lecture', 'PDF')).toBe('LECTURE / PDF');
    expect(monoLabel('recording', 'VIDEO')).toBe('RECORDING / VIDEO');
    expect(monoLabel('assignment', 'ASSIGNMENT', 'Due Thu 15 Oct')).toBe('ASSIGNMENT / DUE THU 15 OCT');
    expect(monoLabel('quiz', 'QUIZ')).toBe('QUIZ / QUIZ');
    expect(kindWord('discussion')).toBe('FORUM');
  });
  it('splits a prefixed name into title and subtitle', () => {
    expect(splitName('Practice 6: Deploy a service')).toEqual({ title: 'Deploy a service', prefix: 'Practice 6' });
    expect(splitName('Week 6: Lecture recording')).toEqual({ title: 'Lecture recording', prefix: 'Week 6' });
    expect(splitName('praktikum #3 - Võrgud')).toEqual({ title: 'Võrgud', prefix: 'Praktikum #3' });
    expect(splitName('Lab 2a: Docker')).toEqual({ title: 'Docker', prefix: 'Lab 2a' });
    expect(splitName('Kubernetes — lecture slides')).toEqual({ title: 'Kubernetes — lecture slides' });
    expect(splitName('Lecture 1 slides: What is cloud?')).toEqual({ title: 'Lecture 1 slides: What is cloud?' });
  });
  it('chooses the subtitle by priority', () => {
    expect(subtitleFor({ prefix: 'Practice 6', dueText: 'Due', resourceDetails: '2 MB' })).toBe('Practice 6');
    expect(subtitleFor({ dueText: 'Due Thu', resourceDetails: '2 MB' })).toBe('Due Thu');
    expect(subtitleFor({ resourceDetails: '2.1 MB PDF document' })).toBe('2.1 MB PDF document');
    expect(subtitleFor({ descriptionText: 'Read this first. Then the rest.' })).toBe('Read this first.');
    expect(subtitleFor({})).toBeUndefined();
  });
  it('shortens long first sentences', () => {
    const long = 'word '.repeat(40).trim();
    const s = firstSentence(long, 50) ?? '';
    expect(s.length).toBeLessThanOrEqual(50);
    expect(s.endsWith('…')).toBe(true);
  });
  it('picks the button verb', () => {
    expect(verbFor('recording')).toBe('watch');
    expect(verbFor('assignment', { assignOpen: true })).toBe('submit');
    expect(verbFor('assignment')).toBe('open');
    expect(verbFor('lecture')).toBe('open');
  });
  it('generates the topic subtitle in the fixed order', () => {
    expect(topicSubtitle(['recording', 'lecture', 'practical'])).toBe('Lecture, practical work and recording');
    expect(topicSubtitle(['lecture'])).toBe('Lecture');
    expect(topicSubtitle(['practical', 'assignment', 'quiz', 'reading'])).toBe('Practical work, assignment, quiz and reading');
    expect(topicSubtitle(['note', 'tool'])).toBe('');
    expect(topicSubtitle(['material', 'discussion'])).toBe('Materials and discussion');
  });
  it('does not count notes as resources', () => {
    expect(countsAsResource('note')).toBe(false);
    expect(countsAsResource('lecture')).toBe(true);
  });
});
