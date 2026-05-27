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
import { createArticleAction } from '@/features/admin/article-actions'

export function ArticleForm({ redirectTo }: { redirectTo: string }) {
  const [open, setOpen] = useState(false)
  const [language, setLanguage] = useState('en')
  const [difficulty, setDifficulty] = useState('1')
  const [status, setStatus] = useState('published')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>导入新文章</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>导入新文章</DialogTitle>
          <DialogDescription>
            粘贴文章正文即可导入。系统会自动归一化文本并统计字符数与词数，发布后可用于练习、考试与竞赛。
          </DialogDescription>
        </DialogHeader>

        <form action={createArticleAction} className="grid gap-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="language" value={language} />
          <input type="hidden" name="difficultyLevel" value={difficulty} />
          <input type="hidden" name="status" value={status} />

          <div className="grid gap-2">
            <Label htmlFor="article-title">标题</Label>
            <Input id="article-title" name="title" required maxLength={160} placeholder="文章标题" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>语言</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">英文</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>难度</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <SelectItem key={level} value={String(level)}>{`难度 ${level}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">发布（可用于答题）</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="article-content">文章正文</Label>
            <Textarea
              id="article-content"
              name="contentRaw"
              required
              rows={12}
              className="font-mono text-sm"
              placeholder="在此粘贴文章正文…"
            />
          </div>

          <DialogFooter>
            <Button type="submit">导入文章</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
