import { TrainingSession } from '../types/session';

const STORAGE_KEY = 'coachplan_saved_sessions_v1';

export function getSavedSessions(): TrainingSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load saved sessions', err);
    return [];
  }
}

export function saveSessionToStorage(session: TrainingSession): { success: boolean; isNew: boolean } {
  try {
    const existing = getSavedSessions();
    const index = existing.findIndex(s => s.id === session.id);
    let updated: TrainingSession[];
    let isNew = false;

    if (index >= 0) {
      updated = [...existing];
      updated[index] = session;
    } else {
      updated = [session, ...existing];
      isNew = true;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return { success: true, isNew };
  } catch (err) {
    console.error('Failed to save session', err);
    return { success: false, isNew: false };
  }
}

export function deleteSavedSession(id: string): boolean {
  try {
    const existing = getSavedSessions();
    const filtered = existing.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error('Failed to delete session', err);
    return false;
  }
}
