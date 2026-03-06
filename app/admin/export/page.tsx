import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AdminExportPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">导出中心</h1>
        <p className="mt-2 text-sm text-muted-foreground">导出全部学生成绩，默认使用 CSV 以保证兼容和简单。</p>
      </header>

      <Card>
        <CardHeader><CardTitle>导出全部成绩</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>直接导出当前系统中的全部成绩记录。</p>
            <Button asChild><Link href="/api/export/attempts">导出全部 CSV</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
