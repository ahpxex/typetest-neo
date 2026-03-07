import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { logoutAction } from '@/features/auth/actions';

type StudentPageShellProps = {
  studentName: string;
  title: string;
  description: string;
  children: React.ReactNode;
  extraInfo?: React.ReactNode;
  controls?: React.ReactNode;
};

export function StudentPageShell({
  studentName,
  title,
  description,
  children,
  extraInfo,
  controls,
}: StudentPageShellProps) {
  return (
    <main className="h-screen overflow-hidden bg-background px-4 py-4 md:px-6 md:py-5">
      <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 overflow-hidden">
        <header className="shrink-0 border-b border-border pb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Student</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{description || `欢迎回来，${studentName}`}</p>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              {extraInfo}
              <div className="flex flex-wrap items-center gap-2">
                {controls ?? (
                  <>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/typing">返回首页</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/ranking">查看排行榜</Link>
                    </Button>
                    <form action={logoutAction}>
                      <Button type="submit" variant="outline" size="sm">退出登录</Button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </main>
  );
}
