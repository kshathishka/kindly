import type {
  AuthResponse, CaregiverResponseRequest, ChildProfile, ChildProfileInput, FrontendConfig,
  HelpRequest, HelpRequestCreate, SocialSkillScenario, Story, StoryRequest,
} from './api-types';

/**
 * The single place the frontend talks to the FastAPI backend.
 *
 * Every call goes through `request()` so error handling, JSON parsing and the
 * base URL live in one place. Nothing else in the app should call fetch().
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:8000';

/**
 * An error carrying the status code and the server's `detail` string.
 *
 * FastAPI returns validation problems as 422 with a structured `detail` array;
 * both shapes are flattened into a readable sentence here so screens can show
 * the real reason rather than "something went wrong".
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }

  /** True when the backend is unreachable rather than refusing the request. */
  get isOffline(): boolean {
    return this.status === 0;
  }
}

function readableDetail(detail: unknown, fallback: string): string {
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          const record = item as { msg?: unknown; loc?: unknown };
          const field = Array.isArray(record.loc) ? record.loc[record.loc.length - 1] : null;
          return field ? `${String(field)}: ${String(record.msg)}` : String(record.msg);
        }
        return null;
      })
      .filter((m): m is string => Boolean(m));
    if (messages.length) return messages.join('. ');
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
  } catch {
    // A network-level failure. The child-facing screens rely on this being
    // distinguishable from a rejection, so they can say "not sent" honestly
    // instead of implying a caregiver has seen the request.
    throw new ApiError(0, 'Could not reach the Kindly server. Check that the backend is running.');
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload
      ? (payload as { detail: unknown }).detail
      : payload;
    throw new ApiError(response.status, readableDetail(detail, `Request failed (${response.status}).`), detail);
  }

  return payload as T;
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const api = {
  health: () => request<{ status: string; environment: string; ai_configured: boolean }>('/health'),

  frontendConfig: () => request<FrontendConfig>('/api/v1/frontend-config'),

  socialSkillScenarios: () => request<SocialSkillScenario[]>('/api/v1/social-skills/scenarios'),

  // -- auth ----------------------------------------------------------------
  signup: (email: string, password: string, role: 'caregiver' | 'child' = 'caregiver') =>
    request<AuthResponse>('/api/v1/auth/signup', json({ email, password, role })),

  login: (email: string, password: string) =>
    request<AuthResponse>('/api/v1/auth/login', json({ email, password })),

  // -- children ------------------------------------------------------------
  listChildren: (caregiverId?: string) =>
    request<ChildProfile[]>(
      `/api/v1/children${caregiverId ? `?caregiver_id=${encodeURIComponent(caregiverId)}` : ''}`,
    ),

  getChild: (childId: string) => request<ChildProfile>(`/api/v1/children/${childId}`),

  createChild: (profile: ChildProfileInput) =>
    request<ChildProfile>('/api/v1/children', json(profile)),

  updateChild: (childId: string, profile: ChildProfile) =>
    request<ChildProfile>(`/api/v1/children/${childId}`, {
      method: 'PUT',
      body: JSON.stringify(profile),
    }),

  deleteChild: (childId: string) =>
    request<{ status: string; id: string }>(`/api/v1/children/${childId}`, { method: 'DELETE' }),

  // -- stories -------------------------------------------------------------
  generateStory: (input: StoryRequest) =>
    request<Story>('/api/v1/stories/generate', json(input)),

  storyHistory: (childId?: string) =>
    request<Story[]>(`/api/v1/stories/history${childId ? `?child_id=${encodeURIComponent(childId)}` : ''}`),

  getStory: (storyId: string) => request<Story>(`/api/v1/stories/${storyId}`),

  // -- help requests -------------------------------------------------------
  createHelpRequest: (input: HelpRequestCreate) =>
    request<HelpRequest>('/api/v1/help-requests', json(input)),

  listHelpRequests: (childId?: string) =>
    request<HelpRequest[]>(`/api/v1/help-requests${childId ? `?child_id=${encodeURIComponent(childId)}` : ''}`),

  getHelpRequest: (requestId: string) =>
    request<HelpRequest>(`/api/v1/help-requests/${requestId}`),

  respondToHelpRequest: (requestId: string, response: CaregiverResponseRequest) =>
    request<HelpRequest>(`/api/v1/help-requests/${requestId}/respond`, json(response)),
};
