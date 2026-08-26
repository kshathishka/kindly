'use client'

import { useState } from 'react'
import { AlertCircle } from 'lucide-react'

/**
 * Routines have no backend yet.
 *
 * app/main.py exposes children, stories, help requests and social skills — but
 * nothing for routines. Rather than write to localStorage and let a caregiver
 * believe a routine is saved, this screen says plainly that it is a sketch.
 * The endpoints it is waiting on are listed in docs/INTEGRATION.md.
 */
export default function RoutinesPage() {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')

  return (
    <main className="form-page">
      <a href="/" className="text-link">← Back to Kindly</a>
      <div className="form-panel">
        <span className="eyebrow">ROUTINES</span>
        <h1>Create a routine that feels familiar.</h1>
        <p>Give the routine a name and add a gentle note for the moments around it.</p>

        <div className="notice" role="note">
          <AlertCircle size={17} />
          <span>
            Routines are not saved yet. The Kindly server has no routine endpoints, so this is a
            place to draft one — copy it somewhere safe before you leave the page.
          </span>
        </div>

        <label htmlFor="routine-title">Routine name</label>
        <input
          id="routine-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Getting ready for school"
        />

        <label htmlFor="routine-note">What helps?</label>
        <textarea
          id="routine-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add steps, sensory supports, or a reassuring phrase."
        />
      </div>
    </main>
  )
}
