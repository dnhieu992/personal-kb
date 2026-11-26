// Public API of the note module — the ONLY file other modules may import.
export { NoteModule } from './note.module';
export { NoteService } from './application/note.service';
export type { NoteSearchHit } from './application/note.service';
export { NoteIndexService } from './application/note-index.service';
export type { SemanticHit as NotePassage } from './application/note-index.service';
