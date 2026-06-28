import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const COLLECTION = 'knowledge';
const VECTOR_SIZE = 384; // all-MiniLM-L6-v2 output dimension
const MODEL = 'Xenova/all-MiniLM-L6-v2';

export interface SearchHit {
  id: string;
  score: number;
  title: string;
  summary: string;
}

/**
 * Generates embeddings locally with @xenova/transformers (no external API) and
 * stores / searches them in Qdrant.
 *
 * NOTE: the Claude API has no embeddings endpoint, so we use the open-source
 * all-MiniLM-L6-v2 sentence-transformer running fully on-device.
 */
@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly qdrant: QdrantClient;
  // Lazily-loaded feature-extraction pipeline from transformers.js (ESM).
  private extractor: any;

  constructor(private readonly config: ConfigService) {
    this.qdrant = new QdrantClient({
      url: this.config.get<string>('QDRANT_URL', 'http://localhost:6333'),
    });
  }

  async onModuleInit() {
    await this.ensureCollection();
    // Warm up the model so the first request isn't slow. Don't block boot on it.
    this.loadExtractor().catch((e) =>
      this.logger.error(`Failed to preload embedding model: ${e.message}`),
    );
  }

  private async loadExtractor() {
    if (this.extractor) return this.extractor;
    // transformers.js is ESM-only; use a dynamic import from CommonJS.
    const { pipeline } = await (eval(`import('@xenova/transformers')`) as Promise<any>);
    this.logger.log(`Loading embedding model ${MODEL} ...`);
    this.extractor = await pipeline('feature-extraction', MODEL);
    this.logger.log('Embedding model ready.');
    return this.extractor;
  }

  private async ensureCollection() {
    try {
      const collections = await this.qdrant.getCollections();
      const exists = collections.collections.some((c) => c.name === COLLECTION);
      if (!exists) {
        await this.qdrant.createCollection(COLLECTION, {
          vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
        });
        this.logger.log(`Created Qdrant collection "${COLLECTION}".`);
      }
    } catch (e) {
      this.logger.error(
        `Could not reach Qdrant at ${this.config.get('QDRANT_URL')}: ${e.message}`,
      );
    }
  }

  /** Embed an arbitrary string into a 384-dim vector. */
  async embed(text: string): Promise<number[]> {
    const extractor = await this.loadExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
  }

  /**
   * Insert or update a knowledge entry's vector + payload.
   * Degrades gracefully: if the embedding model or Qdrant is unavailable, it
   * logs a warning instead of throwing so CRUD still works without Qdrant.
   */
  async upsert(
    id: string,
    text: string,
    payload: { title: string; summary: string; type: string; tags: string[] },
  ): Promise<void> {
    try {
      const vector = await this.embed(text);
      await this.qdrant.upsert(COLLECTION, {
        wait: true,
        points: [{ id, vector, payload }],
      });
    } catch (e) {
      this.logger.warn(
        `Skipped embedding for ${id} (Qdrant/model unavailable): ${e.message}`,
      );
    }
  }

  /** Remove a vector when its knowledge entry is deleted. */
  async remove(id: string): Promise<void> {
    try {
      await this.qdrant.delete(COLLECTION, { wait: true, points: [id] });
    } catch (e) {
      this.logger.warn(`Qdrant delete failed for ${id}: ${e.message}`);
    }
  }

  /** Semantic search: returns the closest entries to the query (empty if Qdrant is down). */
  async search(query: string, limit = 5): Promise<SearchHit[]> {
    try {
      const vector = await this.embed(query);
      const result = await this.qdrant.search(COLLECTION, {
        vector,
        limit,
        with_payload: true,
      });
      return result.map((r) => ({
        id: String(r.id),
        score: r.score,
        title: (r.payload?.title as string) ?? '',
        summary: (r.payload?.summary as string) ?? '',
      }));
    } catch (e) {
      this.logger.warn(`Search unavailable (Qdrant/model down): ${e.message}`);
      return [];
    }
  }
}
