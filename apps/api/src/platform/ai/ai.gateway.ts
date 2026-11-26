import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { Options, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { DataSource } from 'typeorm';
import { newId } from '../database/ids';
import { AiCallEntity } from './ai-call.entity';

/**
 * The ONLY way the app talks to a model. It knows nothing about notes, courses or
 * English: modules own their prompts + JSON schemas and call `ask()`.
 *
 * Transport = headless Claude Code (Agent SDK) signed in with the server's claude.ai
 * login (no API key). Each call is one model turn: no tools, no settings, nothing
 * persisted. At most AI_MAX_CONCURRENCY (default 2) run at once — each process is
 * ~150 MB and unbounded fan-out once OOM-killed the shared MySQL. Extra calls queue FIFO.
 * Every call is logged in `ai_call` (module, purpose, duration, status).
 */
export type Effort = 'low' | 'medium' | 'high';

export interface AskOptions {
  /** e.g. 'english', 'note' — for the ai_call log */
  module: string;
  /** e.g. 'check-english', 'lesson.generate' */
  purpose: string;
  model: string;
  system: string;
  user: string;
  /** JSON schema: the reply is validated against it and returned parsed. */
  schema?: object;
  effort?: Effort;
  timeoutMs?: number;
}

export interface AskResult<T = unknown> {
  text: string;
  data: T;
  stopReason: string | null;
}

export const FAST_MODEL = 'claude-haiku-4-5';

// ESM-only package in a CommonJS build: keep it a real dynamic import.
const importEsm = new Function('s', 'return import(s)') as (
  s: string,
) => Promise<typeof import('@anthropic-ai/claude-agent-sdk')>;

function buildEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  env.DISABLE_AUTOUPDATER = '1';
  env.ENABLE_CLAUDEAI_MCP_SERVERS = 'false';
  env.CLAUDE_AGENT_SDK_CLIENT_APP = 'personal-kb';
  env.CLAUDE_CODE_MAX_OUTPUT_TOKENS ??= '32000';
  return env;
}

@Injectable()
export class AiGateway {
  private readonly logger = new Logger('AI');
  private readonly enabled: boolean;
  private readonly max = Math.max(1, Number(process.env.AI_MAX_CONCURRENCY) || 2);
  private running = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly db: DataSource) {
    const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
    this.enabled =
      process.env.AI_DISABLED !== '1' &&
      (!!process.env.CLAUDE_CODE_OAUTH_TOKEN || process.platform === 'darwin' || existsSync(join(configDir, '.credentials.json')));
    if (!this.enabled) this.logger.warn(`No Claude login in ${configDir} — AI features degrade to fallbacks.`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Throws 503 with a friendly message when AI is off. */
  assertEnabled(): void {
    if (!this.enabled) throw new ServiceUnavailableException('AI is not available (Claude is not logged in on the server).');
  }

  async ask<T = unknown>(opts: AskOptions): Promise<AskResult<T>> {
    this.assertEnabled();
    await this.acquire();
    const started = Date.now();
    let cost: number | null = null;
    try {
      const r = await this.run<T>(opts, (c) => (cost = c));
      void this.log(opts, started, 'ok', null, cost);
      return r;
    } catch (e) {
      void this.log(opts, started, 'error', e instanceof Error ? e.message : String(e), cost);
      throw e;
    } finally {
      this.release();
    }
  }

  /** Strip a ```json fence and parse — for prompts that answer JSON as text. */
  static parseJson<T>(raw: string): T {
    return JSON.parse(raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()) as T;
  }

  private acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++;
      return Promise.resolve();
    }
    if (this.waiting.length >= 10) this.logger.warn(`${this.waiting.length + 1} AI calls queued`);
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  private release() {
    const next = this.waiting.shift();
    if (next) next();
    else this.running--;
  }

  private async log(o: AskOptions, started: number, status: 'ok' | 'error', error: string | null, cost: number | null) {
    try {
      await this.db.manager.insert(AiCallEntity, {
        id: newId(),
        module: o.module.slice(0, 40),
        purpose: o.purpose.slice(0, 80),
        model: o.model.slice(0, 60),
        durationMs: Date.now() - started,
        status,
        error: error?.slice(0, 2000) ?? null,
        costUsd: cost === null ? null : cost.toFixed(4),
      });
    } catch (e) {
      this.logger.warn(`ai_call log failed: ${e.message}`);
    }
  }

  private async run<T>(opts: AskOptions, onCost: (c: number) => void): Promise<AskResult<T>> {
    const { query } = await importEsm('@anthropic-ai/claude-agent-sdk');
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), opts.timeoutMs ?? 10 * 60_000);
    const options: Options = {
      model: opts.model,
      systemPrompt: opts.system,
      abortController,
      cwd: tmpdir(),
      env: buildEnv(),
      tools: [],
      permissionMode: 'dontAsk',
      strictMcpConfig: true,
      settingSources: [],
      persistSession: false,
      maxTurns: opts.schema ? 3 : 1,
      ...(opts.effort ? { effort: opts.effort } : { thinking: { type: 'disabled' } }),
      ...(opts.schema ? { outputFormat: { type: 'json_schema', schema: opts.schema as Record<string, unknown> } } : {}),
      ...(process.env.CLAUDE_CODE_PATH ? { pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH } : {}),
      stderr: (data) => this.logger.debug(data.trim()),
    };
    let result: SDKResultMessage | undefined;
    try {
      for await (const message of query({ prompt: opts.user, options })) {
        if (message.type === 'result') result = message;
      }
    } finally {
      clearTimeout(timer);
    }
    if (!result) throw new Error('Claude Code exited without a result');
    onCost(result.total_cost_usd ?? 0);
    if (result.subtype !== 'success' || result.is_error) {
      const detail = 'errors' in result ? result.errors.join('; ') : result.result;
      throw new Error(`Claude Code ${result.subtype}: ${detail}`);
    }
    if (result.stop_reason === 'refusal') throw new Error('the model declined to write this');
    this.logger.log(`${opts.module}/${opts.purpose} ${opts.model} ok (~$${result.total_cost_usd.toFixed(3)})`);
    let data = result.structured_output as T;
    if (opts.schema && data === undefined) data = JSON.parse(result.result) as T;
    return { text: result.result ?? '', data, stopReason: result.stop_reason };
  }
}
