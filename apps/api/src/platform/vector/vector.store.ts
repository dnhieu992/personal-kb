import { Inject, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ENV, Env } from '../config/config';
import { VECTOR_SIZE } from './embedder';

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface VectorHit {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

/**
 * Qdrant behind a tiny port. One collection for v2 (shared Qdrant with v1, new name).
 * Disabled when QDRANT_URL is unset: writes become no-ops and searches answer 503, so the
 * rest of the app never depends on it being there.
 */
@Injectable()
export class VectorStore implements OnModuleInit {
  private readonly logger = new Logger('VectorStore');
  private readonly client: QdrantClient | null;
  private readonly collection: string;
  private ready: Promise<void> | null = null;

  constructor(@Inject(ENV) env: Env) {
    this.collection = env.QDRANT_COLLECTION;
    this.client = env.QDRANT_URL ? new QdrantClient({ url: env.QDRANT_URL, apiKey: env.QDRANT_API_KEY, checkCompatibility: false }) : null;
  }

  isEnabled() {
    return !!this.client;
  }

  onModuleInit() {
    if (this.client) this.ensure().catch((e) => this.logger.warn(`Qdrant not reachable yet: ${e.message}`));
  }

  private ensure() {
    if (!this.client) throw new ServiceUnavailableException('Semantic search is not configured (QDRANT_URL).');
    if (!this.ready) {
      const c = this.client;
      this.ready = (async () => {
        const { exists } = await c.collectionExists(this.collection);
        if (!exists) {
          await c.createCollection(this.collection, { vectors: { size: VECTOR_SIZE, distance: 'Cosine' } });
          this.logger.log(`created collection ${this.collection}`);
        }
        await c.createPayloadIndex(this.collection, { field_name: 'docId', field_schema: 'keyword', wait: true }).catch(() => undefined);
      })();
      this.ready.catch(() => (this.ready = null));
    }
    return this.ready;
  }

  /** Replace every point of a document (a note → N chunks) in one go. */
  async replaceDoc(docId: string, points: VectorPoint[]) {
    if (!this.client) return;
    await this.ensure();
    await this.client.delete(this.collection, { wait: true, filter: { must: [{ key: 'docId', match: { value: docId } }] } });
    if (points.length) await this.client.upsert(this.collection, { wait: true, points: points.map((p) => ({ ...p, payload: { ...p.payload, docId } })) });
  }

  async removeDoc(docId: string) {
    if (!this.client) return;
    await this.ensure();
    await this.client.delete(this.collection, { wait: true, filter: { must: [{ key: 'docId', match: { value: docId } }] } });
  }

  async search(vector: number[], limit: number): Promise<VectorHit[]> {
    await this.ensure();
    const r = await this.client!.query(this.collection, { query: vector, limit, with_payload: true });
    return r.points.map((h) => ({ id: String(h.id), score: h.score, payload: (h.payload ?? {}) as Record<string, unknown> }));
  }
}
