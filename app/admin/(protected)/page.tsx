import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminStudentFilters } from '@/components/admin/admin-student-filters';
import { Card, CardContent } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StudentScoresDialog } from '@/components/admin/student-scores-dialog';
import { updateStudentStatusAction } from '@/features/admin/actions';
import { ADMIN_STUDENTS_PAGE_SIZE, getAdminStudentFilterOptions, getAdminStudentsPage } from '@/lib/data/queries';
import { formatDateTime, formatKpm, formatPercent } from '@/lib/format';
import { AppSearchParams, getSearchParamValue } from '@/lib/search-params';

function buildAdminHref({
  query,
  enrollmentYear,
  schoolCode,
  majorCode,
  page,
}: {
  query: string;
  enrollmentYear: string;
  schoolCode: string;
  majorCode: string;
  page: number;
}) {
  const params = new URLSearchParams();

  if (query) {
    params.set('query', query);
  }

  if (enrollmentYear) {
    params.set('year', enrollmentYear);
  }

  if (schoolCode) {
    params.set('school', schoolCode);
  }

  if (majorCode) {
    params.set('major', majorCode);
  }

  if (page > 1) {
    params.set('page', String(page));
  }

  const search = params.toString();
  return search ? `/admin?${search}` : '/admin';
}

function getPaginationItems(totalPages: number, currentPage: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages] as const;
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages] as const;
}

export default async function AdminPage({ searchParams }: { searchParams?: AppSearchParams }) {
  const params = (await searchParams) ?? {};
  const success = getSearchParamValue(params.success);
  const error = getSearchParamValue(params.error);
  const query = getSearchParamValue(params.query) ?? '';
  const enrollmentYear = getSearchParamValue(params.year) ?? '';
  const schoolCode = getSearchParamValue(params.school) ?? '';
  const majorCode = getSearchParamValue(params.major) ?? '';
  const pageParam = Number.parseInt(getSearchParamValue(params.page) ?? '1', 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const redirectTo = buildAdminHref({ query, enrollmentYear, schoolCode, majorCode, page });

  const [studentPage, filterOptions] = await Promise.all([
    getAdminStudentsPage({
      search: query,
      enrollmentYear,
      schoolCode,
      majorCode,
      page,
      pageSize: ADMIN_STUDENTS_PAGE_SIZE,
    }),
    getAdminStudentFilterOptions(),
  ]);

  const rangeStart = studentPage.total === 0 ? 0 : (studentPage.page - 1) * studentPage.pageSize + 1;
  const rangeEnd = Math.min(studentPage.total, studentPage.page * studentPage.pageSize);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">学生管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {studentPage.total} 名学生 · 当前显示 {rangeStart}-{rangeEnd} · 每页 {studentPage.pageSize} 条
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/api/export/attempts">导出 CSV</Link>
          </Button>
        </div>
      </header>

      {success ? (
        <Alert className="shrink-0">
          <AlertTitle>操作成功</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" className="shrink-0">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AdminStudentFilters
            query={query}
            enrollmentYear={enrollmentYear}
            schoolCode={schoolCode}
            majorCode={majorCode}
            enrollmentYears={filterOptions.enrollmentYears}
            schoolCodes={filterOptions.schoolCodes}
            majorCodes={filterOptions.majorCodes}
          />

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学生</TableHead>
                  <TableHead>校园邮箱</TableHead>
                  <TableHead>入学/专业</TableHead>
                  <TableHead>正式最佳</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最近登录</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentPage.items.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.studentNo}</p>
                    </TableCell>
                    <TableCell>{student.campusEmail}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{student.enrollmentYear} 级</p>
                        <p className="text-xs text-muted-foreground">学院 {student.schoolCode} · 专业 {student.majorCode}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {student.bestSubmittedScoreKpm === null ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <div>
                          <p className="font-medium">{formatKpm(student.bestSubmittedScoreKpm)}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.bestSubmittedAccuracy === null ? '暂无准确率' : formatPercent(student.bestSubmittedAccuracy)}
                            {' · '}
                            考试 {student.examAttemptCount} 次 · 练习 {student.practiceAttemptCount} 次
                          </p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.status === 'active' ? 'secondary' : 'outline'}>{student.status}</Badge>
                    </TableCell>
                    <TableCell>{student.lastLoginAt ? formatDateTime(student.lastLoginAt) : '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <StudentScoresDialog student={student} />
                        <form action={updateStudentStatusAction} className="flex gap-2">
                          <input type="hidden" name="redirectTo" value={redirectTo} />
                          <input type="hidden" name="studentId" value={student.id} />
                          <input type="hidden" name="status" value={student.status === 'active' ? 'inactive' : 'active'} />
                          <Button type="submit" variant="outline" size="sm">设为{student.status === 'active' ? '停用' : '启用'}</Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex shrink-0 flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <p>第 {studentPage.page} / {studentPage.totalPages} 页</p>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                {getPaginationItems(studentPage.totalPages, studentPage.page).map((item, index) => (
                  <PaginationItem key={`${item}-${index}`}>
                    {item === 'ellipsis' ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        href={buildAdminHref({
                          query,
                          enrollmentYear,
                          schoolCode,
                          majorCode,
                          page: item,
                        })}
                        isActive={item === studentPage.page}
                      >
                        {item}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
