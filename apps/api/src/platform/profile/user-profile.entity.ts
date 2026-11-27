import { Column, Entity, PrimaryColumn } from 'typeorm';

/** The single user's profile (id = 1). */
@Entity('user_profile')
export class UserProfile {
  @PrimaryColumn({ type: 'tinyint' })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  displayName: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarKey: string | null;

  @Column({ type: 'datetime', precision: 3 })
  updatedAt: Date;
}
