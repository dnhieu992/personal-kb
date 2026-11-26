/**
 * Port for object storage. Core code depends on this interface only; adapters
 * (R2 in prod, local disk in dev) plug in behind it — swapping is a config change.
 */
export interface StoragePort {
  readonly driver: string;
  /** URL the browser PUTs the raw bytes to (short-lived). */
  presignPut(key: string, mime: string, size: number): Promise<{ url: string; headers: Record<string, string> }>;
  /** Short-lived URL to view/download; `inline` for images/PDF, attachment otherwise. */
  presignGet(key: string, filename: string, mime: string): Promise<string>;
  /** Size + type of a stored object, or null if it isn't there. */
  head(key: string): Promise<{ size: number; mime: string | null } | null>;
  /** Whole object as bytes (server-side jobs only, e.g. text extraction). */
  get(key: string): Promise<Buffer>;
  /** Server-side upload (backups, generated files). */
  put(key: string, body: Buffer, mime: string): Promise<void>;
  /** Keys under a prefix (backup rotation). */
  list(prefix: string): Promise<string[]>;
  /** Idempotent: deleting a missing object is not an error. */
  delete(key: string): Promise<void>;
}

export const STORAGE = Symbol('STORAGE');

export const PUT_TTL_SECONDS = 15 * 60;
export const GET_TTL_SECONDS = 10 * 60;

export function contentDisposition(filename: string, mime: string): string {
  const inline = /^(image\/|application\/pdf$|text\/plain$|video\/|audio\/)/.test(mime);
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
