'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { ChildProfile, Story } from '@/lib/api-types'
import { getActiveChildId, getSession } from '@/lib/session'

export default function SituationsPage() {
  const [child, setChild] = useState<ChildProfile | null>(null)
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [story, setStory] = useState<Story | null>(null)
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

  // The backend rejects a situation shorter than 5 characters.
  const canSubmit = Boolean(child) && detail.trim().length >= 5

  const save = async () => {
    if (!child) return
    setBusy(true)
    setError(null)
    try {
      const created = await api.generateStory({
        child_id: child.id,
        situation: detail.trim(),
        title: title.trim() || 'A new social story',
        tone: 'calm and supportive',
        length: 'short',
      })
      setStory(created)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not create the story.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="form-page">
      <a href="/" className="text-link">← Back to Kindly</a>
      <div className="form-panel">
        <span className="eyebrow">PREPARE TOGETHER</span>
        <h1>Make a plan for a new situation.</h1>
        <p>
          Name the moment, then describe what already happens.
          {child ? ` Kindly will write it for ${child.name}.` : ''}
        </p>

        <label htmlFor="situation-title">Situation</label>
        <input
          id="situation-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. A busy grocery store"
          maxLength={100}
        />

        <label htmlFor="situation-detail">What usually happens?</label>
        <textarea
          id="situation-detail"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Describe the place, the people, and what tends to feel hard."
        />

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="button coral" onClick={save} disabled={!canSubmit || busy}>
          {busy ? <><Loader2 size={17} className="spin" /> Writing…</> : <><Sparkles size={17} /> Make the story</>}
        </button>

        {!child && !error && <p className="field-hint">Loading your child&apos;s profile…</p>}

        {story && (
          <div className="story-reader">
            <h3>{story.title}</h3>
            <p className="story-body">{story.story}</p>
            {story.source === 'template' && (
              <p className="field-hint">
                Written from Kindly&apos;s template — the AI service was unavailable or no key is configured.
              </p>
            )}
            <a className="button secondary" href="/">Back to my space <ArrowRight size={16} /></a>
          </div>
        )}
      </div>
    </main>
  )
}
