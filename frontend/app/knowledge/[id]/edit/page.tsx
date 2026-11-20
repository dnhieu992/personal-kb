import Link from 'next/link';
import KnowledgeForm from '../../../components/KnowledgeForm';
import { Alert, PageHeader } from '../../../components/ui';
import { api, Knowledge } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function EditKnowledgePage({ params }: { params: { id: string } }) {
  let entry: Knowledge | null = null;
  let error: string | null = null;
  try {
    entry = await api.get(params.id);
  } catch (e) {
    error = (e as Error).message;
  }

  if (error || !entry) {
    return (
      <>
        <PageHeader title="Entry not found" back={{ href: '/knowledge', label: 'Entries' }} />
        <Alert title="This entry could not be loaded.">
          {error}{' '}
          <Link href="/knowledge" className="underline">
            Back to entries
          </Link>
        </Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Edit entry" back={{ href: '/knowledge', label: 'Entries' }} />
      <KnowledgeForm initial={entry} />
    </>
  );
}
