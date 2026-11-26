import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

/** Env is parsed once at boot — a bad value stops the process (fail fast). */
export const Env = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().default(4201),
    APP_TZ: z.string().default('Asia/Ho_Chi_Minh'),
    DATABASE_URL: z.string().url(),
    MIGRATE_ON_BOOT: bool,
    AUTH_PASSWORD_HASH: z.string().startsWith('scrypt$', 'Generate it with the hash-password script'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be >= 32 chars'),
    SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    COOKIE_SECURE: bool,
    STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('.storage'),
    PUBLIC_API_BASE: z.string().default('/api'),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    // Phase 3 — semantic search (off unless QDRANT_URL is set; SPEC §10: switch off if RAM is tight)
    QDRANT_URL: z.string().url().optional(),
    QDRANT_API_KEY: z.string().optional(),
    QDRANT_COLLECTION: z.string().default('pkb_v2_notes'),
    MODEL_CACHE_DIR: z.string().optional(),
    // Nightly backup → R2 (separate bucket); off unless BACKUP_BUCKET is set
    BACKUP_BUCKET: z.string().optional(),
    BACKUP_KEEP: z.coerce.number().int().min(1).default(14),
    BACKUP_CRON: z.string().default('0 30 3 * * *'),
    // English module
    COURSE_MODEL: z.string().optional(),
    PIPER_BIN: z.string().default('/opt/piper/piper'),
    PIPER_MODEL: z.string().default('/opt/piper/voice.onnx'),
    TTS_CACHE_DIR: z.string().optional(),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_CHAT_ID: z.string().optional(),
  })
  .superRefine((e, ctx) => {
    if (e.STORAGE_DRIVER === 'r2') {
      for (const k of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const) {
        if (!e[k]) ctx.addIssue({ code: 'custom', path: [k], message: 'required when STORAGE_DRIVER=r2' });
      }
    }
  });
export type Env = z.infer<typeof Env>;

export const ENV = Symbol('ENV');

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
