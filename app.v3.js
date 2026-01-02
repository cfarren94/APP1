// APP V3 — uses JSON fields only (choose + correct). No PDF parsing.
console.log("Loaded APP.V3 2026-01-02");

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

const startBtn = el("startBtn");
const quitBtn = el("quitBtn");
const restartBtn = el("restartBtn");

const progress = el("progress");
const qTitle = el("qTitle");
const qText = el("qText");
const qHint = el("qHint");
const optionsForm = el("optionsForm");

const backBtn = el("backBtn");
const submitBtn = el("submitBtn");
const nextBtn = el("nextBtn");
const feedback = el("feedback");

const scoreLine = el("scoreLine");
const review = el("review");

let exam = [];
let currentIndex = 0;
let score = 0;
let incorrect = [];
let answers = [];

function show(section) {
  setupSec.classList.add("hidden");
  quizSec.classList.add("hidden");
  resultsSec.classList.add("hidden");
  section.classList.remove("hidden");
}

function normaliseLetters(arr) {
  return [...new Set((arr || []).map(x => String(x).trim().toUpperCase()))]
    .filter(x => /^[A-E]$/.test(x))
    .sort();
}

function isExactMatch(a, b) {
  const aa = normaliseLetters(a);
  const bb = normaliseLetters(b);
  return aa.length === bb.length && aa.join(",") === bb.join(",");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function requiredCount(q) {
  const optCount = Object.keys(q.options || {}).length || 0;

  // Prefer explicit choose
  let c = Number(q.choose);
  if (!Number.isFinite(c) || c < 1) {
    const corrLen = Array.isArray(q.correct) ? q.correct.length : 0;
    c = corrLen > 0 ? corrLen : 1;
  }

  if (optCount > 0) c = Math.min(c, optCount);
  return Math.max(1, c);
}

async function loadDomain(file) {
  const res = await fetch(file, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${file}`);
  const data = await res.json();
  // sanity: ensure arrays
  return data.map(q => ({
    ...q,
    correct: Array.isArray(q.correct) ? q.correct : normaliseLetters(q.correct),
    choose: q.choose
  }));
}

function renderQuestion() {
  const q = exam[currentIndex];
  const state = answers[currentIndex];
  const req = requiredCount(q);

  progress.textContent = `Question ${currentIndex + 1} of ${exam.length} • Score ${score}`;
  qTitle.textContent = `Question ${currentIndex + 1}`;
  qText.textContent = q.question_display || q.question || "(Question text missing)";
  qHint.textContent = req === 1 ? "Choose one answer." : `Choose ${req} answers.`;

  optionsForm.innerHTML = "";
  feedback.textContent = "";
  feedback.className = "feedback";

  const type = req === 1 ? "radio" : "checkbox";
  const name = req === 1 ? 'name="single"' : "";

  const letters = Object.keys(q.options || {}).sort();
  for (const letter of letters) {
    const checked = state.selected.includes(letter) ? "checked" : "";
    optionsForm.innerHTML += `
      <div class="option">
        <input type="${type}" value="${letter}" ${name} ${checked}>
        <label><b>${letter})</b> ${escapeHtml(q.options[letter])}</label>
      </div>
    `;
  }

  // If multi-select: prevent selecting more than req
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
    feedback.className = ok ? "feedback ok" : "feedback bad";
    feedback.textContent = ok
      ? "Correct ✅"
      : `Incorrect ❌   Correct answer: ${normaliseLetters(q.correct || []).join(", ")}`;
  }
}

function submitAnswer() {
  const q = exam[currentIndex];
  const req = requiredCount(q);
  const selected = [...optionsForm.querySelectorAll("input:checked")].map(i => i.value);

  answers[currentIndex] = { selected, submitted: false };

  if (selected.length !== req) {
    feedback.className = "feedback warn";
    feedback.textContent = `Select exactly ${req} answer${req === 1 ? "" : "s"} before submitting.`;
    return;
  }

  answers[currentIndex].submitted = true;

  if (isExactMatch(selected, q.correct || [])) {
    score++;
  } else {
    incorrect.push({
      number: currentIndex + 1,
      question: q.question_display || q.question || "",
      your: normaliseLetters(selected).join(", ") || "—",
      correct: normaliseLetters(q.correct || []).join(", ") || "—"
    });
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
  review.innerHTML = incorrect.length
    ? incorrect.map(x => `
        <div class="reviewItem">
          <p><b>Q${x.number}.</b> ${escapeHtml(x.question)}</p>
          <p><b>Your answer:</b> ${escapeHtml(x.your)}</p>
          <p><b>Correct answer:</b> ${escapeHtml(x.correct)}</p>
        </div>
      `).join("")
    : "<p>None 🎉</p>";
}

async function startExam() {
  const domain = DOMAINS[Number(domainSelect.value)];
  exam = await loadDomain(domain.file);

  const n = countSelect.value === "all" ? exam.length : Number(countSelect.value);
  exam = exam.slice(0, n);

  answers = exam.map(() => ({ selected: [], submitted: false }));
  currentIndex = 0;
  score = 0;
  incorrect = [];

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
