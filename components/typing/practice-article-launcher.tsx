'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PracticeArticleOption } from '@/lib/data/queries';
import { formatKpm, formatPercent } from '@/lib/format';

type PracticeArticleLauncherProps = {
  articles: PracticeArticleOption[];
  defaultArticleId: number;
  bestLabel: string;
  bestScore: number | null;
  bestAccuracy: number | null;
};

export function PracticeArticleLauncher({
  articles,
  defaultArticleId,
  bestLabel,
  bestScore,
  bestAccuracy,
}: PracticeArticleLauncherProps) {
  const [selectedArticleId, setSelectedArticleId] = useState(String(defaultArticleId));

  const selectedArticle = useMemo(
    () => articles.find((article) => article.articleId === Number(selectedArticleId)) ?? articles[0],
    [articles, selectedArticleId],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>练习文章：{selectedArticle?.title ?? '未设置'}</p>
        <p className="mt-1">
          {bestLabel}：{bestScore === null ? '—' : `${formatKpm(bestScore)} · ${formatPercent(bestAccuracy ?? 0)}`}
        </p>
        <p className="mt-1">可以先切换文章，再开始本次练习。</p>
      </div>

      <Select value={selectedArticleId} onValueChange={setSelectedArticleId}>
        <SelectTrigger className="w-full bg-background" aria-label="选择练习文章">
          <SelectValue placeholder="选择练习文章" />
        </SelectTrigger>
        <SelectContent>
          {articles.map((article) => (
            <SelectItem key={article.articleId} value={String(article.articleId)}>
              {article.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button asChild className="w-full shrink-0">
        <Link href={`/typing/practice?article=${selectedArticleId}`}>开始练习</Link>
      </Button>
    </div>
  );
}
