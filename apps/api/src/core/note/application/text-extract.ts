/**
 * Text out of an uploaded file, for search. Pure-ish (bytes in, text out). Formats we
 * can't read return null and are simply searched by filename.
 */
const MAX_TEXT = 1_000_000;

export function isExtractable(mime: string, filename: string): boolean {
  return (
    mime === 'application/pdf' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    /\.(pdf|docx)$/i.test(filename) ||
    mime.startsWith('text/') ||
    /\.(md|txt|csv|json|log|ya?ml|sql)$/i.test(filename)
  );
}

export async function extractText(buf: Buffer, mime: string, filename: string): Promise<string | null> {
  let text: string | null = null;
  if (mime === 'application/pdf' || /\.pdf$/i.test(filename)) {
    // the package's index.js runs a self-test when not required as a module — use the lib file
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdf = require('pdf-parse/lib/pdf-parse.js') as (b: Buffer) => Promise<{ text: string }>;
    text = (await pdf(buf)).text;
  } else if (mime.includes('wordprocessingml') || /\.docx$/i.test(filename)) {
    const mammoth = await import('mammoth');
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (mime.startsWith('text/') || /\.(md|txt|csv|json|log|ya?ml|sql)$/i.test(filename)) {
    text = buf.toString('utf8');
  }
  if (!text) return null;
  const clean = text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return clean ? clean.slice(0, MAX_TEXT) : null;
}
