import KnowledgeForm from '../../components/KnowledgeForm';

export default function NewKnowledgePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New entry</h1>
      <KnowledgeForm />
    </div>
  );
}
