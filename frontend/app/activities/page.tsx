'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { ChildProfile } from '@/lib/api-types'
import { getActiveChildId, getSession } from '@/lib/session'

/**
 * Activities are stored on the child profile itself.
 *
 * The backend has no activities table, but ChildProfile.favorite_activities is
 * exactly this list, so this screen appends to it with PUT /children/{id}
 * rather than inventing client-only storage.
 */
export default function ActivitiesPage() {
  const [child, setChild] = useState<ChildProfile | null>(null)
  const [title, setTitle] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!getSession()) {
      window.location.href = '/auth'
      return
    }
    api.listChildren(getSession()?.id)
      .then((children) => {
        const stored = getActiveChildId()
        setChild(children.find((c) => c.id === stored) ?? children[0] ?? null)
      })
      .catch(() => setError('Could not reach the Kindly server.'))
  }, [])

  const add = async () => {
    const value = title.trim()
    if (!child || !value) return
    if (child.favorite_activities.includes(value)) {
      setError('That activity is already on the list.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      // PUT replaces the whole profile, so the existing one is sent back with
      // just this field extended.
      const updated = await api.updateChild(child.id, {
        ...child,
        favorite_activities: [...child.favorite_activities, value],
      })
      setChild(updated)
      setTitle('')
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not save this activity.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="form-page">
      <a href="/" className="text-link">← Back to Kindly</a>
      <div className="form-panel">
        <span className="eyebrow">NEW ACTIVITY</span>
        <h1>Add something your child enjoys.</h1>
        <p>
          {child
            ? `Kindly uses these when writing stories for ${child.name}.`
            : 'Kindly uses these when writing stories.'}
        </p>

        <label htmlFor="activity-title">Activity name</label>
        <input
          id="activity-title"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setSaved(false) }}
          placeholder="e.g. Drawing dinosaurs"
        />

        {error && <p className="form-error" role="alert">{error}</p>}
        {saved && <p className="form-success" role="status"><Check size={15} /> Added to the profile.</p>}

        <button className="button coral" onClick={add} disabled={!child || !title.trim() || busy}>
          {busy ? <><Loader2 size={17} className="spin" /> Saving…</> : 'Add activity'}
        </button>

        {child && child.favorite_activities.length > 0 && (
          <>
            <label>Already on the list</label>
            <div className="preference-tags">
              {child.favorite_activities.map((item) => <span key={item}>{item}</span>)}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
