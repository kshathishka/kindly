import json
from typing import Any, Dict

import requests
import streamlit as st

API_BASE = "http://localhost:8000/api/v1"

st.set_page_config(page_title="StoryBridge AI", page_icon="📖")
st.title("StoryBridge AI Demo")

if "children" not in st.session_state:
    try:
        response = requests.get(f"{API_BASE}/children", timeout=5)
        st.session_state["children"] = response.json() if response.ok else []
    except Exception:
        st.session_state["children"] = []

with st.sidebar:
    st.header("Child profile")
    with st.form("profile_form"):
        name = st.text_input("Name")
        age = st.number_input("Age", min_value=1, max_value=18, value=6)
        communication_level = st.selectbox(
            "Communication level",
            ["pre-verbal", "simple-sentences", "conversational", "advanced"],
        )
        language = st.selectbox("Preferred language", ["simple", "moderate", "detailed"])
        interests = st.text_input("Special interests (comma separated)")
        triggers = st.text_input("Known triggers (comma separated)")
        calming = st.text_input("Calming techniques (comma separated)")
        submitted = st.form_submit_button("Save profile")

        if submitted:
            profile = {
                "name": name,
                "age": int(age),
                "communication_level": communication_level,
                "special_interests": [item.strip() for item in interests.split(",") if item.strip()],
                "sensory_sensitivities": {
                    "sound": "medium",
                    "light": "low",
                    "touch": "medium",
                    "smell": "low",
                    "crowds": "medium",
                    "texture": "low",
                },
                "preferred_language": language,
                "known_triggers": [item.strip() for item in triggers.split(",") if item.strip()],
                "favorite_activities": [],
                "calming_techniques": [item.strip() for item in calming.split(",") if item.strip()],
            }
            response = requests.post(f"{API_BASE}/children", json=profile, timeout=10)
            if response.ok:
                st.success("Profile saved")
                st.session_state["children"] = requests.get(f"{API_BASE}/children", timeout=5).json()
            else:
                st.error(response.text)

if not st.session_state["children"]:
    st.info("Create a child profile to generate a story.")
else:
    child_options = {child["name"]: child for child in st.session_state["children"]}
    child_name = st.selectbox("Select child", list(child_options.keys()))
    child = child_options[child_name]

    st.subheader(f"Story for {child['name']}")
    with st.form("story_form"):
        situation = st.text_area("Situation description")
        title = st.text_input("Story title")
        tone = st.selectbox("Tone", ["calm and supportive", "gentle and explanatory", "encouraging and positive"])
        length = st.selectbox("Length", ["short", "medium", "detailed"])
        generate = st.form_submit_button("Generate story")

        if generate:
            payload = {
                "child_id": child["id"],
                "situation": situation,
                "title": title or "A new social story",
                "tone": tone,
                "length": length,
            }
            response = requests.post(f"{API_BASE}/stories/generate", json=payload, timeout=20)
            if response.ok:
                story = response.json()
                st.success("Story generated")
                st.write(story["story"])
            else:
                st.error(response.text)
