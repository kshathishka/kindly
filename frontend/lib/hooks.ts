'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import type { ChildProfile, HelpRequest, Story } from './api-types';
import { getActiveChildId, setActiveChildId } from './session';

/**
 * Data loading for the caregiver screens.
 *
 * The backend has no realtime channel, so anything a child can change while a
 * caregiver is looking at it is polled. The intervals are deliberately short
 * for help requests — a child waiting on an answer is the one case where a
 * stale screen actually matters — and absent everywhere else.
 */

export interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function messageFor(cause: unknown, fallback: string): string {
  return cause instanceof ApiError ? cause.message : fallback;
}

/** Loads the child profiles and remembers which one is in context. */
export function useChildren(): AsyncState<ChildProfile[]> & {
  activeChild: ChildProfile | null;
  selectChild: (childId: string) => void;
} {
  const [data, setData] = useState<ChildProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listChildren()
      .then((children) => {
        if (cancelled) return;
        setData(children);
        const stored = getActiveChildId();
        const chosen = children.find((c) => c.id === stored) ?? children[0] ?? null;
        setActiveId(chosen?.id ?? null);
        if (chosen && chosen.id !== stored) setActiveChildId(chosen.id);
        setError(null);
      })
      .catch((cause) => {
        if (!cancelled) setError(messageFor(cause, 'Could not load your child profiles.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [nonce]);

  const selectChild = useCallback((childId: string) => {
    setActiveId(childId);
    setActiveChildId(childId);
  }, []);

  return {
    data,
    loading,
    error,
    reload: () => setNonce((n) => n + 1),
    activeChild: data.find((c) => c.id === activeId) ?? null,
    selectChild,
  };
}

/**
 * Help requests for one child, polled while the tab is visible.
 *
 * Polling pauses when the page is hidden so a backgrounded tab is not making
 * requests every few seconds, and resumes with an immediate fetch so the first
 * thing a returning caregiver sees is current.
 */
export function useHelpRequests(childId: string | null, intervalMs = 5000): AsyncState<HelpRequest[]> {
  const [data, setData] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (showSpinner: boolean) => {
    if (!childId) {
      setData([]);
      return;
    }
    if (showSpinner) setLoading(true);
    try {
      const requests = await api.listHelpRequests(childId);
      setData(requests.slice().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)));
      setError(null);
    } catch (cause) {
      setError(messageFor(cause, 'Could not load requests.'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    void load(true);

    const start = () => {
      if (timer.current) return;
      timer.current = setInterval(() => { void load(false); }, intervalMs);
    };
    const stop = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        void load(false);
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load, intervalMs]);

  return { data, loading, error, reload: () => { void load(true); } };
}

/** Story history for one child. Stories do not change on their own, so no polling. */
export function useStories(childId: string | null): AsyncState<Story[]> {
  const [data, setData] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!childId) {
      setData([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.storyHistory(childId)
      .then((stories) => {
        if (cancelled) return;
        setData(stories.slice().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)));
        setError(null);
      })
      .catch((cause) => {
        if (!cancelled) setError(messageFor(cause, 'Could not load stories.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [childId, nonce]);

  return { data, loading, error, reload: () => setNonce((n) => n + 1) };
}

/**
 * Watches one request until a caregiver answers it.
 *
 * This drives the child's waiting screen. It polls faster than the caregiver
 * list does, because on this screen a child is actively waiting to be told
 * somebody is coming.
 */
export function useRequestWatch(requestId: string | null, intervalMs = 3000): HelpRequest | null {
  const [request, setRequest] = useState<HelpRequest | null>(null);

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      return;
    }
    let cancelled = false;

    const poll = async () => {
      try {
        const latest = await api.getHelpRequest(requestId);
        if (!cancelled) setRequest(latest);
      } catch {
        // Keep the last known state on the screen. Replacing a "someone is
        // coming" message with an error because one poll failed would be worse
        // than showing slightly stale good news.
      }
    };

    void poll();
    const timer = setInterval(() => { void poll(); }, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [requestId, intervalMs]);

  return request;
}
