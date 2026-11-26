import { Inject, Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { ENV, Env } from '../config/config';

export const VECTOR_SIZE = 384; // all-MiniLM-L6-v2
const MODEL = 'Xenova/all-MiniLM-L6-v2';

/**
 * Local sentence embeddings (transformers.js, on-device — Claude has no embeddings API).
 * The model (~90 MB) loads lazily on the first job, never at boot, so the API starts fast
 * and doesn't pay the RAM unless semantic search is actually used.
 */
@Injectable()
export class Embedder {
  private readonly logger = new Logger('Embedder');
  private extractor: Promise<(t: string | string[], o: object) => Promise<{ data: Float32Array; dims: number[] }>> | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  private load() {
    if (!this.extractor) {
      this.extractor = (async () => {
        // ESM-only package: real dynamic import from CommonJS
        const tf = await (new Function('m', 'return import(m)')('@xenova/transformers') as Promise<any>);
        tf.env.cacheDir = this.env.MODEL_CACHE_DIR || join(process.cwd(), '.cache', 'models');
        this.logger.log(`loading ${MODEL}…`);
        const p = await tf.pipeline('feature-extraction', MODEL);
        this.logger.log('embedding model ready');
        return p;
      })();
      this.extractor.catch(() => (this.extractor = null));
    }
    return this.extractor;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const ex = await this.load();
    const out = await ex(texts, { pooling: 'mean', normalize: true });
    const rows: number[][] = [];
    for (let i = 0; i < texts.length; i++) rows.push(Array.from(out.data.slice(i * VECTOR_SIZE, (i + 1) * VECTOR_SIZE)));
    return rows;
  }
}
