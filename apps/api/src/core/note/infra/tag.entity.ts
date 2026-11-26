import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('tag')
export class TagEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ length: 60 }) name: string;
  @CreateDateColumn({ name: 'created_at', precision: 3 }) createdAt: Date;
}
