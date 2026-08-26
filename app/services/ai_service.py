from __future__ import annotations

from typing import Any, Dict, Optional

from openai import OpenAI

from app.config import get_settings


class AIService:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        settings = get_settings()
        self.api_key = (api_key or settings.openai_api_key or "").strip()
        self.model = model or settings.openai_model
        self.client = OpenAI(api_key=self.api_key) if self.api_key else None
        self.enable_ai_generation = settings.enable_ai_generation
        self.fallback_to_template = settings.fallback_to_template

    def is_available(self) -> bool:
        return self.enable_ai_generation and self.client is not None

    def build_prompt(self, child: Dict[str, Any], situation: str, title: str, tone: str, length: str) -> str:
        sensory = child.get("sensory_sensitivities", {})
        sensory_summary = ", ".join(f"{key}:{value}" for key, value in sensory.items())

        known_triggers = ", ".join(child.get("known_triggers", [])) or "none specified"
        favorite_activities = ", ".join(child.get("favorite_activities", [])) or "none specified"
        calming_techniques = ", ".join(child.get("calming_techniques", ["deep breaths"])) or "deep breaths"

        return f"""
You are creating a social story for a child with autism.
Follow these rules:
- Keep the language level at {child.get('preferred_language', 'simple')}.
- Keep the tone {tone}.
- Keep the length {length}.
- Be warm, concrete, and respectful.
- Avoid shame, blame, or punishment.
- Focus on predictability, sensory awareness, and safe choices.
- Mention known triggers: {known_triggers}.
- Mention sensory sensitivities: {sensory_summary}.
- Mention favorite activities: {favorite_activities}.
- Include calming techniques: {calming_techniques}.
- Child profile: name={child.get('name')}, age={child.get('age')}, communication={child.get('communication_level')}.
- Situation: {situation}
- Title: {title}

Write the story with three short sections: what is happening, what I can do, and how I can feel safe.
"""

    def generate_story(self, child: Dict[str, Any], situation: str, title: str, tone: str, length: str) -> Dict[str, Any]:
        prompt = self.build_prompt(child, situation, title, tone, length)

        if not self.is_available():
            return self._fallback_story(child, situation, title, tone, length, prompt)

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You create autism-supportive social stories that are clear, respectful, and encouraging."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=600,
            )
            content = response.choices[0].message.content
            if not content or not content.strip():
                raise ValueError("AI response was empty")

            return {
                "story": content.strip(),
                "source": "ai",
                "provider": "openai",
                "prompt_summary": prompt[:180],
            }
        except Exception:
            if self.fallback_to_template:
                return self._fallback_story(child, situation, title, tone, length, prompt)
            raise

    def _fallback_story(self, child: Dict[str, Any], situation: str, title: str, tone: str, length: str, prompt: str) -> Dict[str, Any]:
        child_name = child.get("name", "friend")
        calming = ", ".join(child.get("calming_techniques", ["deep breaths"])) or "deep breaths"
        pronouns = child.get("preferred_pronouns") or "they/them"

        story = (
            f"{title or 'A Social Story'}\n\n"
            f"{child_name} is having a moment when {situation}. "
            f"This can feel big and overwhelming, and it is okay to take a pause. "
            f"When {pronouns} notices the feeling growing, {child_name} can use {calming}. "
            f"{child_name} can ask for help, move to a quieter space, or take a break. "
            f"{child_name} is safe, supported, and learning what helps. "
            f"The adults around {pronouns} can stay calm and kind. "
            f"Together, they can make a plan to feel more comfortable and ready for the next step."
        )

        return {
            "story": story,
            "source": "template",
            "provider": "fallback",
            "prompt_summary": prompt[:180],
        }
