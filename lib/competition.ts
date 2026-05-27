export const competitionStatusValues = ['draft', 'published', 'closed', 'archived'] as const;

export type CompetitionStatus = (typeof competitionStatusValues)[number];

/**
 * The participation phase derived from a competition's status and time window.
 * - hidden: not visible to students (draft / archived).
 * - upcoming: published, but the start time has not arrived yet.
 * - open: published and currently inside the participation window — students may compete.
 * - ended: published, but the end time has passed (waiting to be closed).
 * - closed: explicitly closed by an admin; leaderboard is frozen and still visible.
 */
export type CompetitionPhase = 'hidden' | 'upcoming' | 'open' | 'ended' | 'closed';

export type CompetitionTimingInput = {
  status: CompetitionStatus;
  startAt: Date | null;
  endAt: Date | null;
};

const statusLabels: Record<CompetitionStatus, string> = {
  draft: '草稿',
  published: '已开启',
  closed: '已关闭',
  archived: '已归档',
};

const phaseLabels: Record<CompetitionPhase, string> = {
  hidden: '未发布',
  upcoming: '即将开始',
  open: '进行中',
  ended: '已结束',
  closed: '已关闭',
};

export function getCompetitionStatusLabel(status: CompetitionStatus) {
  return statusLabels[status] ?? status;
}

export function getCompetitionPhaseLabel(phase: CompetitionPhase) {
  return phaseLabels[phase] ?? phase;
}

export function getCompetitionPhase(competition: CompetitionTimingInput, now: Date = new Date()): CompetitionPhase {
  if (competition.status === 'draft' || competition.status === 'archived') {
    return 'hidden';
  }

  if (competition.status === 'closed') {
    return 'closed';
  }

  // status === 'published'
  const nowMs = now.getTime();

  if (competition.startAt && nowMs < competition.startAt.getTime()) {
    return 'upcoming';
  }

  if (competition.endAt && nowMs >= competition.endAt.getTime()) {
    return 'ended';
  }

  return 'open';
}

/** Students can start a new attempt only while a competition is open. */
export function isCompetitionJoinable(phase: CompetitionPhase) {
  return phase === 'open';
}

/** Draft and archived competitions are hidden from students entirely. */
export function isCompetitionVisibleToStudents(status: CompetitionStatus) {
  return status === 'published' || status === 'closed';
}
