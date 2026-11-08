import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiClient } from '../../integrations/ai/ai.client';
import { DocumentTextService } from '../../integrations/documents/document-text.service';
import { ActivityService } from '../activity/activity.service';
import { PriorityService } from '../priority/priority.service';
import { StudyPlanService } from '../study-plan/study-plan.service';
import { GuideDto, StepActionDto } from './dto/guide.dto';
import { cleanSteps, fallbackSteps, remainingHours, StepDraft } from './guide-steps';
import { GUIDE_SYSTEM_PROMPT } from './guides.prompts';
import { GuidesRepository } from './guides.repository';

const DAY = 86_400_000;
const MAX_CONTEXT = 4000;
const MAX_DOC_CHARS = 10_000; // límite de lo que se le envía a la IA (cuota gratuita de Groq)
const MAX_SEGMENT_S = 4 * 3600; // un solo tramo del cronómetro no cuenta más de 4 h (por si lo olvidan corriendo)

type TaskForGuide = NonNullable<Awaited<ReturnType<GuidesRepository['findTaskForGuide']>>>;

@Injectable()
export class GuidesService {
    constructor(
        private readonly repo: GuidesRepository,
        private readonly ai: AiClient,
        private readonly docs: DocumentTextService,
        private readonly priority: PriorityService,
        private readonly plans: StudyPlanService,
        private readonly activity: ActivityService,
    ) {}

    // Tareas abiertas con su plan específico. "now" permite al navegador corregir la diferencia de reloj del cronómetro.
    async list(userId: string) {
        return { now: new Date().toISOString(), tasks: await this.repo.openTasksWithGuides(userId) };
    }

    /**
     * Crea o rehace el plan específico de una tarea. Lo usan:
     *  - el botón "Empezar" (start=1), con o sin contexto: si se omite, igual se arma un plan con lo que se sabe;
     *  - "Añadir contexto" y "Generar sin contexto" en Plan de estudio.
     * Si ya había un plan, los pasos hechos se conservan y la IA planea solo lo que falta.
     * Al final se recalcula la prioridad y, si hay plan general para hoy, también se replantea.
     */
    async upsert(userId: string, taskId: string, dto: GuideDto, file?: Express.Multer.File) {
        const task = await this.repo.findTaskForGuide(userId, taskId);
        if (!task) throw new NotFoundException('Tarea no encontrada');
        if (task.status === 'DONE') throw new BadRequestException('Esta tarea ya está terminada.');
        const prev = task.guide;

        // Documento: el nuevo reemplaza al anterior; si no se adjuntó otro, se conserva salvo que lo hayan quitado
        let sourceName = prev?.sourceName ?? null;
        let sourceText = prev?.sourceText ?? null;
        if (file) {
            sourceText = (await this.docs.extract(file)).slice(0, MAX_DOC_CHARS);
            sourceName = (file.originalname || 'documento').slice(0, 120);
        } else if (dto.removeFile === '1') {
            sourceName = sourceText = null;
        }
        const context = dto.context !== undefined ? dto.context.trim().slice(0, MAX_CONTEXT) : prev?.context ?? '';

        // "¿Qué tanto se te dificulta?" se guarda como la complejidad de la tarea (afecta prioridad y tiempos)
        const changes: Prisma.TaskUncheckedUpdateInput = {};
        if (dto.difficulty && dto.difficulty !== task.complexity) Object.assign(changes, { complexity: dto.difficulty, aiAdjustment: 0, aiReason: null });
        if (dto.start === '1' && task.status === 'PENDING') changes.status = 'IN_PROGRESS';
        if (Object.keys(changes).length) await this.repo.updateTask(task.id, changes);

        const plan = await this.buildSteps({ ...task, complexity: dto.difficulty ?? task.complexity }, context, sourceName, sourceText);
        await this.repo.saveGuide(userId, task.id, { context, sourceName, sourceText, summary: plan.summary, usedAi: plan.usedAi }, plan.steps);

        await this.syncEstimate(task.id);
        await this.priority.recompute(userId);
        const replanned = await this.plans.replanTodayIfExists(userId);
        return { now: new Date().toISOString(), task: await this.repo.taskWithGuide(userId, task.id), usedAi: plan.usedAi, replanned };
    }

    private async buildSteps(task: TaskForGuide, context: string, sourceName: string | null, sourceText: string | null) {
        const done = task.guide?.steps.filter((s) => s.done) ?? [];
        const pendingMin = Math.max(task.estimatedHours - task.hoursSpent, 0.5) * 60;

        // Solo se envía lo necesario para planear la tarea
        const input = {
            tarea: {
                titulo: task.title,
                descripcion: task.description ?? null,
                materia: task.subject?.name ?? null,
                dificultadParaElEstudiante: task.complexity,
                pesoEnLaNotaPct: task.weightPct,
                diasParaEntrega: Math.round(((task.dueDate.getTime() - Date.now()) / DAY) * 10) / 10,
                tiempoEstimadoMin: Math.round(pendingMin),
            },
            contextoDelEstudiante: context || null,
            documento: sourceText ? { nombre: sourceName, texto: sourceText } : null,
            pasosYaCompletados: done.map((s) => s.title),
        };
        const out = await this.ai.completeJson<{ summary?: string; steps?: unknown }>(GUIDE_SYSTEM_PROMPT, JSON.stringify(input), 3000);
        const steps = cleanSteps(out?.steps);
        if (steps) return { steps, summary: String(out?.summary ?? '').trim().slice(0, 200), usedAi: true };

        // Plan B: sin IA (o si respondió algo inservible) igual hay un paso a paso útil
        return { steps: fallbackSteps(pendingMin) as StepDraft[], summary: '', usedAi: false };
    }

    /**
     * Acciones sobre un paso:
     *  start  → arranca su cronómetro (y detiene cualquier otro que estuviera corriendo)
     *  pause  → detiene el cronómetro y acumula el tramo
     *  finish → lo marca hecho y suma su tiempo a la tarea (lo medido o, si no se usó el cronómetro, lo estimado)
     *  undo   → lo vuelve a dejar pendiente y descuenta lo que había sumado
     *  adjust → corrige el tiempo medido (por ejemplo, si olvidó detener el cronómetro)
     */
    async stepAction(userId: string, stepId: string, dto: StepActionDto) {
        const step = await this.repo.findStep(userId, stepId);
        if (!step) throw new NotFoundException('Paso no encontrado');
        const taskId = step.guide.taskId;
        const now = new Date();
        const elapsed = step.runningSince ? Math.min(Math.round((now.getTime() - step.runningSince.getTime()) / 1000), MAX_SEGMENT_S) : 0;
        let hoursChanged = false;

        switch (dto.action) {
            case 'start':
                if (step.done) throw new BadRequestException('Este paso ya está terminado.');
                if (!step.runningSince) {
                    await this.stopAllRunning(userId, now); // ya registra el tiempo del cronómetro que pausa
                    await this.repo.updateStep(step.id, { runningSince: now });
                }
                await this.repo.markInProgress(taskId);
                break;

            case 'pause':
                if (step.runningSince) {
                    await this.repo.updateStep(step.id, { spentSeconds: step.spentSeconds + elapsed, runningSince: null });
                    await this.activity.log(userId, elapsed);
                }
                break;

            case 'finish': {
                if (step.done) break;
                const spent = step.spentSeconds + elapsed;
                const credit = spent > 0 ? spent : step.minutes * 60;
                await this.repo.updateStep(step.id, { done: true, doneAt: now, spentSeconds: spent, runningSince: null, creditedSeconds: credit });
                await this.repo.addTaskHours(taskId, (credit - step.creditedSeconds) / 3600);
                await this.repo.markInProgress(taskId);
                // Tiempo de estudio del día: el tramo del cronómetro, o lo estimado si nunca se usó
                await this.activity.log(userId, spent > 0 ? elapsed : credit);
                hoursChanged = true;
                break;
            }

            case 'undo':
                if (!step.done) break;
                await this.repo.updateStep(step.id, { done: false, doneAt: null, creditedSeconds: 0 });
                await this.repo.addTaskHours(taskId, -step.creditedSeconds / 3600);
                if (step.spentSeconds === 0) await this.activity.log(userId, -step.creditedSeconds, step.doneAt ?? now); // era tiempo estimado: se descuenta del día en que se sumó
                hoursChanged = true;
                break;

            case 'adjust': {
                if (dto.minutes === undefined) throw new BadRequestException('Indica cuántos minutos dedicaste.');
                const spent = dto.minutes * 60;
                // Lo que ya estaba en el registro del día: lo medido, o lo estimado si se marcó sin cronómetro
                const logged = step.spentSeconds > 0 ? step.spentSeconds : step.done ? step.creditedSeconds : 0;
                const effective = step.done && spent === 0 ? step.minutes * 60 : spent;
                await this.activity.log(userId, effective - logged, step.doneAt ?? now); // la corrección va al día en que se terminó el paso
                if (step.done) {
                    const credit = spent > 0 ? spent : step.minutes * 60;
                    await this.repo.updateStep(step.id, { spentSeconds: spent, runningSince: null, creditedSeconds: credit });
                    await this.repo.addTaskHours(taskId, (credit - step.creditedSeconds) / 3600);
                    hoursChanged = true;
                } else {
                    await this.repo.updateStep(step.id, { spentSeconds: spent, runningSince: null });
                }
                break;
            }
        }

        if (hoursChanged) {
            await this.syncEstimate(taskId);
            await this.priority.recompute(userId);
        }
        return { now: now.toISOString(), task: await this.repo.taskWithGuide(userId, taskId) };
    }

    // Solo un cronómetro a la vez: los que estén corriendo se pausan y acumulan su tramo
    private async stopAllRunning(userId: string, now: Date) {
        for (const s of await this.repo.runningSteps(userId)) {
            const elapsed = Math.min(Math.round((now.getTime() - s.runningSince!.getTime()) / 1000), MAX_SEGMENT_S);
            await this.repo.updateStep(s.id, { spentSeconds: s.spentSeconds + elapsed, runningSince: null });
            await this.activity.log(userId, elapsed);
        }
    }

    /** Horas estimadas de la tarea = lo ya dedicado + lo que falta según los pasos pendientes y el ritmo real. */
    private async syncEstimate(taskId: string) {
        const t = await this.repo.taskProgress(taskId);
        if (!t?.guide) return;
        const estimated = Math.round((t.hoursSpent + remainingHours(t.guide.steps)) * 100) / 100;
        await this.repo.updateTask(taskId, { estimatedHours: Math.max(estimated, 0.25) });
    }
}
