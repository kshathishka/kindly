'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Heart, Loader2, Sparkles } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import {
  SENSORY_KEYS,
  type CommunicationLevel, type SensoryKey, type SensoryLevel, type SensorySensitivities,
} from '@/lib/api-types'
import { getSession, setActiveChildId } from '@/lib/session'

const steps = [
  { title: 'Let us get to know your child', detail: 'A few gentle details help Kindly feel more personal.' },
  { title: 'Choose what helps', detail: 'Pick the supports that make everyday moments easier.' },
  { title: 'You are ready', detail: 'We will use this to shape stories, routines, and requests.' },
]

const communicationLevels: { value: CommunicationLevel; label: string; detail: string }[] = [
  { value: 'pre-verbal', label: 'Pre-verbal', detail: 'Communicates without spoken words' },
  { value: 'simple-sentences', label: 'Simple sentences', detail: 'A few words at a time' },
  { value: 'conversational', label: 'Conversational', detail: 'Back-and-forth conversation' },
  { value: 'advanced', label: 'Advanced', detail: 'Complex language and ideas' },
]

const sensoryLabels: Record<SensoryKey, string> = {
  sound: 'Sound', light: 'Light', touch: 'Touch',
  smell: 'Smell', crowds: 'Crowds', texture: 'Texture',
}

const sensoryLevels: SensoryLevel[] = ['low', 'medium', 'high']

const calmingOptions = ['Deep breaths', 'Quiet space', 'Deep pressure', 'Music', 'Fidget toy', 'Extra time']

/** Every sensory key must be present or the backend validator rejects the profile. */
function blankSensory(): SensorySensitivities {
  return { sound: 'low', light: 'low', touch: 'low', smell: 'low', crowds: 'low', texture: 'low' }
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [pronouns, setPronouns] = useState('')
  const [communicationLevel, setCommunicationLevel] = useState<CommunicationLevel>('simple-sentences')
  const [sensory, setSensory] = useState<SensorySensitivities>(blankSensory)
  const [calming, setCalming] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!getSession()) window.location.href = '/auth'
  }, [])

  const toggleCalming = (option: string) => {
    setCalming((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option])
  }

  const nameIsValid = name.trim().length > 0

  const finish = async () => {
    setError(null)
    setBusy(true)
    try {
      const parsedAge = age.trim() ? Number(age) : null
      const child = await api.createChild({
        caregiver_id: getSession()?.id ?? null,
        name: name.trim(),
        age: parsedAge !== null && Number.isFinite(parsedAge) ? parsedAge : null,
        communication_level: communicationLevel,
        sensory_sensitivities: sensory,
        calming_techniques: calming,
        preferred_pronouns: pronouns.trim() || null,
      })
      setActiveChildId(child.id)
      setStep(2)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not save this profile. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-top">
        <a className="onboarding-brand" href="/"><span className="brand-mark"><Heart size={19} fill="currentColor" /></span> Kindly</a>
        <span className="onboarding-progress">Step {step + 1} of {steps.length}</span>
      </header>

      <div className="onboarding-layout">
        <aside className="onboarding-aside">
          <div className="onboarding-sun"><Sparkles size={24} /></div>
          <span className="eyebrow">A SOFTER START</span>
          <h1>Let&apos;s make more good days.</h1>
          <p>Kindly helps you prepare, communicate, and connect in ways that feel right for your family.</p>
          <div className="onboarding-steps" aria-label="Onboarding progress">
            {steps.map((item, index) => (
              <div
                className={index === step ? 'onboarding-step current' : index < step ? 'onboarding-step done' : 'onboarding-step'}
                key={item.title}
              >
                <span>{index < step ? <Check size={15} /> : index + 1}</span>
                <div><b>{item.title}</b><small>{item.detail}</small></div>
              </div>
            ))}
          </div>
        </aside>

        <section className="onboarding-card" aria-labelledby="onboarding-title">
          {step === 0 && (
            <div className="onboarding-form">
              <span className="eyebrow">FIRST, A LITTLE ABOUT YOUR CHILD</span>
              <h2 id="onboarding-title">Who are we supporting?</h2>
              <p className="onboarding-copy">This helps us create a more familiar space. You can change anything later.</p>

              <div className="field-block">
                <label htmlFor="child-name">Child&apos;s name</label>
                <input id="child-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Child&apos;s name" autoComplete="off" />
              </div>
              <div className="field-block">
                <label htmlFor="child-age">Age <span className="field-optional">(optional)</span></label>
                <input id="child-age" type="number" min={1} max={18} value={age} onChange={(e) => setAge(e.target.value)} placeholder="7" />
              </div>
              <div className="field-block">
                <label htmlFor="child-pronouns">Pronouns <span className="field-optional">(optional)</span></label>
                <input id="child-pronouns" value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="she/her, he/him, they/them" autoComplete="off" />
                <span className="field-hint">Used in the stories Kindly writes, so they sound right.</span>
              </div>

              <div className="onboarding-note"><Heart size={17} fill="currentColor" /><span>We&apos;ll keep this space gentle, private, and yours.</span></div>
            </div>
          )}

          {step === 1 && (
            <div className="onboarding-form">
              <span className="eyebrow">WHAT HELPS MOST</span>
              <h2 id="onboarding-title">Choose a few supports.</h2>
              <p className="onboarding-copy">There is no perfect answer. Start with what feels useful today.</p>

              <fieldset className="field-block">
                <legend>How does your child communicate?</legend>
                <div className="format-list">
                  {communicationLevels.map((level) => (
                    <button
                      type="button"
                      key={level.value}
                      className={communicationLevel === level.value ? 'format selected' : 'format'}
                      onClick={() => setCommunicationLevel(level.value)}
                      aria-pressed={communicationLevel === level.value}
                    >
                      <span className="radio" />{level.label}<small>{level.detail}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="field-block">
                <legend>Sensory sensitivities</legend>
                <span className="field-hint">How strongly does each one affect your child?</span>
                <div className="sensory-grid">
                  {SENSORY_KEYS.map((key) => (
                    <div className="sensory-row" key={key}>
                      <b>{sensoryLabels[key]}</b>
                      <div className="sensory-choices" role="group" aria-label={sensoryLabels[key]}>
                        {sensoryLevels.map((level) => (
                          <button
                            type="button"
                            key={level}
                            className={sensory[key] === level ? 'choice selected' : 'choice'}
                            onClick={() => setSensory((current) => ({ ...current, [key]: level }))}
                            aria-pressed={sensory[key] === level}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>

              <fieldset className="field-block">
                <legend>What helps your child settle?</legend>
                <div className="onboarding-options">
                  {calmingOptions.map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={calming.includes(option) ? 'onboarding-option selected' : 'onboarding-option'}
                      onClick={() => toggleCalming(option)}
                      aria-pressed={calming.includes(option)}
                    >
                      <span>{calming.includes(option) && <Check size={15} />}</span>{option}
                    </button>
                  ))}
                </div>
              </fieldset>

              {error && <p className="form-error" role="alert">{error}</p>}
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-form onboarding-complete">
              <div className="onboarding-completion-badge">
                <span className="onboarding-check"><Check size={22} /></span><span>YOU&apos;RE ALL SET</span>
              </div>
              <h2 id="onboarding-title">Welcome to {name.trim()}&apos;s Kindly space.</h2>
              <p className="onboarding-copy">We&apos;ll start with your chosen supports and learn what helps along the way.</p>
              <a className="button coral onboarding-complete-cta" href="/">Go to my space <ArrowRight size={17} /></a>
            </div>
          )}

          {step < 2 && (
            <div className="onboarding-actions">
              <button
                type="button"
                className="onboarding-back"
                onClick={() => setStep((current) => Math.max(0, current - 1))}
                disabled={step === 0}
              >
                <ArrowLeft size={16} /> Previous
              </button>
              <button
                type="button"
                className="button coral"
                disabled={busy || (step === 0 && !nameIsValid)}
                onClick={() => { if (step === 0) setStep(1); else void finish() }}
              >
                {busy
                  ? <><Loader2 size={17} className="spin" /> Saving</>
                  : <>{step === 0 ? 'Continue' : 'Finish setup'} <ArrowRight size={17} /></>}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
