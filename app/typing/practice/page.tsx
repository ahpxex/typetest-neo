import { TypingSessionPage } from '@/features/typing/typing-session-page';
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params';

export default async function PracticeTypingPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {};
  const articleParam = Number.parseInt(getSearchParamValue(params.article) ?? '', 10);
  const articleId = Number.isFinite(articleParam) && articleParam > 0 ? articleParam : undefined;

  return <TypingSessionPage mode="practice" practiceArticleId={articleId} />;
}
