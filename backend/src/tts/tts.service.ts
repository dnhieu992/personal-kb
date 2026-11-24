import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * English text → speech with Piper (offline neural TTS, baked into the backend
 * image under /opt/piper — see the Dockerfile). The browser's Web Speech API is
 * not reliable (Chrome on macOS can hang with `speaking=true` and no sound), so
 * the frontend plays these files and only falls back to the browser voice.
 *
 * Files are cached on disk by hash of (voice, rate, text), so each sentence is
 * synthesised once; the cache sits in the model_cache volume and survives deploys.
 */
@Injectable()
export class TtsService {
  private readonly log = new Logger(TtsService.name);
  private readonly bin: string;
  private readonly model: string;
  private readonly dir: string;
  /** The VPS has 2 cores: synthesise one file at a time. */
  private queue: Promise<unknown> = Promise.resolve();
  private readonly inFlight = new Map<string, Promise<string>>();

  constructor(config: ConfigService) {
    this.bin = config.get<string>('PIPER_BIN', '/opt/piper/piper');
    this.model = config.get<string>('PIPER_MODEL', '/opt/piper/voice.onnx');
    this.dir = join(config.get<string>('TTS_CACHE_DIR', join(process.cwd(), '.cache')), 'tts');
  }

  get available(): boolean {
    return existsSync(this.bin) && existsSync(this.model);
  }

  /** Path of a WAV file speaking `text` at `rate` (1 = normal speed). */
  async file(text: string, rate: number): Promise<string> {
    if (!this.available) throw new ServiceUnavailableException('TTS engine not installed');
    const key = createHash('sha1').update(`${this.model}|${rate}|${text}`).digest('hex');
    const path = join(this.dir, `${key}.wav`);
    if (await exists(path)) return path;

    let job = this.inFlight.get(key);
    if (!job) {
      job = this.enqueue(() => this.synthesise(text, rate, path)).finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, job);
    }
    return job;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async synthesise(text: string, rate: number, path: string): Promise<string> {
    if (await exists(path)) return path;
    await mkdir(this.dir, { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        this.bin,
        ['--model', this.model, '--length_scale', String(round(1 / rate)), '--sentence_silence', '0.35', '--output_file', tmp],
        { stdio: ['pipe', 'ignore', 'pipe'] },
      );
      let err = '';
      child.stderr.on('data', (d) => (err = (err + d).slice(-2000)));
      const timer = setTimeout(() => child.kill('SIGKILL'), 60_000);
      child.on('error', reject);
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`piper exited ${code}: ${err.trim().split('\n').pop()}`));
      });
      // Piper reads one utterance per line; keep the text on one line.
      child.stdin.end(text.replace(/\s+/g, ' ') + '\n');
    }).catch(async (e) => {
      await unlink(tmp).catch(() => undefined);
      this.log.error(e instanceof Error ? e.message : String(e));
      throw new ServiceUnavailableException('Speech synthesis failed');
    });
    await rename(tmp, path);
    return path;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
