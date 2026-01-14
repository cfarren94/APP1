
function stripSuggested(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\uFFFF/g, '')
    .replace(/\u0000/g, '')
    .replace(/\s*Suggested\s*Answer\s*:\s*.*$/i, '')
    .replace(/\s*Answer\s*:\s*.*$/i, '')
    .replace(/\s*Timestamp\s*:\s*.*$/i, '')
    .trim();
}


const DOMAIN_FILES = {
  "Security Concepts": "questions/security_concepts.json",
  "Network Security": "questions/network_security.json",
  "Securing the Cloud": "questions/securing_the_cloud.json",
  "Content Security": "questions/content_security.json",
  "Endpoint Protection and Detection": "questions/endpoint_protection_and_detection.json",
  "Secure Network Access, Visibility, and Enforcement": "questions/secure_network_access_visibility_and_enforcement.json"
};
const DOMAIN_ORDER = [
  "Security Concepts",
  "Network Security",
  "Securing the Cloud",
  "Content Security",
  "Endpoint Protection and Detection",
  "Secure Network Access, Visibility, and Enforcement"
];
const ALL_LABEL = "All domains";

const els = {
  screenSelect: document.getElementById("screen-select"),
  screenQuiz: document.getElementById("screen-quiz"),
  screenResult: document.getElementById("screen-result"),
  domainSelect: document.getElementById("domainSelect"),
  shuffleToggle: document.getElementById("shuffleToggle"),
  startBtn: document.getElementById("startBtn"),
  bankInfo: document.getElementById("bankInfo"),
  progress: document.getElementById("progress"),
  domainLabel: document.getElementById("domainLabel"),
  questionArea: document.getElementById("questionArea"),
  feedback: document.getElementById("feedback"),
  submitBtn: document.getElementById("submitBtn"),
  nextBtn: document.getElementById("nextBtn"),
  backBtn: document.getElementById("backBtn"),
  quitBtn: document.getElementById("quitBtn"),
  resultSummary: document.getElementById("resultSummary"),
  restartBtn: document.getElementById("restartBtn"),
};

let bank = [];
let idx = 0;
let answers = []; // user answers per index (array of letters)
let revealed = []; // whether submitted at index

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function setScreen(which) {
  els.screenSelect.classList.add("hidden");
  els.screenQuiz.classList.add("hidden");
  els.screenResult.classList.add("hidden");
  which.classList.remove("hidden");
}

async function loadDomainBank(domainName) {
  if (domainName === ALL_LABEL) {
    const all = [];
    for (const dn of DOMAIN_ORDER) {
      const url = DOMAIN_FILES[dn];
      const res = await fetch(url);
      const data = await res.json();
      data.forEach(q => all.push(q));
    }
    return all;
  } else {
    const url = DOMAIN_FILES[domainName];
    const res = await fetch(url);
    return await res.json();
  }
}

function normaliseSelection(inputs) {
  const picked = [];
  inputs.forEach(inp => {
    if (inp.checked) picked.push(inp.value);
  });
  // stable order
  picked.sort();
  return picked;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function render() {
  const q = bank[idx];
  els.progress.textContent = `Question ${idx + 1} of ${bank.length}`;
  els.domainLabel.textContent = `Domain: ${q.domain}`;

  els.feedback.classList.add("hidden");
  els.feedback.textContent = "";
  els.feedback.classList.remove("good","bad");

  const userPicked = answers[idx] || [];
  const isRevealed = revealed[idx] || false;

  let html = "";
  html += `<div class="qtext">${escapeHtml(q.question)}</div>`;

  const choose = q.choose || 1;
  const inputType = choose === 1 ? "radio" : "checkbox";

  // options sorted by letter
  const letters = Object.keys(q.options).sort();
  letters.forEach(letter => {
    const optText = q.options[letter];
    const checked = userPicked.includes(letter) ? "checked" : "";
    const disabled = isRevealed ? "disabled" : "";
    const nameAttr = choose === 1 ? 'name="optRadio"' : "";
    html += `
      <label class="opt">
        <input type="${inputType}" value="${letter}" ${nameAttr} ${checked} ${disabled}>
        <div class="letter">${letter}</div>
        <div>${escapeHtml(optText)}</div>
      </label>
    `;
  });

  html += `<div class="tiny">Choose ${choose}.</div>`;
  els.questionArea.innerHTML = html;

  // buttons
  els.submitBtn.classList.toggle("hidden", isRevealed);
  els.nextBtn.classList.toggle("hidden", !isRevealed);
  els.backBtn.disabled = idx === 0;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function showFeedback(isCorrect, correctAns) {
  els.feedback.classList.remove("hidden");
  els.feedback.classList.add(isCorrect ? "good" : "bad");
  els.feedback.innerHTML = `
    <div><strong>${isCorrect ? "Correct ✅" : "Incorrect ❌"}</strong></div>
    <div class="tiny">Correct answer: ${correctAns.join(", ")}</div>
  `;
}

function calcScore() {
  let s = 0;
  for (let i = 0; i < bank.length; i++) {
    const q = bank[i];
    const picked = (answers[i] || []).slice().sort();
    const corr = (q.answer || []).slice().sort();
    if (picked.length && arraysEqual(picked, corr)) s += 1;
  }
  return s;
}

function finish() {
  const score = calcScore();
  els.resultSummary.textContent = `Score: ${score} / ${bank.length}`;
  setScreen(els.screenResult);
}

els.startBtn.addEventListener("click", async () => {
  const selected = els.domainSelect.value;
  const doShuffle = els.shuffleToggle.checked;

  bank = await loadDomainBank(selected);
  if (!Array.isArray(bank) || bank.length === 0) {
    alert("No questions found for that domain.");
    return;
  }

  // reset state
  idx = 0;
  answers = new Array(bank.length).fill(null);
  revealed = new Array(bank.length).fill(false);

  if (doShuffle) {
    bank = shuffle(bank);
  }

  setScreen(els.screenQuiz);
  render();
});

els.submitBtn.addEventListener("click", () => {
  const q = bank[idx];
  const choose = q.choose || 1;
  const inputs = Array.from(els.questionArea.querySelectorAll("input"));
  const picked = normaliseSelection(inputs);

  if (picked.length !== choose) {
    alert(`Please select exactly ${choose} option(s).`);
    return;
  }

  answers[idx] = picked;
  revealed[idx] = true;

  const correct = (q.answer || []).slice().sort();
  const isCorrect = arraysEqual(picked.slice().sort(), correct);

  // disable inputs
  inputs.forEach(i => i.disabled = true);

  showFeedback(isCorrect, correct);
  els.submitBtn.classList.add("hidden");
  els.nextBtn.classList.remove("hidden");
});

els.nextBtn.addEventListener("click", () => {
  if (idx < bank.length - 1) {
    idx += 1;
    render();
  } else {
    finish();
  }
});

els.backBtn.addEventListener("click", () => {
  if (idx === 0) return;
  idx -= 1;
  render();
  // if this question was already revealed, show feedback again
  if (revealed[idx]) {
    const q = bank[idx];
    const picked = (answers[idx] || []).slice().sort();
    const correct = (q.answer || []).slice().sort();
    showFeedback(arraysEqual(picked, correct), correct);
  }
});

els.quitBtn.addEventListener("click", () => {
  setScreen(els.screenSelect);
});

els.restartBtn.addEventListener("click", () => {
  setScreen(els.screenSelect);
});

async function populateDomainSelect() {
  els.domainSelect.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = ALL_LABEL;
  optAll.textContent = ALL_LABEL;
  els.domainSelect.appendChild(optAll);

  for (const dn of DOMAIN_ORDER) {
    const opt = document.createElement("option");
    opt.value = dn;
    opt.textContent = dn;
    els.domainSelect.appendChild(opt);
  }

  // show counts
  const counts = {};
  for (const dn of DOMAIN_ORDER) {
    const res = await fetch(DOMAIN_FILES[dn]);
    const data = await res.json();
    counts[dn] = data.length;
  }
  const total = Object.values(counts).reduce((a,b)=>a+b,0);
  els.bankInfo.textContent = `Question counts: total ${total} • ` + DOMAIN_ORDER.map(dn => `${dn} (${counts[dn]})`).join(" • ");
}

populateDomainSelect();

// service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}
