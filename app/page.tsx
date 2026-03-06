import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Card } from '@/components/ui/card';
import { StudentLoginForm } from '@/features/auth/student-login-form';
import { getAnySignedInUser } from '@/lib/auth/guards';
import { APP_DESCRIPTION, APP_NAME } from '@/lib/env';
import { formatDurationSeconds } from '@/lib/format';
import { getActiveCampaign, resolveCurrentArticleForCampaign } from '@/lib/data/queries';

export default async function HomePage() {
  const currentUser = await getAnySignedInUser();

  if (currentUser?.type === 'admin') {
    redirect('/admin');
  }

  if (currentUser?.type === 'student') {
    redirect('/typing');
  }

  const activeCampaign = await getActiveCampaign();
  const currentArticle = activeCampaign
    ? await resolveCurrentArticleForCampaign(activeCampaign.id)
    : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(24,24,27,0.08),_transparent_50%)] px-4 py-10 md:px-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6 rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm md:p-10">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">UCASS Typing Platform</p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
              {APP_NAME}
            </h1>
            <p className="max-w-2xl text-base leading-8 text-zinc-600 md:text-lg">{APP_DESCRIPTION}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Metric title="定位" value="大一统一测试" description="面向每年新生的统一考试与练习" />
            <Metric title="入口" value="姓名 + 学号 + 邮箱" description="支持学生端和管理员端双入口" />
            <Metric title="成绩" value="服务端复算" description="最终结果由服务器统一结算" />
          </div>

          <Card
            title="当前场次"
            description="学生登录后会自动进入当前激活的测试场次"
            className="border-zinc-900 bg-zinc-900 text-white"
          >
            {activeCampaign ? (
              <div className="space-y-3 text-sm text-zinc-200">
                <p>
                  <span className="font-medium text-white">{activeCampaign.name}</span>
                  <span className="ml-3 text-zinc-400">{activeCampaign.academicYear} / {activeCampaign.term}</span>
                </p>
                <p>测试时长：{formatDurationSeconds(activeCampaign.durationSeconds)}</p>
                <p>文章策略：{activeCampaign.articleStrategy}</p>
                <p>当前文章：{currentArticle?.title ?? '暂未分配'}</p>
              </div>
            ) : (
              <p className="text-sm text-zinc-300">当前暂无激活场次，请联系管理员在后台发布测试。</p>
            )}
          </Card>
        </section>

        <aside className="space-y-4 rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm md:p-10">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-zinc-950">学生登录</h2>
            <p className="text-sm leading-7 text-zinc-500">
              请使用学校登记的姓名、学号和 `@ucass.edu.cn` 校园邮箱登录系统。
            </p>
          </div>

          <StudentLoginForm />

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            如需管理文章、学生和场次，请前往{' '}
            <Link href="/admin/login" className="font-semibold text-zinc-950 underline underline-offset-4">
              管理员后台
            </Link>
            。
          </div>
        </aside>
      </div>
    </main>
  );
}

function Metric({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">{title}</p>
      <p className="mt-3 text-lg font-semibold text-zinc-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
    </div>
  );
}
