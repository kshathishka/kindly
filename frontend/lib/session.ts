'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { AuthResponse } from './api-types';

/**
 * Client-side session state.
 *
 * The token stored here is the bearer credential every API call carries; the
 * server resolves it to an account and derives ownership from that. Losing it
 * (cleared storage, a private window) means signing in again, nothing worse.
 */

const SESSION_KEY = 'kindly.session';
const ACTIVE_CHILD_KEY = 'kindly.activeChildId';

export interface Session {
  id: string;
  email: string;
  role: string;
  token: string;
}

function read<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A browser with storage disabled still runs; the session just will not
    // survive a reload.
  }
}

export function getSession(): Session | null {
  return read<Session>(SESSION_KEY);
}

export function setSession(auth: AuthResponse): void {
  write(SESSION_KEY, { id: auth.id, email: auth.email, role: auth.role, token: auth.token });
}

export function clearSession(): void {
  write(SESSION_KEY, null);
  write(ACTIVE_CHILD_KEY, null);
}

/**
 * Signs out, revoking the token on the server first.
 *
 * The local session is cleared even if that call fails, so a user on a shared
 * device is never left signed in because the network was down.
 */
export async function signOutEverywhere(): Promise<void> {
  try {
    await api.logout();
  } catch {
    // Best effort. The token expires on its own regardless.
  }
  clearSession();
}

export function getActiveChildId(): string | null {
  return read<string>(ACTIVE_CHILD_KEY);
}

export function setActiveChildId(childId: string | null): void {
  write(ACTIVE_CHILD_KEY, childId);
}

/**
 * Reads the session after mount.
 *
 * Returning `loading` matters: the first server render has no localStorage, so
 * a screen that redirected on a null session would bounce signed-in users out.
 */
export function useSession(): { session: Session | null; loading: boolean; signOut: () => void } {
  const [session, setSessionState] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionState(getSession());
    setLoading(false);
  }, []);

  const signOut = useCallback(() => {
    void signOutEverywhere().finally(() => {
      setSessionState(null);
      window.location.href = '/auth';
    });
  }, []);

  return { session, loading, signOut };
}
