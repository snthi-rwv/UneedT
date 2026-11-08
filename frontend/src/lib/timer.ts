import { useEffect, useState } from 'react';
import { GuideStep } from '../types';

const MAX_SEGMENT_S = 4 * 3600; // igual que el servidor: un tramo no cuenta más de 4 h
export const STILL_THERE_S = 2 * 3600; // después de 2 h corriendo se pregunta "¿sigues estudiando?"

/** Segundos del tramo que está corriendo ahora (0 si el cronómetro está detenido). */
export const runningSeconds = (s: GuideStep, nowMs: number) =>
    s.runningSince ? Math.min(Math.max((nowMs - Date.parse(s.runningSince)) / 1000, 0), MAX_SEGMENT_S) : 0;

/** Tiempo real de un paso: lo que sumó si está hecho; si no, lo medido más el tramo en curso. */
export const realSeconds = (s: GuideStep, nowMs: number) => (s.done ? s.creditedSeconds : s.spentSeconds + runningSeconds(s, nowMs));

/** 0:42 · 12:05 · 1:03:20 */
export function clock(sec: number) {
    const t = Math.floor(sec);
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    const mm = h ? String(m).padStart(2, '0') : String(m);
    return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** Semáforo del tiempo: verde hasta el 80% de lo planeado, amarillo hasta el 100%, rojo si se pasa. */
export function timeTone(real: number, plannedSec: number): 'good' | 'warn' | 'bad' {
    if (plannedSec <= 0) return 'good';
    if (real > plannedSec) return 'bad';
    return real > plannedSec * 0.8 ? 'warn' : 'good';
}

/**
 * Hora actual corregida con el reloj del servidor (offsetMs = hora del servidor − hora del navegador).
 * Solo avanza cada segundo mientras haya un cronómetro corriendo, para no redibujar sin necesidad.
 */
export function useNow(active: boolean, offsetMs: number) {
    const [now, setNow] = useState(() => Date.now() + offsetMs);
    useEffect(() => {
        setNow(Date.now() + offsetMs);
        if (!active) return;
        const id = window.setInterval(() => setNow(Date.now() + offsetMs), 1000);
        return () => window.clearInterval(id);
    }, [active, offsetMs]);
    return now;
}
