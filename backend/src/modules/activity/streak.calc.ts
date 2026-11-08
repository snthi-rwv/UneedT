// Racha de estudio. Función pura (sin BD): fácil de probar.
export const MIN_SECONDS_PER_DAY = 15 * 60; // un día cuenta para la racha si se estudió al menos 15 minutos

const DAY = 86_400_000;
const toDay = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY;

/**
 * Racha actual: días seguidos con estudio que terminan hoy (o ayer, si hoy todavía no se completan los 15 min:
 * la racha sigue viva hasta que termine el día). Mejor racha: la más larga de la historia.
 */
export function streak(days: { date: string; seconds: number }[], today: string) {
    const studied = new Set(days.filter((d) => d.seconds >= MIN_SECONDS_PER_DAY).map((d) => toDay(d.date)));
    const t = toDay(today);
    let current = 0;
    for (let d = studied.has(t) ? t : t - 1; studied.has(d); d--) current++;

    let best = 0;
    for (const d of studied) {
        if (studied.has(d - 1)) continue; // solo se cuenta desde el inicio de cada racha
        let n = 1;
        while (studied.has(d + n)) n++;
        best = Math.max(best, n);
    }
    const todaySeconds = days.find((d) => d.date === today)?.seconds ?? 0;
    return { current, best, studiedToday: todaySeconds >= MIN_SECONDS_PER_DAY, todayMinutes: Math.floor(todaySeconds / 60), goalMinutes: MIN_SECONDS_PER_DAY / 60 };
}
