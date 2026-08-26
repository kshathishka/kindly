const API_BASE = "http://127.0.0.1:8000";
const AUTH_KEY = "kindly-auth";

const state = {
  children: [],
  frontendConfig: null,
  requests: [],
  selectedNeed: null,
  selectedScenarioId: null,
  scenarios: [],
  auth: null,
  appInitialized: false,
};

const authShellEl = document.getElementById("authShell");
const appShellEl = document.getElementById("appShell");

const loginViewEl = document.getElementById("loginView");
const signupViewEl = document.getElementById("signupView");
const loginFormEl = document.getElementById("loginForm");
const signupFormEl = document.getElementById("signupForm");
const authMessageEl = document.getElementById("authMessage");
const signupMessageEl = document.getElementById("signupMessage");
const logoutButtonEl = document.getElementById("logoutButton");
const userBadgeEl = document.getElementById("userBadge");

const tabButtons = document.querySelectorAll(".tab-button");
const panels = document.querySelectorAll(".panel");

const healthStatusEl = document.getElementById("healthStatus");
const childSelectEl = document.getElementById("childSelect");
const storyChildSelectEl = document.getElementById("storyChildSelect");
const requestButtonsEl = document.getElementById("requestButtons");
const requestConfirmEl = document.getElementById("requestConfirm");
const childRequestStatusEl = document.getElementById("childRequestStatus");
const caregiverRequestsEl = document.getElementById("caregiverRequests");
const scenarioListEl = document.getElementById("scenarioList");
const scenarioDetailEl = document.getElementById("scenarioDetail");
const storyFormEl = document.getElementById("storyForm");
const storyOutputEl = document.getElementById("storyOutput");
const situationSelectEl = document.getElementById("situationSelect");
const situationInputEl = document.getElementById("situationInput");

const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    let details = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body.detail) {
        details = body.detail;
      }
    } catch {
      // Ignore parse failures and fallback to status text.
    }
    throw new Error(details);
  }
  return response.json();
}

function loadAuthState() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    state.auth = raw ? JSON.parse(raw) : null;
  } catch {
    state.auth = null;
  }
}

function saveAuthState(authPayload) {
  state.auth = authPayload;
  localStorage.setItem(AUTH_KEY, JSON.stringify(authPayload));
}

function clearAuthState() {
  state.auth = null;
  localStorage.removeItem(AUTH_KEY);
}

function setMessage(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle("error", isError);
}

function routeTo(path) {
  if (window.location.hash !== path) {
    window.location.hash = path;
  }
}

function showAuthView(mode) {
  authShellEl.classList.remove("hidden");
  appShellEl.classList.add("hidden");

  const showLogin = mode !== "signup";
  loginViewEl.classList.toggle("hidden", !showLogin);
  signupViewEl.classList.toggle("hidden", showLogin);
}

function showAppView() {
  authShellEl.classList.add("hidden");
  appShellEl.classList.remove("hidden");
  if (state.auth?.email) {
    userBadgeEl.textContent = `${state.auth.email} (${state.auth.role})`;
  }
}

function getRoute() {
  return window.location.hash || "#/login";
}

function guardRoute() {
  const route = getRoute();
  const isAuthed = Boolean(state.auth?.token);

  if (!isAuthed && route === "#/app") {
    routeTo("#/login");
    return;
  }
  if (isAuthed && (route === "#/login" || route === "#/signup" || route === "#" || route === "")) {
    routeTo("#/app");
  }
}

function renderRoute() {
  guardRoute();
  const route = getRoute();
  const isAuthed = Boolean(state.auth?.token);

  if (!isAuthed) {
    if (route === "#/signup") {
      showAuthView("signup");
    } else {
      showAuthView("login");
    }
    return;
  }

  showAppView();
  if (!state.appInitialized) {
    initApp();
  }
}

function switchTab(targetId) {
  tabButtons.forEach((button) => {
    const active = button.dataset.tab === targetId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  panels.forEach((panel) => panel.classList.toggle("active", panel.id === targetId));
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

loginFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(authMessageEl, "Signing in...");

  const payload = {
    email: document.getElementById("loginEmail").value.trim(),
    password: document.getElementById("loginPassword").value,
  };

  try {
    const auth = await api("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    saveAuthState(auth);
    setMessage(authMessageEl, "Sign in successful.");
    routeTo("#/app");
  } catch (error) {
    setMessage(authMessageEl, `Sign in failed: ${error.message}`, true);
  }
});

signupFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(signupMessageEl, "Creating account...");

  const payload = {
    email: document.getElementById("signupEmail").value.trim(),
    password: document.getElementById("signupPassword").value,
    role: document.getElementById("signupRole").value,
  };

  try {
    const auth = await api("/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    saveAuthState(auth);
    setMessage(signupMessageEl, "Account created.");
    routeTo("#/app");
  } catch (error) {
    setMessage(signupMessageEl, `Signup failed: ${error.message}`, true);
  }
});

logoutButtonEl.addEventListener("click", () => {
  clearAuthState();
  state.appInitialized = false;
  routeTo("#/login");
});

window.addEventListener("hashchange", renderRoute);

function renderChildSelectors() {
  const options = state.children
    .map((child) => `<option value="${child.id}">${escapeHtml(child.name)} (${escapeHtml(child.communication_level)})</option>`)
    .join("");

  childSelectEl.innerHTML = options;
  storyChildSelectEl.innerHTML = options;
}

function renderRequestButtons() {
  if (!state.frontendConfig) {
    return;
  }
  requestButtonsEl.innerHTML = state.frontendConfig.request_types
    .map(
      (requestType) => `
      <button
        class="request-card"
        data-need="${requestType.key}"
        style="--accent:${requestType.color};"
      >
        <strong>${escapeHtml(requestType.label)}</strong>
        <span>${escapeHtml(requestType.detail)}</span>
      </button>
    `
    )
    .join("");

  requestButtonsEl.querySelectorAll(".request-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedNeed = button.dataset.need;
      const selectedConfig = state.frontendConfig.request_types.find((type) => type.key === state.selectedNeed);
      const needsImmediate = state.selectedNeed === "lost" || state.selectedNeed === "something_hurts";
      requestConfirmEl.innerHTML = `
        <p>
          ${needsImmediate ? "This is urgent. Send request immediately?" : "Do you want to tell your caregiver now?"}
        </p>
        <div class="action-row">
          <button id="confirmSend" class="primary">Yes, tell them</button>
          <button id="confirmBack" class="secondary">Go back</button>
        </div>
        <p class="muted">Selected: ${escapeHtml(selectedConfig.label)}</p>
      `;

      document.getElementById("confirmSend").addEventListener("click", submitHelpRequest);
      document.getElementById("confirmBack").addEventListener("click", () => {
        requestConfirmEl.innerHTML = "";
      });
    });
  });
}

function renderCaregiverRequests() {
  if (!state.requests.length) {
    caregiverRequestsEl.innerHTML = "<p class=\"muted\">No help requests yet.</p>";
    return;
  }

  caregiverRequestsEl.innerHTML = state.requests
    .slice()
    .reverse()
    .map((request) => {
      const child = state.children.find((item) => item.id === request.child_id);
      const childName = child ? child.name : "Unknown child";
      return `
        <article class="request-item">
          <div>
            <h3>${escapeHtml(childName)} needs help: ${escapeHtml(request.need.replaceAll("_", " "))}</h3>
            <p>Status: <strong>${escapeHtml(request.status.replaceAll("_", " "))}</strong></p>
            ${request.note ? `<p>Child note: ${escapeHtml(request.note)}</p>` : ""}
            ${request.caregiver_message ? `<p>Caregiver message: ${escapeHtml(request.caregiver_message)}</p>` : ""}
            ${request.alternative_helper_name ? `<p>Alternative helper: ${escapeHtml(request.alternative_helper_name)}</p>` : ""}
          </div>
          <div class="action-row">
            <button data-action="coming" data-id="${request.id}" class="primary small">I'm coming</button>
            <button data-action="seen" data-id="${request.id}" class="secondary small">I've seen this</button>
            <button data-action="cannot_come" data-id="${request.id}" class="secondary small">I can't come</button>
          </div>
        </article>
      `;
    })
    .join("");

  caregiverRequestsEl.querySelectorAll("button[data-id]").forEach((button) => {
    button.addEventListener("click", () => respondToRequest(button.dataset.id, button.dataset.action));
  });
}

function renderScenarios() {
  if (!state.scenarios.length) {
    scenarioListEl.innerHTML = "<p class=\"muted\">No scenarios found.</p>";
    scenarioDetailEl.innerHTML = "";
    return;
  }

  scenarioListEl.innerHTML = state.scenarios
    .map(
      (scenario) => `
      <button class="scenario-item ${state.selectedScenarioId === scenario.id ? "selected" : ""}" data-id="${scenario.id}">
        ${escapeHtml(scenario.title)}
      </button>
    `
    )
    .join("");

  scenarioListEl.querySelectorAll(".scenario-item").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedScenarioId = button.dataset.id;
      renderScenarios();
    });
  });

  const activeScenario = state.scenarios.find((scenario) => scenario.id === state.selectedScenarioId) || state.scenarios[0];
  state.selectedScenarioId = activeScenario.id;

  scenarioDetailEl.innerHTML = `
    <h3>${escapeHtml(activeScenario.title)}</h3>
    <p>${escapeHtml(activeScenario.prompt)}</p>
    <div class="scenario-options">
      ${activeScenario.options
        .map(
          (option) => `
          <button class="scenario-option" data-feedback="${escapeHtml(option.feedback)}">
            ${escapeHtml(option.label)}
          </button>
        `
        )
        .join("")}
    </div>
    <div id="scenarioFeedback" class="feedback-box">Choose an option to see a supportive response.</div>
  `;

  scenarioDetailEl.querySelectorAll(".scenario-option").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("scenarioFeedback").textContent = button.dataset.feedback;
    });
  });
}

function renderSituationOptions() {
  if (!state.frontendConfig) {
    return;
  }
  situationSelectEl.innerHTML = state.frontendConfig.situations
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join("");

  situationSelectEl.addEventListener("change", () => {
    if (!situationInputEl.value.trim()) {
      situationInputEl.value = situationSelectEl.value;
    }
  });
}

async function submitHelpRequest() {
  try {
    const payload = {
      child_id: childSelectEl.value,
      need: state.selectedNeed,
    };
    const response = await api("/api/v1/help-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    childRequestStatusEl.innerHTML = `
      <p>Message sent. Status: <strong>${escapeHtml(response.status.replaceAll("_", " "))}</strong></p>
      <p>${response.is_urgent ? "Urgent request was auto-acknowledged." : "Waiting for caregiver response..."}</p>
    `;
    requestConfirmEl.innerHTML = "";
    await loadRequests();
  } catch (error) {
    childRequestStatusEl.innerHTML = `<p class="error">Could not send request: ${escapeHtml(error.message)}</p>`;
  }
}

async function respondToRequest(requestId, action) {
  let caregiver_message = "Acknowledged";
  let alternative_helper_name = null;

  if (action === "coming") {
    caregiver_message = "I am coming to help you.";
  }
  if (action === "cannot_come") {
    caregiver_message = "I cannot come right now.";
    alternative_helper_name = prompt("Approved alternative helper name:", "Ms. Sarah") || "Ms. Sarah";
  }

  try {
    await api(`/api/v1/help-requests/${requestId}/respond`, {
      method: "POST",
      body: JSON.stringify({ action, caregiver_message, alternative_helper_name }),
    });
    await loadRequests();
  } catch (error) {
    caregiverRequestsEl.insertAdjacentHTML("afterbegin", `<p class="error">${escapeHtml(error.message)}</p>`);
  }
}

storyFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  storyOutputEl.innerHTML = "<p class=\"muted\">Generating story...</p>";

  try {
    const payload = {
      child_id: storyChildSelectEl.value,
      situation: situationInputEl.value.trim(),
      title: document.getElementById("storyTitle").value.trim() || "A New Social Story",
      tone: document.getElementById("toneInput").value.trim() || "calm and supportive",
      length: document.getElementById("lengthSelect").value,
    };

    const story = await api("/api/v1/stories/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    storyOutputEl.innerHTML = `
      <h3>${escapeHtml(story.title)}</h3>
      <p class="muted">Source: ${escapeHtml(story.source)}</p>
      <pre>${escapeHtml(story.story)}</pre>
    `;
  } catch (error) {
    storyOutputEl.innerHTML = `<p class="error">Could not generate story: ${escapeHtml(error.message)}</p>`;
  }
});

async function loadHealth() {
  try {
    const health = await api("/health");
    healthStatusEl.textContent = `Backend: ${health.status} | Environment: ${health.environment} | AI configured: ${health.ai_configured ? "yes" : "no"}`;
  } catch (error) {
    healthStatusEl.textContent = `Backend connection failed: ${error.message}`;
    healthStatusEl.classList.add("error");
  }
}

async function loadChildren() {
  state.children = await api("/api/v1/children");
  if (!state.children.length) {
    throw new Error("No child profiles exist yet. Create one from backend API first.");
  }
  renderChildSelectors();
}

async function loadConfig() {
  state.frontendConfig = await api("/api/v1/frontend-config");
  renderRequestButtons();
  renderSituationOptions();
}

async function loadRequests() {
  state.requests = await api("/api/v1/help-requests");
  renderCaregiverRequests();

  const childId = childSelectEl.value;
  const childRequests = state.requests.filter((request) => request.child_id === childId);
  const latest = childRequests[childRequests.length - 1];
  if (latest) {
    childRequestStatusEl.innerHTML = `<p>Latest request status: <strong>${escapeHtml(latest.status.replaceAll("_", " "))}</strong></p>`;
  }
}

async function loadScenarios() {
  state.scenarios = await api("/api/v1/social-skills/scenarios");
  state.selectedScenarioId = state.scenarios[0]?.id ?? null;
  renderScenarios();
}

async function init() {
  loadAuthState();
  renderRoute();
}

async function initApp() {
  state.appInitialized = true;
  await loadHealth();
  try {
    await Promise.all([loadChildren(), loadConfig(), loadRequests(), loadScenarios()]);
  } catch (error) {
    healthStatusEl.textContent = `Initialization warning: ${error.message}`;
    healthStatusEl.classList.add("error");
  }
}

init();
