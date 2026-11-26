/** An image stored via /api/uploads/images (English journal, diary). */
export interface ImageRef {
  key: string;
  url: string;
  name?: string;
  size?: number;
  type?: string;
}

/** Direct-to-storage image upload: presign → PUT → stable /api/uploads/images/<key> URL. */
export async function uploadImages(files: File[]): Promise<ImageRef[]> {
  const out: ImageRef[] = [];
  for (const f of files) {
    const res = await fetch('/api/uploads/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: f.name, mime: f.type || 'image/png', size: f.size }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail ?? `Upload failed (${res.status})`);
    const r = (await res.json()) as { uploadUrl: string; headers: Record<string, string>; image: ImageRef };
    const put = await fetch(r.uploadUrl, { method: 'PUT', headers: r.headers, body: f });
    if (!put.ok) throw new Error(`Upload failed (${put.status})`);
    out.push(r.image);
  }
  return out;
}
