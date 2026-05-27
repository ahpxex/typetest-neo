import { notFound } from 'next/navigation';

import { CompetitionSessionPage } from '@/features/typing/typing-session-page';

export default async function CompetitionTypingPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const id = Number(competitionId);

  if (!Number.isFinite(id) || id <= 0) {
    notFound();
  }

  return <CompetitionSessionPage competitionId={id} />;
}
