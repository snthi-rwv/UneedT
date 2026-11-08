export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE';

export interface Subject {
    id: string; name: string; difficulty: number; currentGrade: number | null; color: string; targetGrade?: number;
    _count?: { tasks: number }; gradesCount?: number; summary?: GradeSummary;
}

// Notas del semestre de una materia (escala 0.0 a 5.0, se aprueba con 3.0)
export type GradeStatus = 'empty' | 'good' | 'ok' | 'hard' | 'impossible' | 'secured' | 'finished';
export interface GradeSummary {
    evaluatedPct: number; remainingPct: number; accumulated: number; average: number | null; maxPossible: number; target: number;
    neededForTarget: number | null; neededToPass: number | null; passed: boolean | null; status: GradeStatus;
}
export interface GradeEntry { id?: string; label: string; percent: number; grade: number }
export interface SubjectGrades { subjectId: string; targetGrade: number; entries: GradeEntry[]; summary: GradeSummary }

// Racha y tiempo de estudio por día
export interface Streak { current: number; best: number; studiedToday: boolean; todayMinutes: number; goalMinutes: number }
export interface StudyDayPoint { date: string; minutes: number }
export interface Survey { id: string; score: number; concentration: number | null; performance: number | null; kind: 'BASELINE' | 'FOLLOWUP'; createdAt: string }

export interface Task {
    id: string; title: string; description: string | null; subjectId: string | null; subject: Subject | null; dueDate: string;
    weightPct: number; complexity: number; estimatedHours: number; hoursSpent: number; status: TaskStatus; source: 'MANUAL' | 'EMAIL';
    priorityScore: number; priorityReason: string; critical: boolean;
    guide?: { id: string } | null; // en Inicio: si ya tiene plan específico
}

export interface Focus { top: Task | null; next: Task[]; overdue: number; dueSoon: number; openCount: number }

export type Intensity = 'LIGHT' | 'NORMAL' | 'INTENSE';
export interface Block { id: string; taskId: string; startTime: string; minutes: number; note: string; done: boolean; task: Task }
export interface Plan { id: string; date: string; availableHours: number; startTime: string; endTime: string; intensity: Intensity; blocks: Block[] }

// Plan específico de una tarea (paso a paso) y sus subtareas con cronómetro
export interface GuideStep {
    id: string; order: number; title: string; detail: string; minutes: number; done: boolean; doneAt: string | null;
    spentSeconds: number; runningSince: string | null; creditedSeconds: number;
}
export interface Guide { id: string; context: string; sourceName: string | null; summary: string; usedAi: boolean; updatedAt: string; steps: GuideStep[] }
export interface TaskWithGuide extends Omit<Task, 'guide'> { guide: Guide | null }
export interface GuideList { now: string; tasks: TaskWithGuide[] }
export interface GuideResult { now: string; task: TaskWithGuide; usedAi?: boolean; replanned?: boolean }

export interface Proposal {
    id: string; fromAddress: string; emailSubject: string; subjectHint: string | null; title: string; description: string | null;
    dueDate: string | null; weightPct: number | null; complexity: number | null; estimatedHours: number | null; confidence: number;
}

export interface EmailStatus {
    connected: boolean; pending: number; aiEnabled: boolean;
    account: { email: string; status: string; lastSyncAt: string | null } | null;
    lastLog: { ok: boolean; error: string | null; fetched: number; proposed: number; startedAt: string } | null;
}

export interface Summary {
    tasks: { total: number; done: number; open: number };
    criticalOnTimePct: number | null; emailCapturedPct: number; hoursStudied: number;
    stress: { baseline: number | null; latest: number | null; delta: number | null };
}