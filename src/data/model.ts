export type Season = 'autumn' | 'spring' | 'summer' | 'winter';

export interface Course {
  id: number;
  code: string;
  name: string;
  alias?: string;
  fullname: string;
  shortname: string;
  semester?: { season: Season; year: number };
  url: string;
  image?: string;
  progress: number | null;
  favourite: boolean;
  hidden: boolean;
  category?: string;
  startdate?: number;
  enddate?: number;
}

export interface Section {
  id: number;
  number: number;
  title: string;
  url: string;
  visible: boolean;
  current: boolean;
  restricted: boolean;
  hasSummary: boolean;
  summaryHtml?: string;
  cmIds: number[];
  tileImage?: string;
  parentId?: number | null;
  /** `mod_subsection` for delegated sections (rendered inside their parent topic). */
  component?: string;
  /** For delegated sections: the id of the owning component instance (a subsection instance id on Moodle 4.5, not the cm id). */
  itemid?: number;
}

export type CompletionState = 0 | 1 | 2 | 3;

export interface Cm {
  id: number;
  courseId: number;
  sectionId: number;
  sectionNumber: number;
  name: string;
  modname: string;
  url: string;
  uservisible: boolean;
  restricted: boolean;
  tracked: boolean;
  completion?: CompletionState;
  /** Moodle 4.5 `delegatesectionid`: the section this subsection cm owns. */
  delegatedSectionId?: number;
  details?: CmDetails;
}

export type Format =
  | 'PDF' | 'SLIDES' | 'DOC' | 'SHEET' | 'ZIP' | 'VIDEO' | 'AUDIO' | 'IMAGE' | 'TEXT' | 'CODE' | 'FILE'
  | 'LINK' | 'PAGE' | 'BOOK' | 'FOLDER' | 'QUIZ' | 'ASSIGNMENT' | 'FORUM' | 'TOOL' | 'H5P' | 'SURVEY';

export type Kind =
  | 'lecture' | 'recording' | 'reading' | 'material' | 'practical' | 'assignment' | 'quiz' | 'discussion'
  | 'survey' | 'tool' | 'note';

export interface CmDetails {
  iconKey: string;
  format: Format;
  /** Moodle's own localised module name ("File", "Fail"), from the activity's type text or its icon alt. */
  typeName?: string;
  badge?: string;
  dates: { label: string; text: string }[];
  descriptionHtml?: string;
  availability?: string;
  resourceDetails?: string;
  manual?: { done: boolean };
  autoText?: string;
  at: number;
}

export interface Pin {
  cmid: number;
  courseId: number;
  courseCode: string;
  title: string;
  modname: string;
  kind: Kind;
  format: Format;
  url: string;
  addedAt: number;
  /** Last time the material was opened (its page or the side reader): the Dossier row shows the most recent three. */
  openedAt?: number;
}

export interface DueItem {
  eventId: number;
  cmid?: number;
  courseId: number;
  courseCode: string;
  title: string;
  modname: string;
  due: number;
  overdue: boolean;
  actionName?: string;
  actionUrl?: string;
  url: string;
}

/** The signed-in user as far as the shell needs to know (never contains the sesskey). */
export interface UserInfo {
  id: number;
  fullname: string;
  initials: string;
  avatar?: string;
}
