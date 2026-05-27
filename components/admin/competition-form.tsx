'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createCompetitionAction, updateCompetitionAction } from '@/features/admin/competition-actions'
import type { AdminCompetitionSummary, CompetitionArticleOption } from '@/lib/data/queries'

type CompetitionFormProps = {
  mode: 'create' | 'edit'
  redirectTo: string
  articleOptions: CompetitionArticleOption[]
  competition?: AdminCompetitionSummary
  trigger?: React.ReactNode
}

function toDateTimeLocalValue(date: Date | null | undefined) {
  if (!date) {
    return ''
  }
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const statusLabels: Record<CompetitionArticleOption['status'], string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
}

export function CompetitionForm({ mode, redirectTo, articleOptions, competition, trigger }: CompetitionFormProps) {
  const [open, setOpen] = useState(false)
  const initialArticleId = competition?.articleId
    ?? articleOptions.find((option) => option.status === 'published')?.articleId
    ?? articleOptions[0]?.articleId
  const [articleId, setArticleId] = useState<string>(initialArticleId ? String(initialArticleId) : '')

  const action = mode === 'create' ? createCompetitionAction : updateCompetitionAction
  const title = mode === 'create' ? '新建竞赛' : '编辑竞赛'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button>新建竞赛</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            竞赛使用固定文章与限时，创建后默认为草稿，点击「开启」后学生即可在时间窗口内参加。
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="grid gap-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          {mode === 'edit' && competition ? (
            <input type="hidden" name="competitionId" value={competition.id} />
          ) : null}
          <input type="hidden" name="articleId" value={articleId} />

          <div className="grid gap-2">
            <Label htmlFor="competition-title">竞赛名称</Label>
            <Input
              id="competition-title"
              name="title"
              required
              maxLength={160}
              defaultValue={competition?.title ?? ''}
              placeholder="例如：2026 春季打字邀请赛"
            />
          </div>

          <div className="grid gap-2">
            <Label>竞赛文章</Label>
            <Select value={articleId} onValueChange={setArticleId}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="选择一篇文章" />
              </SelectTrigger>
              <SelectContent>
                {articleOptions.length === 0 ? (
                  <SelectItem value="" disabled>没有可用文章，请先到「文章管理」导入</SelectItem>
                ) : (
                  articleOptions.map((option) => (
                    <SelectItem key={option.articleId} value={String(option.articleId)}>
                      {option.title}（{statusLabels[option.status]} · {option.charCount} 字符）
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="competition-duration">时长（秒）</Label>
              <Input
                id="competition-duration"
                name="durationSeconds"
                type="number"
                min={30}
                max={3600}
                required
                defaultValue={competition?.durationSeconds ?? 180}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="competition-max-attempts">每人可参加次数</Label>
              <Input
                id="competition-max-attempts"
                name="maxAttemptsPerStudent"
                type="number"
                min={1}
                max={50}
                required
                defaultValue={competition?.maxAttemptsPerStudent ?? 1}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="competition-start">开始时间（可选）</Label>
              <Input
                id="competition-start"
                name="startAt"
                type="datetime-local"
                defaultValue={toDateTimeLocalValue(competition?.startAt)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="competition-end">结束时间（可选）</Label>
              <Input
                id="competition-end"
                name="endAt"
                type="datetime-local"
                defaultValue={toDateTimeLocalValue(competition?.endAt)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            不填开始时间表示开启后立即可参加；不填结束时间表示在手动关闭前持续开放。
          </p>

          <div className="grid gap-2">
            <Label htmlFor="competition-description">竞赛说明（可选）</Label>
            <Textarea
              id="competition-description"
              name="description"
              maxLength={2000}
              rows={3}
              defaultValue={competition?.description ?? ''}
              placeholder="向学生展示的规则说明或注意事项"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={articleOptions.length === 0}>
              {mode === 'create' ? '创建竞赛' : '保存修改'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
