import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import type { Options, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';

/**
 * Every AI call goes through headless Claude Code (Agent SDK), which signs in
 * with the claude.ai login in ~/.claude on the host — no ANTHROPIC_API_KEY.
 * In production the container mounts the VPS's /root/.claude (see
 * docker-compose.prod.yml). Each call is one model turn: no tools, no
 * settings/CLAUDE.md/MCP from the box, nothing persisted.
 */

export type Effort = 'low' | 'medium' | 'high';

export interface AskOptions {
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
  /** Parsed reply when a schema was given. */
  data: T;
  stopReason: string | null;
}

// ESM-only package and this build is CommonJS: a plain import() would be
// compiled to require(), so keep it a real dynamic import.
const importEsm = new Function('s', 'return import(s)') as (
  s: string,
) => Promise<typeof import('@anthropic-ai/claude-agent-sdk')>;

/** Inherit the env minus API keys, so Claude Code uses the claude.ai login. */
function buildEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  env.DISABLE_AUTOUPDATER = '1';
  // The login would otherwise pull in the account's claude.ai connectors.
  env.ENABLE_CLAUDEAI_MCP_SERVERS = 'false';
  env.CLAUDE_AGENT_SDK_CLIENT_APP = 'personal-kb';
  // Lessons are long JSON replies.
  env.CLAUDE_CODE_MAX_OUTPUT_TOKENS ??= '32000';
  return env;
}

/**
 * Each call spawns a Claude Code process (~150 MB RSS). The VPS has 4 GB shared
 * with MySQL and another app: unbounded fan-out (e.g. creating 20 planner tasks,
 * each auto-checking its English) once got MySQL OOM-killed. Calls beyond this
 * many wait in a FIFO queue.
 */
const MAX_CONCURRENT = Math.max(1, Number(process.env.CLAUDE_MAX_CONCURRENCY) || 2);

@Injectable()
export class ClaudeCodeService {
  private readonly logger = new Logger(ClaudeCodeService.name);
  private readonly enabled: boolean;
  private running = 0;
  private readonly waiting: Array<() => void> = [];

  constructor() {
    const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
    // macOS keeps the login in the keychain, so there is no file to look for.
    this.enabled =
      process.env.AI_DISABLED !== '1' &&
      (!!process.env.CLAUDE_CODE_OAUTH_TOKEN ||
        process.platform === 'darwin' ||
        existsSync(join(configDir, '.credentials.json')));
    if (!this.enabled) {
      this.logger.warn(`No Claude login in ${configDir} — AI features will return fallbacks.`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async ask<T = unknown>(opts: AskOptions): Promise<AskResult<T>> {
    if (!this.enabled) throw new Error('Claude Code is not logged in on this server');
    await this.acquire();
    try {
      return await this.run<T>(opts);
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < MAX_CONCURRENT) {
      this.running++;
      return Promise.resolve();
    }
    if (this.waiting.length >= 10) this.logger.warn(`${this.waiting.length + 1} Claude calls queued`);
    // The slot is handed over by release(), so `running` stays counted.
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  private release() {
    const next = this.waiting.shift();
    if (next) next();
    else this.running--;
  }

  private async run<T>(opts: AskOptions): Promise<AskResult<T>> {
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
      // A structured reply is delivered through a tool call, then the turn ends.
      maxTurns: opts.schema ? 3 : 1,
      ...(opts.effort ? { effort: opts.effort } : { thinking: { type: 'disabled' } }),
      ...(opts.schema
        ? { outputFormat: { type: 'json_schema', schema: opts.schema as Record<string, unknown> } }
        : {}),
      ...(process.env.CLAUDE_CODE_PATH
        ? { pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH }
        : {}),
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
    if (result.subtype !== 'success' || result.is_error) {
      const detail = 'errors' in result ? result.errors.join('; ') : result.result;
      throw new Error(`Claude Code ${result.subtype}: ${detail}`);
    }
    if (result.stop_reason === 'refusal') throw new Error('the model declined to write this');

    const usage = Object.entries(result.modelUsage ?? {})
      .map(([m, u]) => `${m} ${u.inputTokens}+${u.cacheReadInputTokens ?? 0} in / ${u.outputTokens} out`)
      .join(', ');
    this.logger.log(`${usage} (~$${result.total_cost_usd.toFixed(3)} at API prices, billed to the plan)`);

    let data = result.structured_output as T;
    if (opts.schema && data === undefined) data = JSON.parse(result.result) as T;
    return { text: result.result ?? '', data, stopReason: result.stop_reason };
  }
}
