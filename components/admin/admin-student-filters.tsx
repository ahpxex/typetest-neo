'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ALL_VALUE = '__all__';

type AdminStudentFiltersProps = {
  query: string;
  enrollmentYear: string;
  schoolCode: string;
  majorCode: string;
  enrollmentYears: string[];
  schoolCodes: string[];
  majorCodes: string[];
};

function toSelectValue(value: string) {
  return value || ALL_VALUE;
}

function toFormValue(value: string) {
  return value === ALL_VALUE ? '' : value;
}

export function AdminStudentFilters({
  query,
  enrollmentYear,
  schoolCode,
  majorCode,
  enrollmentYears,
  schoolCodes,
  majorCodes,
}: AdminStudentFiltersProps) {
  const [selectedYear, setSelectedYear] = useState(toSelectValue(enrollmentYear));
  const [selectedSchool, setSelectedSchool] = useState(toSelectValue(schoolCode));
  const [selectedMajor, setSelectedMajor] = useState(toSelectValue(majorCode));

  return (
    <div className="mb-3 shrink-0 rounded-lg border border-border/70 bg-muted/20 p-3">
      <form className="grid gap-3 lg:grid-cols-[minmax(240px,1.5fr)_160px_160px_180px_auto_auto]">
        <Input
          name="query"
          defaultValue={query}
          placeholder="按学号、姓名或邮箱搜索"
          className="min-w-0"
        />

        <input type="hidden" name="year" value={toFormValue(selectedYear)} />
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-full min-w-0 bg-background">
            <SelectValue placeholder="全部年份" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>全部年份</SelectItem>
            {enrollmentYears.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input type="hidden" name="school" value={toFormValue(selectedSchool)} />
        <Select value={selectedSchool} onValueChange={setSelectedSchool}>
          <SelectTrigger className="w-full min-w-0 bg-background">
            <SelectValue placeholder="全部学院" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>全部学院</SelectItem>
            {schoolCodes.map((option) => (
              <SelectItem key={option} value={option}>{`学院 ${option}`}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input type="hidden" name="major" value={toFormValue(selectedMajor)} />
        <Select value={selectedMajor} onValueChange={setSelectedMajor}>
          <SelectTrigger className="w-full min-w-0 bg-background">
            <SelectValue placeholder="全部专业" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>全部专业</SelectItem>
            {majorCodes.map((option) => (
              <SelectItem key={option} value={option}>{`专业 ${option}`}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="submit" variant="outline">筛选</Button>
        <Button asChild variant="ghost"><Link href="/admin">重置</Link></Button>
      </form>
    </div>
  );
}
