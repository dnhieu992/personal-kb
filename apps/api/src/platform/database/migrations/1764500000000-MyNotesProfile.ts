import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Diary → "My Notes": entries belong to a calendar day (`entryDate`, backfilled from createdAt in +07),
 * the page is locked by a 6-digit passcode (`diary_lock`, one row, scrypt hash), and the single user
 * gets a profile (`user_profile`, one row).
 */
export class MyNotesProfile1764500000000 implements MigrationInterface {
  name = 'MyNotesProfile1764500000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE `diary_entry` ADD COLUMN `entryDate` DATE NULL');
    // createdAt is stored in UTC (driver timezone Z); the app's calendar is Asia/Ho_Chi_Minh (+07, no DST).
    await q.query('UPDATE `diary_entry` SET `entryDate` = DATE(DATE_ADD(`createdAt`, INTERVAL 7 HOUR))');
    await q.query('ALTER TABLE `diary_entry` MODIFY `entryDate` DATE NOT NULL, ADD INDEX `idx_diary_day` (`entryDate`, `createdAt`)');
    await q.query(
      'CREATE TABLE `diary_lock` (`id` tinyint NOT NULL, `passcodeHash` varchar(255) NOT NULL, `updatedAt` datetime(3) NOT NULL, ' +
        'PRIMARY KEY (`id`), CONSTRAINT `ck_diary_lock_single` CHECK (`id` = 1)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    );
    await q.query(
      'CREATE TABLE `user_profile` (`id` tinyint NOT NULL, `displayName` varchar(100) NOT NULL, `email` varchar(200) NULL, ' +
        '`bio` varchar(500) NULL, `avatarKey` varchar(500) NULL, `updatedAt` datetime(3) NOT NULL, ' +
        'PRIMARY KEY (`id`), CONSTRAINT `ck_user_profile_single` CHECK (`id` = 1)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `user_profile`');
    await q.query('DROP TABLE `diary_lock`');
    await q.query('ALTER TABLE `diary_entry` DROP INDEX `idx_diary_day`, DROP COLUMN `entryDate`');
  }
}
