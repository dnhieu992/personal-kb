import KnowledgeForm from '../../components/KnowledgeForm';
import { PageHeader } from '../../components/ui';

export default function NewKnowledgePage({ searchParams }: { searchParams: { projectId?: string } }) {
  return (
    <>
      <PageHeader title="New entry" back={{ href: '/knowledge', label: 'Entries' }} />
      <KnowledgeForm defaultProjectId={searchParams.projectId} />
    </>
  );
}
