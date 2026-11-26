import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 3: text extracted from PDF/docx/plain attachments feeds FULLTEXT search + embeddings. */
export class AttachmentText1764400000000 implements MigrationInterface {
  name = 'AttachmentText1764400000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      "ALTER TABLE `attachment` ADD COLUMN `text_content` MEDIUMTEXT NULL, ADD COLUMN `text_status` VARCHAR(10) NULL, " +
        "ADD CONSTRAINT `ck_attachment_text_status` CHECK (`text_status` IS NULL OR `text_status` IN ('done','none','failed'))",
    );
    await q.query('ALTER TABLE `attachment` DROP INDEX `ft_attachment`');
    await q.query('ALTER TABLE `attachment` ADD FULLTEXT KEY `ft_attachment` (`filename`, `text_content`)');
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE `attachment` DROP INDEX `ft_attachment`');
    await q.query('ALTER TABLE `attachment` ADD FULLTEXT KEY `ft_attachment` (`filename`)');
    await q.query('ALTER TABLE `attachment` DROP CHECK `ck_attachment_text_status`, DROP COLUMN `text_status`, DROP COLUMN `text_content`');
  }
}
