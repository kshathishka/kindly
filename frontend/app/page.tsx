'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Bell, BookOpen, Check, ChevronDown, CircleHelp, Clock3,
  Heart, Home, Loader2, MessageCircle, MoreHorizontal, Play, Plus, Settings2,
  Sparkles, UserRound, X,
} from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type {
  CaregiverAction, ChildProfile, FrontendConfig, HelpRequest, HelpRequestNeed, Story,
} from '@/lib/api-types'
import { useChildren, useHelpRequests, useRequestWatch, useStories } from '@/lib/hooks'
import { clearSession, getSession, useSession } from '@/lib/session'

const navItems = [
  { label: 'Home', icon: Home },
  { label: 'Stories', icon: BookOpen },
  { label: 'Requests', icon: MessageCircle },
  { label: 'Routines', icon: Clock3 },
  { label: 'Profile', icon: UserRound },
]

/** Used until GET /api/v1/frontend-config answers. */
const FALLBACK_REQUEST_TYPES: FrontendConfig['request_types'] = [
  { key: 'bathroom', label: 'Bathroom', detail: 'I need the bathroom', color: 'yellow' },
  { key: 'break', label: 'I need a break', detail: 'I need quiet', color: 'blue' },
  { key: 'too_loud', label: 'Too loud', detail: 'It is too loud', color: 'purple' },
  { key: 'uncomfortable', label: 'I feel uncomfortable', detail: 'I need support', color: 'coral' },
  { key: 'need_caregiver', label: 'I need my caregiver', detail: 'Please come help me', color: 'green' },
  { key: 'lost', label: "I'm lost", detail: 'I cannot find you', color: 'red' },
  { key: 'something_hurts', label: 'Something hurts', detail: 'I need help now', color: 'orange' },
]

const NEED_ICON: Record<HelpRequestNeed, string> = {
  bathroom: '◒', break: '☁', too_loud: '◯', uncomfortable: '♡',
  need_caregiver: '☀', lost: '✦', something_hurts: '✚',
}

/** A request nobody has answered yet still needs a caregiver's attention. */
function isOpen(request: HelpRequest): boolean {
  return request.status === 'sent' || request.status === 'caregiver_seen'
}

function statusLabel(request: HelpRequest): string {
  switch (request.status) {
    case 'sent': return 'Waiting'
    case 'caregiver_seen': return 'Seen'
    case 'caregiver_responded': return 'Answered'
    case 'caregiver_coming': return 'Coming'
    case 'caregiver_unavailable': return 'Cannot come'
  }
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

function initial(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.slice(0, 1).toLocaleUpperCase() : ''
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return <button aria-label={label} onClick={onClick} className="icon-button">{children}</button>
}

function SectionTitle({ eyebrow, title, detail }: { eyebrow?: string; title: string; detail?: string }) {
  return (
    <div className="section-title">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {detail && <p>{detail}</p>}
    </div>
  )
}

export default function Page() {
  const { loading: sessionLoading } = useSession()
  const [active, setActive] = useState('Home')
  const [childMode, setChildMode] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [config, setConfig] = useState<FrontendConfig | null>(null)

  const children = useChildren()
  const child = children.activeChild
  const requests = useHelpRequests(child?.id ?? null)
  const stories = useStories(child?.id ?? null)

  useEffect(() => {
    if (!getSession()) window.location.href = '/auth'
  }, [])

  useEffect(() => {
    api.frontendConfig().then(setConfig).catch(() => setConfig(null))
  }, [])

  const requestTypes = config?.request_types ?? FALLBACK_REQUEST_TYPES
  const openRequests = requests.data.filter(isOpen)

  if (sessionLoading || children.loading) {
    return (
      <main className="loading-page">
        <Loader2 size={28} className="spin" />
        <p>Loading your space…</p>
      </main>
    )
  }

  if (children.error) {
    return (
      <main className="loading-page">
        <h1>Kindly cannot reach the server</h1>
        <p>{children.error}</p>
        <button className="button coral" onClick={children.reload}>Try again</button>
      </main>
    )
  }

  // A caregiver with no child profile yet has nothing to show, so send them to
  // the one screen that helps: onboarding.
  if (children.data.length === 0) {
    return (
      <main className="loading-page">
        <h1>Let&apos;s set up your space</h1>
        <p>Add your child&apos;s profile to start preparing, communicating, and connecting.</p>
        <a className="button coral" href="/onboarding">Start setup <ArrowRight size={17} /></a>
      </main>
    )
  }

  if (childMode && child) {
    return (
      <ChildMode
        child={child}
        requestTypes={requestTypes}
        onExit={() => { setChildMode(false); requests.reload() }}
      />
    )
  }

  const childName = child?.name ?? ''

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Heart size={20} fill="currentColor" /></div><span>Kindly</span></div>
        <button className="profile-mini" onClick={() => setActive('Profile')} aria-label="Open profile">
          <div className="avatar">{initial(childName)}</div>
          <div>
            <strong>{childName ? `${childName}'s space` : 'Your space'}</strong>
            <small>Caregiver view</small>
          </div>
          <ChevronDown size={15} />
        </button>
        <nav aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={active === label ? 'nav-item active' : 'nav-item'}
              onClick={() => setActive(label)}
              aria-label={label}
            >
              <Icon size={19} /><span>{label}</span>
              {label === 'Requests' && openRequests.length > 0 && <b className="nav-badge">{openRequests.length}</b>}
              <span className="nav-tooltip" role="tooltip">{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setActive('Settings')} aria-label="Settings">
            <Settings2 size={19} /><span>Settings</span>
            <span className="nav-tooltip" role="tooltip">Settings</span>
          </button>
          <div className="made-for"><Sparkles size={16} /><span>Made for<br /><strong>more good days</strong></span></div>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div>
            <span className="mobile-brand">Kindly</span>
            <p className="date-label">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1>{active === 'Home' ? `Hello${childName ? `, ${childName}'s grown-up` : ''}` : active}</h1>
          </div>
          <div className="top-actions">
            <div className="notification-wrap">
              <IconButton label="Notifications" onClick={() => setNotificationsOpen((open) => !open)}>
                <Bell size={20} />
                {openRequests.length > 0 && <b className="notification-dot" />}
              </IconButton>
              {notificationsOpen && (
                <div className="notification-popover" role="dialog" aria-label="Notifications">
                  <b>Notifications</b>
                  {openRequests.length > 0
                    ? openRequests.map((request) => (
                        <p key={request.id}>
                          {childName || 'Your child'} asked for: {request.need.replace(/_/g, ' ')} · {relativeTime(request.created_at)}
                        </p>
                      ))
                    : <p>You are all caught up.</p>}
                  <button className="text-button" onClick={() => setNotificationsOpen(false)}>Close</button>
                </div>
              )}
            </div>
            <button className="avatar large profile-trigger" aria-label="Open profile" onClick={() => setActive('Profile')}>
              {initial(childName)}
            </button>
          </div>
        </header>

        {active === 'Home' && (
          <HomeView
            child={child}
            childrenList={children.data}
            onSelectChild={children.selectChild}
            openChildMode={() => setChildMode(true)}
            setActive={setActive}
            requests={requests.data}
            stories={stories.data}
            situations={config?.situations ?? []}
            difficultyLevels={config?.difficulty_levels ?? []}
            onStoryCreated={stories.reload}
          />
        )}
        {active === 'Stories' && <StoriesView stories={stories} childName={childName} />}
        {active === 'Requests' && <RequestsView requests={requests} childName={childName} />}
        {active === 'Routines' && <RoutinesView />}
        {active === 'Profile' && <ProfileView child={child} />}
        {active === 'Settings' && <SettingsView />}
      </section>
    </main>
  )
}

// ---------------------------------------------------------------------------

function HomeView({
  child, childrenList, onSelectChild, openChildMode, setActive,
  requests, stories, situations, difficultyLevels, onStoryCreated,
}: {
  child: ChildProfile | null
  childrenList: ChildProfile[]
  onSelectChild: (id: string) => void
  openChildMode: () => void
  setActive: (view: string) => void
  requests: HelpRequest[]
  stories: Story[]
  situations: string[]
  difficultyLevels: string[]
  onStoryCreated: () => void
}) {
  const [situation, setSituation] = useState('')
  const [customSituation, setCustomSituation] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [tone, setTone] = useState('calm and supportive')
  const [story, setStory] = useState<Story | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const latest = requests[0] ?? null
  const childName = child?.name ?? ''

  // The backend requires at least 5 characters of situation text, so the
  // chosen chip and the free-text box are combined into one description.
  const description = [situation, customSituation.trim(), difficulty ? `This feels: ${difficulty}` : '']
    .filter(Boolean)
    .join('. ')

  const canGenerate = Boolean(child) && description.trim().length >= 5

  const generate = async () => {
    if (!child) return
    setBusy(true)
    setError(null)
    try {
      const created = await api.generateStory({
        child_id: child.id,
        situation: description,
        title: situation || 'A new social story',
        tone,
        length: 'short',
      })
      setStory(created)
      onStoryCreated()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not create the story.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="content-wrap">
      {childrenList.length > 1 && (
        <div className="child-switcher" role="group" aria-label="Choose a child">
          {childrenList.map((option) => (
            <button
              key={option.id}
              className={option.id === child?.id ? 'choice selected' : 'choice'}
              onClick={() => onSelectChild(option.id)}
              aria-pressed={option.id === child?.id}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}

      <div className="journey">
        <div className="journey-line" />
        <div className="journey-step done"><span><Check size={16} /></span><div><b>Prepare</b><small>Make a plan</small></div></div>
        <div className="journey-step current"><span>2</span><div><b>Communicate</b><small>Find the words</small></div></div>
        <div className="journey-step"><span>3</span><div><b>Connect</b><small>Feel understood</small></div></div>
      </div>

      <div className="hero-grid">
        <div className="welcome-card">
          <span className="eyebrow">TODAY&apos;S LITTLE WIN</span>
          <h2>Small steps count.</h2>
          <p>One prepared moment can make the whole day feel easier.</p>
          <button className="button coral" onClick={openChildMode}>Open child mode <ArrowRight size={17} /></button>
        </div>
        <div className="today-card">
          <div className="card-heading">
            <div><span className="eyebrow">MOST RECENT</span><h3>{latest ? latest.need.replace(/_/g, ' ') : 'No requests yet'}</h3></div>
            <IconButton label="More options"><MoreHorizontal size={19} /></IconButton>
          </div>
          {latest ? (
            <div className="routine-row">
              <div className="routine-icon yellow-bg">{NEED_ICON[latest.need]}</div>
              <div>
                <b>{statusLabel(latest)}</b>
                <small>{relativeTime(latest.created_at)}{latest.caregiver_message ? ` · ${latest.caregiver_message}` : ''}</small>
              </div>
              <button className="text-button" onClick={() => setActive('Requests')}>Open</button>
            </div>
          ) : (
            <div className="routine-row">
              <div className="routine-icon blue-bg">☁</div>
              <div>
                <b>All quiet</b>
                <small>{childName ? `When ${childName} asks for help, it will show here.` : 'Requests will show here.'}</small>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="section-title split">
        <div><span className="eyebrow">YOUR TOOLKIT</span><h2>What would help today?</h2></div>
        <button className="text-button" onClick={() => setActive('Stories')}>See all <ArrowRight size={16} /></button>
      </div>
      <div className="tool-grid">
        <a className="tool-card peach" href="/situations">
          <div className="tool-art">✦</div><b>Prepare for a situation</b><span>Make a simple plan together</span>
        </a>
        <button className="tool-card lavender" onClick={openChildMode}>
          <div className="tool-art">☁</div><b>Practice communication</b><span>Try words, pictures, or gestures</span>
        </button>
        <button className="tool-card mint" onClick={() => setActive('Routines')}>
          <div className="tool-art">☼</div><b>Build a routine</b><span>Make the next step clearer</span>
        </button>
      </div>

      <div id="prepare" className="prepare-layout">
        <div className="prepare-form">
          <SectionTitle
            eyebrow="PREPARE TOGETHER"
            title="A little planning can help a lot."
            detail="Choose a situation and Kindly will write a gentle practice story."
          />

          {situations.length > 0 && (
            <>
              <label>What are you getting ready for?</label>
              <div className="chip-wrap">
                {situations.map((item) => (
                  <button
                    key={item}
                    className={situation === item ? 'choice selected' : 'choice'}
                    onClick={() => setSituation(item)}
                    aria-pressed={situation === item}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </>
          )}

          <label htmlFor="situation-detail">Tell Kindly what happens</label>
          <textarea
            id="situation-detail"
            value={customSituation}
            onChange={(e) => setCustomSituation(e.target.value)}
            placeholder="e.g. We are going to the dentist on Thursday and the waiting room is usually loud."
          />

          {difficultyLevels.length > 0 && (
            <>
              <label>How new does this feel?</label>
              <div className="chip-wrap">
                {difficultyLevels.map((item) => (
                  <button
                    key={item}
                    className={difficulty === item ? 'choice selected' : 'choice'}
                    onClick={() => setDifficulty(item)}
                    aria-pressed={difficulty === item}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </>
          )}

          <label htmlFor="story-tone">Tone</label>
          <input id="story-tone" value={tone} onChange={(e) => setTone(e.target.value)} />

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="button yellow" onClick={generate} disabled={!canGenerate || busy}>
            {busy ? <><Loader2 size={17} className="spin" /> Writing…</> : <><Sparkles size={17} /> Make my story</>}
          </button>
          {!canGenerate && !busy && (
            <p className="field-hint">Add a sentence about what happens, then Kindly can write the story.</p>
          )}
        </div>

        <div className="story-preview">
          {story ? (
            <>
              <div className="preview-top">
                <span className="eyebrow">{childName ? `${childName.toUpperCase()}'S STORY` : 'NEW STORY'}</span>
                <button className="close-preview" onClick={() => setStory(null)} aria-label="Close story"><X size={17} /></button>
              </div>
              <div className="story-illustration">☀<span>✦</span></div>
              <h3>{story.title}</h3>
              <p className="story-body">{story.story}</p>
              {story.source === 'template' && (
                <p className="field-hint">
                  Written from Kindly&apos;s template — the AI service was unavailable or no key is configured.
                </p>
              )}
            </>
          ) : (
            <div className="empty-preview">
              <div className="preview-dots">✦</div>
              <h3>Your story will appear here</h3>
              <p>Describe the moment on the left, then make a story to practice together.</p>
            </div>
          )}
        </div>
      </div>

      <div className="recent-header">
        <SectionTitle eyebrow="STAY CONNECTED" title="Recent requests" />
        <button className="text-button" onClick={() => setActive('Requests')}>View requests <ArrowRight size={16} /></button>
      </div>
      {requests.slice(0, 3).map((request) => (
        <div className="request-card" key={request.id}>
          <div className="routine-icon yellow-bg">{NEED_ICON[request.need]}</div>
          <div>
            <b>{request.need.replace(/_/g, ' ')}</b>
            <p>{relativeTime(request.created_at)}{request.note ? ` · ${request.note}` : ''}</p>
          </div>
          <span className={isOpen(request) ? 'status waiting' : 'status quiet'}>{statusLabel(request)}</span>
        </div>
      ))}
      {requests.length === 0 && (
        <div className="request-card">
          <div className="routine-icon blue-bg">☁</div>
          <div>
            <b>No requests yet</b>
            <p>{childName ? `When ${childName} asks for help, it will show here.` : 'Requests will show here.'}</p>
          </div>
          <span className="status quiet">All quiet</span>
        </div>
      )}

      {stories.length > 0 && (
        <>
          <div className="recent-header">
            <SectionTitle eyebrow="LIBRARY" title="Recent stories" />
            <button className="text-button" onClick={() => setActive('Stories')}>See all <ArrowRight size={16} /></button>
          </div>
          <div className="story-list">
            {stories.slice(0, 3).map((item, index) => (
              <div className="story-row" key={item.id}>
                <div className={`story-thumb thumb-${index}`}>♡</div>
                <div><b>{item.title}</b><small>{relativeTime(item.created_at)}</small></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function ChildMode({
  child, requestTypes, onExit,
}: {
  child: ChildProfile
  requestTypes: FrontendConfig['request_types']
  onExit: () => void
}) {
  const [screen, setScreen] = useState<'home' | 'help' | 'sent'>('home')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const watched = useRequestWatch(screen === 'sent' ? requestId : null)

  const send = async (need: HelpRequestNeed) => {
    setBusy(true)
    setError(null)
    try {
      const created = await api.createHelpRequest({
        child_id: child.id,
        need,
        note: note.trim() || null,
      })
      setRequestId(created.id)
      setNote('')
      setScreen('sent')
    } catch (cause) {
      // Say plainly that it did not send. Implying a grown-up has seen it when
      // they have not is the one thing this screen must never do.
      setError(cause instanceof ApiError && cause.isOffline
        ? 'Your message did not send. Find a grown-up near you.'
        : 'Your message did not send. You can try again.')
    } finally {
      setBusy(false)
    }
  }

  const answered = watched?.caregiver_action ?? null
  const helperName = watched?.alternative_helper_name ?? null

  return (
    <main className="child-mode">
      <header className="child-top">
        <button className="child-exit" onClick={onExit}><ArrowLeft size={20} /> Adult View</button>
        <div className="child-avatar">{initial(child.name)}</div>
      </header>

      {screen === 'home' && (
        <div className="child-home">
          <div className="child-greeting">
            <span className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()}</span>
            <h1>Hi {child.name}!</h1>
            <p>What would you like to do?</p>
          </div>
          <div className="child-cards">
            <button className="child-card yellow-card"><span>☀</span><b>My day</b><small>See what&apos;s next</small></button>
            <button className="child-card blue-card"><span>☁</span><b>My stories</b><small>Practice together</small></button>
            <button className="child-card coral-card" onClick={() => setScreen('help')}>
              <span>♡</span><b>I need help</b><small>Ask for what you need</small>
            </button>
            <button className="child-card lavender-card"><span>◒</span><b>How I feel</b><small>Share my feelings</small></button>
          </div>
          <div className="child-footer">
            <span>Take your time.</span>
            <button className="skip-button">Help <CircleHelp size={16} /></button>
          </div>
        </div>
      )}

      {screen === 'help' && (
        <div className="help-screen">
          <button className="back-link" onClick={() => setScreen('home')}><ArrowLeft size={17} /> Back</button>
          <div className="child-greeting">
            <span className="eyebrow">I NEED HELP WITH…</span>
            <h1>What do you need?</h1>
            <p>Choose one. You can change your mind.</p>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="help-grid">
            {requestTypes.map((item) => (
              <button
                key={item.key}
                className={`help-card ${item.color}`}
                onClick={() => void send(item.key)}
                disabled={busy}
              >
                <span>{NEED_ICON[item.key] ?? '♡'}</span>
                <b>{item.label}</b>
                <small>{item.detail}</small>
              </button>
            ))}
          </div>

          <div className="child-note">
            <label htmlFor="child-note">Want to say more? <span className="field-optional">(optional)</span></label>
            <input
              id="child-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={250}
              placeholder="I can type it here"
            />
          </div>
        </div>
      )}

      {screen === 'sent' && (
        <div className="sent-screen">
          <div className="sent-icon">
            {answered === 'coming' ? <Check size={35} /> : answered === 'cannot_come' ? <CircleHelp size={35} /> : <Clock3 size={35} />}
          </div>
          <span className="eyebrow">
            {answered === 'coming' ? 'ON THE WAY' : answered === 'cannot_come' ? 'ASK SOMEONE ELSE' : answered === 'seen' ? 'SEEN' : 'REQUEST SENT'}
          </span>
          <h1 aria-live="polite">
            {answered === 'coming' ? 'Someone is coming.'
              : answered === 'cannot_come' ? (helperName ? `${helperName} can help.` : 'Find another grown-up.')
              : answered === 'seen' ? 'Your grown-up saw it.'
              : 'You asked for help.'}
          </h1>
          <p>
            {watched?.caregiver_message
              ? watched.caregiver_message
              : answered === 'coming' ? 'You are not alone. Take a slow breath while you wait.'
              : answered === 'cannot_come' ? 'They cannot come right now. You can ask the grown-up nearest to you.'
              : 'Your grown-up knows. You can wait here or go back.'}
          </p>
          <button className="button coral" onClick={() => { setScreen('home'); setRequestId(null) }}>
            Back to my day <ArrowRight size={17} />
          </button>
        </div>
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------

function StoriesView({ stories, childName }: { stories: ReturnType<typeof useStories>; childName: string }) {
  const [open, setOpen] = useState<Story | null>(null)
  const featured = stories.data[0] ?? null

  return (
    <div className="content-wrap">
      <SectionTitle
        eyebrow={childName ? `${childName.toUpperCase()}'S LIBRARY` : 'LIBRARY'}
        title="Stories for everyday moments"
        detail="Short, gentle ways to make unfamiliar moments feel more familiar."
      />

      {stories.loading && <p className="field-hint"><Loader2 size={15} className="spin" /> Loading stories…</p>}
      {stories.error && <p className="form-error" role="alert">{stories.error}</p>}

      {featured ? (
        <div className="library-hero">
          <div>
            <span className="eyebrow">MOST RECENT</span>
            <h2>{featured.title}</h2>
            <p>{featured.story.slice(0, 120)}…</p>
            <button className="button coral" onClick={() => setOpen(featured)}>
              <Play size={16} fill="currentColor" /> Read together
            </button>
          </div>
          <div className="large-art">☀</div>
        </div>
      ) : !stories.loading && (
        <div className="blank-state">
          <div className="blank-icon"><BookOpen size={25} /></div>
          <h3>No stories yet</h3>
          <p>Prepare for a situation on the Home page and Kindly will write the first one.</p>
        </div>
      )}

      <div className="story-list">
        {stories.data.slice(1).map((story, index) => (
          <button className="story-row" key={story.id} onClick={() => setOpen(story)}>
            <div className={`story-thumb thumb-${index % 3}`}>♡</div>
            <div><b>{story.title}</b><small>{relativeTime(story.created_at)} · {story.source === 'ai' ? 'AI written' : 'From a template'}</small></div>
            <ArrowRight size={17} />
          </button>
        ))}
      </div>

      {open && (
        <div className="story-reader" role="dialog" aria-label={open.title}>
          <div className="preview-top">
            <span className="eyebrow">STORY</span>
            <button className="close-preview" onClick={() => setOpen(null)} aria-label="Close story"><X size={17} /></button>
          </div>
          <h3>{open.title}</h3>
          <p className="story-body">{open.story}</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function RequestsView({ requests, childName }: { requests: ReturnType<typeof useHelpRequests>; childName: string }) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [helper, setHelper] = useState('')

  const respond = async (request: HelpRequest, action: CaregiverAction) => {
    setBusyId(request.id)
    setError(null)
    try {
      await api.respondToHelpRequest(request.id, {
        action,
        caregiver_message: message.trim() || null,
        alternative_helper_name: action === 'cannot_come' ? (helper.trim() || null) : null,
      })
      setMessage('')
      setHelper('')
      requests.reload()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not send your answer.')
    } finally {
      setBusyId(null)
    }
  }

  const open = requests.data.filter(isOpen)
  const closed = requests.data.filter((r) => !isOpen(r))

  return (
    <div className="content-wrap">
      <SectionTitle
        eyebrow="STAY CONNECTED"
        title="Requests"
        detail={childName ? `A calm place to notice what ${childName} is communicating.` : 'A calm place to notice what your child is communicating.'}
      />

      {error && <p className="form-error" role="alert">{error}</p>}

      {open.length === 0 && (
        <div className="blank-state">
          <div className="blank-icon"><MessageCircle size={25} /></div>
          <h3>All quiet for now</h3>
          <p>{childName ? `New requests from ${childName} will appear here.` : 'New requests will appear here.'}</p>
        </div>
      )}

      {open.map((request) => (
        <div className="inbox-card" key={request.id}>
          <div className="routine-icon yellow-bg">{NEED_ICON[request.need]}</div>
          <div className="inbox-main">
            <div className="inbox-title">
              <b>{childName || 'Your child'} needs help</b>
              <span className={request.is_urgent ? 'status waiting' : 'status quiet'}>
                {request.is_urgent ? 'Urgent' : statusLabel(request)}
              </span>
            </div>
            <h3>{request.need.replace(/_/g, ' ')}</h3>
            <p>{relativeTime(request.created_at)}{request.note ? ` · “${request.note}”` : ''}</p>

            <label htmlFor={`message-${request.id}`}>Add a message <span className="field-optional">(optional)</span></label>
            <input
              id={`message-${request.id}`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={250}
              placeholder="I'm on my way"
            />

            <div className="inbox-actions">
              <button className="button coral" disabled={busyId === request.id} onClick={() => void respond(request, 'coming')}>
                <Check size={16} /> I&apos;m coming
              </button>
              <button className="button secondary" disabled={busyId === request.id} onClick={() => void respond(request, 'seen')}>
                I&apos;ve seen it
              </button>
              <button className="button secondary" disabled={busyId === request.id} onClick={() => void respond(request, 'cannot_come')}>
                I can&apos;t come
              </button>
            </div>

            <label htmlFor={`helper-${request.id}`}>
              If you can&apos;t come, who can? <span className="field-optional">(optional)</span>
            </label>
            <input
              id={`helper-${request.id}`}
              value={helper}
              onChange={(e) => setHelper(e.target.value)}
              maxLength={100}
              placeholder="Name of another trusted grown-up"
            />
          </div>
        </div>
      ))}

      {closed.length > 0 && (
        <>
          <SectionTitle eyebrow="EARLIER" title="Answered" />
          <div className="story-list">
            {closed.map((request) => (
              <div className="story-row" key={request.id}>
                <div className="story-thumb">{NEED_ICON[request.need]}</div>
                <div>
                  <b>{request.need.replace(/_/g, ' ')}</b>
                  <small>{statusLabel(request)} · {relativeTime(request.updated_at)}{request.caregiver_message ? ` · “${request.caregiver_message}”` : ''}</small>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function RoutinesView() {
  return (
    <div className="content-wrap">
      <SectionTitle
        eyebrow="ROUTINES"
        title="A softer rhythm"
        detail="Create predictable routines that leave room for the day to change."
      />
      <div className="blank-state">
        <div className="blank-icon"><Clock3 size={25} /></div>
        <h3>Routines are not saved yet</h3>
        <p>
          The Kindly server does not have routine endpoints yet, so anything added here would be
          lost. See docs/INTEGRATION.md for the endpoints this screen is waiting on.
        </p>
        <a className="button secondary" href="/routines"><Plus size={17} /> Sketch a routine</a>
      </div>
    </div>
  )
}

function SettingsView() {
  const [health, setHealth] = useState<{ environment: string; ai_configured: boolean } | null>(null)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
  }, [])

  return (
    <div className="content-wrap">
      <SectionTitle
        eyebrow="YOUR SPACE"
        title="Settings"
        detail="Keep Kindly feeling calm, private, and useful for your family."
      />
      <div className="settings-list">
        <div className="settings-row">
          <div><b>Server</b><small>{health ? `Connected · ${health.environment}` : 'Not reachable'}</small></div>
          <span className={health ? 'status quiet' : 'status waiting'}>{health ? 'Online' : 'Offline'}</span>
        </div>
        <div className="settings-row">
          <div>
            <b>Story writing</b>
            <small>{health?.ai_configured ? 'An AI key is configured.' : 'No AI key — stories use Kindly’s template.'}</small>
          </div>
          <span className="status quiet">{health?.ai_configured ? 'AI' : 'Template'}</span>
        </div>
        <div className="settings-row">
          <div><b>Sign out</b><small>End this session on this device.</small></div>
          <button className="button secondary" onClick={() => { clearSession(); window.location.href = '/auth' }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileView({ child }: { child: ChildProfile | null }) {
  const sensory = useMemo(
    () => Object.entries(child?.sensory_sensitivities ?? {}).filter(([, level]) => level !== 'low'),
    [child],
  )

  if (!child) return <div className="content-wrap"><p>No child profile selected.</p></div>

  return (
    <div className="content-wrap">
      <SectionTitle
        eyebrow={`${child.name.toUpperCase()}'S PROFILE`}
        title={`What helps ${child.name} feel safe`}
        detail="These preferences are here to guide every little moment."
      />
      <div className="profile-card">
        <div className="profile-banner">
          <div className="avatar profile-avatar">{initial(child.name)}</div>
          <div>
            <h2>{child.name}</h2>
            <p>
              {[child.age ? `${child.age} years old` : null, child.preferred_pronouns, child.communication_level.replace(/-/g, ' ')]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <a className="button secondary" href="/onboarding">Add another child</a>
        </div>
        <div className="preference-grid">
          <div>
            <span className="eyebrow">SENSORY SENSITIVITIES</span>
            <h3>Stronger reactions</h3>
            <div className="preference-tags">
              {sensory.length > 0
                ? sensory.map(([key, level]) => <span key={key}>{key}: {level}</span>)
                : <span>Nothing marked above low</span>}
            </div>
          </div>
          <div>
            <span className="eyebrow">WHAT HELPS</span>
            <h3>Calming</h3>
            <div className="preference-tags">
              {child.calming_techniques.length > 0
                ? child.calming_techniques.map((item) => <span key={item}>{item}</span>)
                : <span>Nothing added yet</span>}
            </div>
          </div>
          {child.known_triggers.length > 0 && (
            <div>
              <span className="eyebrow">KNOWN TRIGGERS</span>
              <h3>Harder moments</h3>
              <div className="preference-tags">
                {child.known_triggers.map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>
          )}
          {child.favorite_activities.length > 0 && (
            <div>
              <span className="eyebrow">FAVOURITES</span>
              <h3>Things {child.name} enjoys</h3>
              <div className="preference-tags">
                {child.favorite_activities.map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
