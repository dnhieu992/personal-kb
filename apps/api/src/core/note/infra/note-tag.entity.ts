import { Entity, PrimaryColumn } from 'typeorm';

@Entity('note_tag')
export class NoteTagEntity {
  @PrimaryColumn({ name: 'note_id', type: 'char', length: 36 }) noteId: string;
  @PrimaryColumn({ name: 'tag_id', type: 'char', length: 36 }) tagId: string;
}
