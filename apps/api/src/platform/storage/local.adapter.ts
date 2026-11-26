import { createHmac, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, join, resolve } from 'path';
import { Env } from '../config/config';
import { contentDisposition, GET_TTL_SECONDS, PUT_TTL_SECONDS, StoragePort } from './storage.port';

/**
 * Dev stand-in for R2 with the same shape: the browser still PUTs to / GETs from a
 * signed, expiring URL — it just points at LocalStorageController instead of R2.
 */
export class LocalAdapter implements StoragePort {
  readonly driver = 'local';
  private readonly root: string;

  constructor(private readonly env: Env) {
    this.root = resolve(env.STORAGE_LOCAL_DIR);
  }

  pathOf(key: string): string {
    const p = resolve(join(this.root, key));
    if (!p.startsWith(this.root + '/')) throw new Error('Bad key');
    return p;
  }

  sign(op: 'put' | 'get', key: string, exp: number, extra = ''): string {
    return createHmac('sha256', this.env.SESSION_SECRET).update(`local:${op}:${key}:${exp}:${extra}`).digest('base64url');
  }

  verify(op: 'put' | 'get', key: string, exp: number, sig: string, extra = ''): boolean {
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    const a = Buffer.from(sig ?? '');
    const b = Buffer.from(this.sign(op, key, exp, extra));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private url(op: 'put' | 'get', key: string, ttl: number, params: Record<string, string> = {}): string {
    const exp = Date.now() + ttl * 1000;
    const extra = params.d ?? '';
    const q = new URLSearchParams({ ...params, exp: String(exp), sig: this.sign(op, key, exp, extra) });
    return `${this.env.PUBLIC_API_BASE}/storage/local/${Buffer.from(key).toString('base64url')}?${q}`;
  }

  async presignPut(key: string, mime: string) {
    return { url: this.url('put', key, PUT_TTL_SECONDS), headers: { 'Content-Type': mime } };
  }

  async presignGet(key: string, filename: string, mime: string) {
    return this.url('get', key, GET_TTL_SECONDS, { d: contentDisposition(filename, mime), t: mime });
  }

  async write(key: string, data: Buffer, mime: string) {
    const p = this.pathOf(key);
    await fs.mkdir(dirname(p), { recursive: true });
    await fs.writeFile(p, data);
    await fs.writeFile(p + '.meta.json', JSON.stringify({ mime }));
  }

  async head(key: string) {
    try {
      const p = this.pathOf(key);
      const st = await fs.stat(p);
      const meta = JSON.parse(await fs.readFile(p + '.meta.json', 'utf8').catch(() => '{}'));
      return { size: st.size, mime: meta.mime ?? null };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    const p = this.pathOf(key);
    await fs.rm(p, { force: true });
    await fs.rm(p + '.meta.json', { force: true });
  }

  async get(key: string) {
    return fs.readFile(this.pathOf(key));
  }

  async put(key: string, body: Buffer, mime: string) {
    const p = this.pathOf(key);
    await fs.mkdir(dirname(p), { recursive: true });
    await fs.writeFile(p, body);
    await fs.writeFile(p + '.meta.json', JSON.stringify({ mime }));
  }

  async list(prefix: string) {
    const out: string[] = [];
    const walk = async (dir: string) => {
      for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
        const full = join(dir, e.name);
        if (e.isDirectory()) await walk(full);
        else if (!e.name.endsWith('.meta.json')) out.push(full.slice(this.root.length + 1));
      }
    };
    await walk(this.root);
    return out.filter((k) => k.startsWith(prefix)).sort();
  }
}
