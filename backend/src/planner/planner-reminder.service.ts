import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TelegramService } from '../telegram/telegram.service';
import { PlannerService } from './planner.service';

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function hhmm(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * The web has no system notifications, so task reminders (the Mac app's
 * UNNotification) go to Telegram. Checks once a minute.
 */
@Injectable()
export class PlannerReminderService {
  private readonly logger = new Logger(PlannerReminderService.name);
  private running = false;

  constructor(
    private readonly planner: PlannerService,
    private readonly telegram: TelegramService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'planner-reminders' })
  async tick() {
    if (this.running || !this.telegram.isConfigured) return;
    this.running = true;
    try {
      const due = await this.planner.dueReminders();
      if (!due.length) return;
      const cats = await this.planner.allCategories();
      const sent: number[] = [];
      for (const t of due) {
        const parts = [t.area === 'WORK' ? 'Work' : 'Personal'];
        const cat = this.planner.categoryName(t.categoryId, cats);
        if (cat) parts[0] += ` · ${cat}`;
        if (t.startTime != null) parts.push(`Starts ${hhmm(t.startTime)}`);
        if (t.duration) parts.push(`${t.duration}m`);
        try {
          await this.telegram.send(`⏰ <b>${esc(t.title)}</b>\n${esc(parts.join(' · '))}`);
          sent.push(t.id);
        } catch (e) {
          this.logger.warn(`Reminder for task ${t.id} failed: ${e.message}`);
        }
      }
      await this.planner.markReminded(sent);
    } catch (e) {
      this.logger.error(`Reminder tick failed: ${e.message}`);
    } finally {
      this.running = false;
    }
  }
}
