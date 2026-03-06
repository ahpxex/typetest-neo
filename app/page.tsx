import { redirect } from 'next/navigation';

import { Card } from '@/components/ui/card';
import { StudentLoginForm } from '@/features/auth/student-login-form';
import { devLoginAdminAction, devLoginStudentAction } from '@/features/auth/actions';
import { getAnySignedInUser } from '@/lib/auth/guards';
import { APP_NAME, isDevelopment } from '@/lib/env';

export default async function HomePage() {
  const currentUser = await getAnySignedInUser();

  if (currentUser?.type === 'admin') {
    redirect('/admin');
  }

  if (currentUser?.type === 'student') {
    redirect('/typing');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <Card title={APP_NAME} description="请输入学号、姓名和学校登记的校园邮箱。" className="w-full max-w-md">
        <div className="space-y-5">
          <StudentLoginForm />

          {isDevelopment ? (
            <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-600">Development</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <form action={devLoginStudentAction}>
                  <button
                    type="submit"
                    className="w-full rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100"
                  >
                    一键登录学生端
                  </button>
                </form>
                <form action={devLoginAdminAction}>
                  <button
                    type="submit"
                    className="w-full rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100"
                  >
                    一键登录管理员
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </main>
  );
}
