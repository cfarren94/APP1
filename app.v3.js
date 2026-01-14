// APP V4 — fixes: missing exhibit handling, status filter, choose detection, 2-sentence explanations, weak-area tracking
console.log("Loaded APP.V4 2026-01-14");

const DOMAINS = [
  { name: "Security Concepts", file: "data/security_concepts.json" },
  { name: "Network Security", file: "data/network_security.json" },
  { name: "Securing the Cloud", file: "data/securing_the_cloud.json" },
  { name: "Content Security", file: "data/content_security.json" },
  { name: "Endpoint Protection and Detection", file: "data/endpoint_protection_and_detection.json" },
  { name: "Secure Network Access, Visibility, and Enforcement", file: "data/secure_network_access_visibility_and_enforcement.json" }
];

const el = (id) => document.getElementById(id);

const setupSec = el("setup");
const quizSec = el("quiz");
const resultsSec = el("results");

const domainSelect = el("domainSelect");
const countSelect = el("countSelect");
const setupNote = el("setupNote");

const startBtn = el("startBtn");
const quitBtn = el("quitBtn");
const restartBtn = el("restartBtn");

const progress = el("progress");
const qTitle = el("qTitle");
const qText = el("qText");
const qHint = el("qHint");
const exhibitBox = el("exhibitBox");
const optionsForm = el("optionsForm");

const backBtn = el("backBtn");
const submitBtn = el("submitBtn");
const nextBtn = el("nextBtn");
const feedback = el("feedback");
const explanation = el("explanation");

const scoreLine = el("scoreLine");
const metaLine = el("metaLine");
const weakAreas = el("weakAreas");
const review = el("review");

let exam = [];
let currentIndex = 0;
let score = 0;
let incorrect = [];
let answers = [];

let skippedMissingExhibit = 0;

// Weak areas tracked within this run
let weakCounts = {}; // { domainName: wrongCount }

function show(section) {
  setupSec.classList.add("hidden");
  quizSec.classList.add("hidden");
  resultsSec.classList.add("hidden");
  section.classList.remove("hidden");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normaliseLetters(arr) {
  return [...new Set((arr || []).map(x => String(x).trim().toUpperCase()))]
    .filter(x => /^[A-Z]$/.test(x))
    .sort();
}

function isExactMatch(a, b) {
  const aa = normaliseLetters(a);
  const bb = normaliseLetters(b);
  return aa.length === bb.length && aa.join(",") === bb.join(",");
}

function capTwoSentences(text = "") {
  const s = String(text || "").trim();
  if (!s) return "";
  const parts = s.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, 2).join(" ").trim();
}

function parseChooseFromText(qText) {
  const t = String(qText || "");
  const m = t.match(/choose\s+(two|three|four|\d+)/i);
  if (!m) return null;
  const map = { two: 2, three: 3, four: 4 };
  const key = String(m[1]).toLowerCase();
  if (map[key]) return map[key];
  const n = parseInt(key, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function requiredCount(q) {
  let c = Number(q.choose);
  if (!Number.isFinite(c) || c < 1) {
    c = parseChooseFromText(q.question) ?? parseChooseFromText(q.question_display) ?? null;
  }
  if (!Number.isFinite(c) || c < 1) {
    const corrLen = Array.isArray(q.correct) ? q.correct.length : 0;
    c = corrLen > 0 ? corrLen : 1;
  }

  const optCount = Object.keys(q.options || {}).length || 0;
  if (optCount > 0) c = Math.min(c, optCount);
  return Math.max(1, c);
}

function isMissingExhibit(q) {
  const text = String(q.question_display || q.question || "");
  const saysExhibit = /refer to the exhibit/i.test(text);
  const hasExhibit = String(q.exhibit || "").trim().length > 0;
  return saysExhibit && !hasExhibit;
}

function normaliseQuestion(raw, domainName) {
  const qText = raw.question_display || raw.question || "(Question text missing)";
  const options = raw.options || {};
  const correct = Array.isArray(raw.correct) ? raw.correct : normaliseLetters(raw.correct);
  const choose = raw.choose;
  const status = raw.status || "valid";
  const exhibit = raw.exhibit || "";

  return {
    ...raw,
    domain: raw.domain || domainName,
    question: qText,
    options,
    correct: normaliseLetters(correct),
    choose,
    status,
    exhibit,
    explanation: capTwoSentences(raw.explanation || "")
  };
}

async function loadDomain(domain) {
  const res = await fetch(domain.file, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${domain.file}`);
  const data = await res.json();

  const normalised = (data || []).map(q => normaliseQuestion(q, domain.name));

  // Exam mode: ONLY valid questions
  const validOnly = normalised.filter(q => String(q.status).toLowerCase() === "valid");

  // Remove missing-exhibit questions
  const filtered = [];
  skippedMissingExhibit = 0;
  for (const q of validOnly) {
    if (isMissingExhibit(q)) {
      skippedMissingExhibit++;
      continue;
    }
    filtered.push(q);
  }

  return filtered;
}

function getSelected() {
  return [...optionsForm.querySelectorAll("input:checked")].map(i => i.value);
}

function setFeedback(type, msg) {
  feedback.className = `feedback ${type || ""}`.trim();
  feedback.textContent = msg || "";
}

function renderQuestion() {
  const q = exam[currentIndex];
  const state = answers[currentIndex];
  const req = requiredCount(q);

  progress.textContent = `Question ${currentIndex + 1} of ${exam.length} • Score ${score}`;
  qTitle.textContent = `Question ${currentIndex + 1}`;
  qText.textContent = q.question;
  qHint.textContent = req === 1 ? "Choose one answer." : `Choose ${req} answers.`;

  // Exhibit display (only if provided)
  const ex = String(q.exhibit || "").trim();
  if (ex) {
    exhibitBox.classList.remove("hidden");
    exhibitBox.textContent = ex;
  } else {
    exhibitBox.classList.add("hidden");
    exhibitBox.textContent = "";
  }

  optionsForm.innerHTML = "";
  explanation.textContent = "";
  setFeedback("", "");

  const type = req === 1 ? "radio" : "checkbox";
  const nameAttr = req === 1 ? 'name="single"' : "";

  const letters = Object.keys(q.options || {}).sort();
  for (const letter of letters) {
    const checked = state.selected.includes(letter) ? "checked" : "";
    optionsForm.innerHTML += `
      <div class="option">
        <input type="${type}" value="${escapeHtml(letter)}" ${nameAttr} ${checked}>
        <label><b>${escapeHtml(letter)})</b> ${escapeHtml(q.options[letter])}</label>
      </div>
    `;
  }

  // Multi-select: prevent selecting more than required
  if (req > 1) {
    const inputs = [...optionsForm.querySelectorAll('input[type="checkbox"]')];
    inputs.forEach(inp => {
      inp.addEventListener("change", () => {
        const picked = inputs.filter(x => x.checked).length;
        if (picked > req) inp.checked = false;
      });
    });
  }

  submitBtn.classList.toggle("hidden", state.submitted);
  nextBtn.classList.toggle("hidden", !state.submitted);
  backBtn.disabled = currentIndex === 0;

  if (state.submitted) {
    const ok = isExactMatch(state.selected, q.correct || []);
    setFeedback(ok ? "ok" : "bad", ok
      ? "Correct ✅"
      : `Incorrect ❌   Correct answer: ${normaliseLetters(q.correct || []).join(", ") || "—"}`);

    explanation.textContent = q.explanation ? `Explanation: ${q.explanation}` : "";
  }
}

function submitAnswer() {
  const q = exam[currentIndex];
  const req = requiredCount(q);
  const selected = getSelected();

  // Save picks for Back/Next
  answers[currentIndex] = { selected, submitted: false };

  if (selected.length !== req) {
    setFeedback("warn", `Select exactly ${req} answer${req === 1 ? "" : "s"} before submitting.`);
    return;
  }

  answers[currentIndex].submitted = true;

  if (isExactMatch(selected, q.correct || [])) {
    score++;
  } else {
    incorrect.push({
      number: currentIndex + 1,
      domain: q.domain || "Unknown",
      question: q.question || "",
      your: normaliseLetters(selected).join(", ") || "—",
      correct: normaliseLetters(q.correct || []).join(", ") || "—",
      explanation: q.explanation || ""
    });

    const d = q.domain || "Unknown";
    weakCounts[d] = (weakCounts[d] || 0) + 1;
  }

  renderQuestion();
}

function nextQuestion() {
  if (++currentIndex >= exam.length) return showResults();
  renderQuestion();
}

function prevQuestion() {
  if (currentIndex > 0) currentIndex--;
  renderQuestion();
}

function showResults() {
  show(resultsSec);

  scoreLine.textContent = `Score: ${score} / ${exam.length}`;
  metaLine.textContent = skippedMissingExhibit
    ? `Skipped ${skippedMissingExhibit} question(s) due to missing exhibit.`
    : "";

  const entries = Object.entries(weakCounts).sort((a, b) => b[1] - a[1]);
  weakAreas.innerHTML = entries.length
    ? entries.map(([d, c]) => `<p>${escapeHtml(d)}: <b>${c}</b> incorrect</p>`).join("")
    : "<p>None 🎉</p>";

  review.innerHTML = incorrect.length
    ? incorrect.map(x => `
        <div class="reviewItem">
          <p><b>Q${x.number}</b> <span class="hint">(${escapeHtml(x.domain)})</span></p>
          <p>${escapeHtml(x.question)}</p>
          <p><b>Your answer:</b> ${escapeHtml(x.your)}</p>
          <p><b>Correct answer:</b> ${escapeHtml(x.correct)}</p>
          ${x.explanation ? `<p><b>Explanation:</b> ${escapeHtml(x.explanation)}</p>` : ""}
        </div>
      `).join("")
    : "<p>None 🎉</p>";
}

async function startExam() {
  setFeedback("", "");
  setupNote.textContent = "";

  const domain = DOMAINS[Number(domainSelect.value)];
  const loaded = await loadDomain(domain);

  if (!loaded.length) {
    setupNote.textContent = "No valid questions found in this domain (or all were missing exhibits).";
    return;
  }

  const n = countSelect.value === "all" ? loaded.length : Number(countSelect.value);
  exam = loaded.slice(0, n);

  answers = exam.map(() => ({ selected: [], submitted: false }));
  currentIndex = 0;
  score = 0;
  incorrect = [];
  weakCounts = {};

  show(quizSec);
  renderQuestion();
}

function buildSetupUI() {
  domainSelect.innerHTML = "";
  DOMAINS.forEach((d, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = d.name;
    domainSelect.appendChild(opt);
  });
}

startBtn.addEventListener("click", startExam);
submitBtn.addEventListener("click", submitAnswer);
nextBtn.addEventListener("click", nextQuestion);
backBtn.addEventListener("click", prevQuestion);
quitBtn.addEventListener("click", () => show(setupSec));
restartBtn.addEventListener("click", () => show(setupSec));

buildSetupUI();
show(setupSec);
