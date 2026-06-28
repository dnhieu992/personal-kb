import Link from 'next/link';
import KnowledgeForm from '../../../components/KnowledgeForm';
import { api, Knowledge } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function EditKnowledgePage({
  params,
}: {
  params: { id: string };
}) {
  let entry: Knowledge | null = null;
  let error: string | null = null;
  try {
    entry = await api.get(params.id);
  } catch (e) {
    error = (e as Error).message;
  }

  if (error || !entry) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-semibold">Entry not found.</p>
        <p className="mt-1 text-sm">{error}</p>
        <Link href="/knowledge" className="mt-2 inline-block text-sm underline">
          ← Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit entry</h1>
      <KnowledgeForm initial={entry} />
    </div>
  );
}
