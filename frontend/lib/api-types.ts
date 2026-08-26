/**
 * TypeScript mirrors of the Pydantic models in app/models/common.py.
 *
 * These are hand-written rather than generated, so when a model changes on the
 * Python side the corresponding type here has to change with it. The FastAPI
 * app publishes an OpenAPI schema at /openapi.json if you would rather generate
 * them later.
 */

export type CommunicationLevel = 'pre-verbal' | 'simple-sentences' | 'conversational' | 'advanced';
export type PreferredLanguage = 'simple' | 'moderate' | 'detailed';
export type SensoryLevel = 'low' | 'medium' | 'high';

/** The six sensory channels the backend validator requires. All must be present. */
export type SensoryKey = 'sound' | 'light' | 'touch' | 'smell' | 'crowds' | 'texture';
export type SensorySensitivities = Record<SensoryKey, SensoryLevel>;

export const SENSORY_KEYS: readonly SensoryKey[] = ['sound', 'light', 'touch', 'smell', 'crowds', 'texture'];

export interface ChildProfile {
  id: string;
  /** The caregiver account that owns this profile. */
  caregiver_id: string | null;
  name: string;
  age: number | null;
  communication_level: CommunicationLevel;
  special_interests: string[];
  sensory_sensitivities: SensorySensitivities;
  preferred_language: PreferredLanguage;
  known_triggers: string[];
  favorite_activities: string[];
  calming_techniques: string[];
  preferred_pronouns: string | null;
  created_at: string;
  updated_at: string;
  story_count: number;
}

/** POST /api/v1/children takes a whole ChildProfile; the server fills the rest. */
export type ChildProfileInput = Partial<ChildProfile> & {
  name: string;
  communication_level: CommunicationLevel;
};

export type HelpRequestNeed =
  | 'bathroom' | 'break' | 'too_loud' | 'uncomfortable'
  | 'need_caregiver' | 'lost' | 'something_hurts';

export type HelpRequestStatus =
  | 'sent' | 'caregiver_seen' | 'caregiver_responded'
  | 'caregiver_coming' | 'caregiver_unavailable';

export type CaregiverAction = 'coming' | 'seen' | 'cannot_come';

export interface HelpRequest {
  id: string;
  child_id: string;
  caregiver_id: string | null;
  need: HelpRequestNeed;
  note: string | null;
  is_urgent: boolean;
  status: HelpRequestStatus;
  caregiver_action: CaregiverAction | null;
  caregiver_message: string | null;
  alternative_helper_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface HelpRequestCreate {
  child_id: string;
  need: HelpRequestNeed;
  caregiver_id?: string | null;
  note?: string | null;
}

export interface CaregiverResponseRequest {
  action: CaregiverAction;
  caregiver_message?: string | null;
  alternative_helper_name?: string | null;
}

export interface Story {
  id: string;
  child_id: string;
  title: string;
  story: string;
  tone: string;
  length: string;
  created_at: string;
  /** 'ai' when OpenAI produced it, 'template' when the server fell back. */
  source: string;
  prompt_summary: string | null;
}

export interface StoryRequest {
  child_id: string;
  /** The backend enforces a 5-character minimum. */
  situation: string;
  title?: string | null;
  tone?: string;
  length?: string;
}

export interface AuthResponse {
  id: string;
  email: string;
  role: string;
  token: string;
}

export interface SocialSkillOption {
  id: string;
  label: string;
  feedback: string;
}

export interface SocialSkillScenario {
  id: string;
  title: string;
  prompt: string;
  options: SocialSkillOption[];
}

export interface FrontendConfig {
  situations: string[];
  formats: string[];
  request_types: { key: HelpRequestNeed; label: string; detail: string; color: string }[];
  difficulty_levels: string[];
  default_child_name: string;
}

/** The two needs app/main.py escalates automatically on arrival. */
export const URGENT_NEEDS: readonly HelpRequestNeed[] = ['lost', 'something_hurts'];

export function isUrgentNeed(need: HelpRequestNeed): boolean {
  return URGENT_NEEDS.includes(need);
}
