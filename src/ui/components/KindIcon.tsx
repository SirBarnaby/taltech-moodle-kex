import {
  BookOpen, BookText, CirclePlay, ClipboardCheck, ClipboardList, FileArchive, FileAudio, FileCode, FileImage, FileSpreadsheet, FileText, FileUp, FileVideo, Folder,
  GraduationCap, Layers, Library, Link as LinkIcon, ListChecks, Megaphone, MessageSquareText, MessagesSquare, NotebookText, Plug, Presentation, Puzzle, Users, UsersRound, Video, Vote,
  type LucideIcon,
} from 'lucide-preact';
import type { Format, Kind } from '../../data/model';

/** Moodle's activity modules, by `modname`. */
const BY_MODULE: Record<string, LucideIcon> = {
  forum: MessageSquareText,
  hsuforum: MessageSquareText,
  url: LinkIcon,
  feedback: Megaphone,
  attendance: Users,
  page: NotebookText,
  book: BookOpen,
  folder: Folder,
  assign: FileUp,
  quiz: ListChecks,
  choice: Vote,
  choicegroup: Vote,
  questionnaire: ClipboardCheck,
  survey: ClipboardCheck,
  lti: Plug,
  h5pactivity: Puzzle,
  hvp: Puzzle,
  glossary: Library,
  wiki: BookText,
  workshop: UsersRound,
  lesson: GraduationCap,
  scorm: Layers,
  imscp: Layers,
  data: Library,
  chat: MessagesSquare,
  bigbluebuttonbn: Video,
  zoom: Video,
  checklist: ClipboardList,
};

/** A file's own kind, for `resource` (and anything else that is a file). */
const BY_FORMAT: Partial<Record<Format, LucideIcon>> = {
  SLIDES: Presentation,
  SHEET: FileSpreadsheet,
  ZIP: FileArchive,
  VIDEO: FileVideo,
  AUDIO: FileAudio,
  IMAGE: FileImage,
  CODE: FileCode,
  LINK: LinkIcon,
  FOLDER: Folder,
};

const BY_KIND: Partial<Record<Kind, LucideIcon>> = {
  lecture: Presentation,
  practical: FileCode,
  assignment: FileUp,
  quiz: ListChecks,
  discussion: MessageSquareText,
  survey: ClipboardCheck,
  tool: Plug,
};

function kindIcon(modname: string, kind: Kind, format: Format): LucideIcon {
  if (kind === 'recording') return CirclePlay;
  if (modname === 'resource') return BY_FORMAT[format] ?? FileText;
  return BY_MODULE[modname] ?? BY_FORMAT[format] ?? BY_KIND[kind] ?? FileText;
}

/** The small rounded tile with a material's line icon, tinted with the course's school colour. */
export function KindIcon({ modname, kind, format }: { modname: string; kind: Kind; format: Format }) {
  const Icon = kindIcon(modname, kind, format);
  return (
    <span class="kex-kind" aria-hidden="true">
      <Icon size={20} strokeWidth={1.7} />
    </span>
  );
}
