import { SCENES } from "../data/scenes.js";
import {
  CARE,
  DISCLAIMER,
  NURSE,
  PAIRING,
  PROFILES,
  TIE_RULE,
} from "../data/profiles.js";
import { grade, isCrisis, slotOf, SLOT_WORDS, validateContent } from "./rules.js";

const state = {
  screen: "title",
  sceneIndex: 0,
  lineIndex: 0,
  sceneCaptured: false,
  tokens: [],
  readingId: null,
  selected: null,
  slots: emptySlots(),
  feedback: "",
  shake: false,
  result: null,
  muted: false,
  flash: "",
};

const speech = {
  speaker: "한석지",
  full: "",
  done: false,
  mode: "static",
  prompt: "클릭하여 다음으로 ▶▶▶",
  nav: false,
  onAdvance: null,
};

let root = null;
let audioCtx = null;
let typeTimer = null;
let swallowClick = false;

function emptySlots() {
  return { weight: null, place: null, today: null };
}

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "disabled") node.disabled = true;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat(2)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function ensureAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(ctx, { type, from, to, dur, peak, at }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + dur);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function playClick() {
  if (state.muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  tone(ctx, { type: "square", from: 740, to: 420, dur: 0.07, peak: 0.03, at: ctx.currentTime });
}

function playBlip() {
  if (state.muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  tone(ctx, { type: "square", from: 520, to: 360, dur: 0.035, peak: 0.018, at: ctx.currentTime });
}

function playStamp() {
  if (state.muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const at = ctx.currentTime;
  tone(ctx, { type: "triangle", from: 210, to: 88, dur: 0.26, peak: 0.07, at });
}

function stopType() {
  if (typeTimer) clearInterval(typeTimer);
  typeTimer = null;
}

function say(speaker, text, opts = {}) {
  speech.speaker = speaker;
  speech.full = text;
  speech.done = false;
  speech.mode = opts.mode || "advance";
  speech.prompt = opts.prompt || "클릭하여 다음으로 ▶▶▶";
  speech.nav = !!opts.nav;
  speech.onAdvance = opts.onAdvance || null;
  render();
}

function finishType() {
  stopType();
  speech.done = true;
  const line = document.querySelector(".line");
  if (line) line.textContent = speech.full;
  const prompt = document.querySelector(".prompt");
  if (prompt) prompt.hidden = !(speech.mode === "advance" || speech.nav);
  document.querySelector(".capture")?.toggleAttribute("hidden", !(state.screen === "scene" && speech.nav));
  document.querySelector("#start")?.toggleAttribute("hidden", state.screen !== "title");
}

function startType() {
  const line = document.querySelector(".line");
  if (!line) return;
  if (speech.done) {
    line.textContent = speech.full;
    return;
  }
  let index = 0;
  line.textContent = "";
  typeTimer = setInterval(() => {
    if (index >= speech.full.length) {
      finishType();
      return;
    }
    const ch = speech.full[index];
    index += 1;
    line.textContent += ch;
    if (ch.trim() && index % 2 === 0) playBlip();
  }, 26);
}

function onDialogueClick(event) {
  if (event.target.closest("button")) return;
  ensureAudio();
  if (!speech.done) {
    finishType();
    return;
  }
  if (speech.mode === "advance" && speech.onAdvance) speech.onAdvance();
}

function installGuards() {
  document.addEventListener("click", (event) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  window.addEventListener("resize", fit);
}

function attachPress(node, { onTap, onDrop }) {
  let dragging = false;
  let active = false;
  let ghost = null;
  let startX = 0;
  let startY = 0;
  const end = (event, cancelled) => {
    if (!active) return;
    active = false;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    const wasDragging = dragging;
    dragging = false;
    if (ghost) ghost.remove();
    ghost = null;
    if (cancelled || !wasDragging) return;
    swallowClick = true;
    window.setTimeout(() => { swallowClick = false; }, 0);
    onDrop(document.elementFromPoint(event.clientX, event.clientY));
  };
  const up = (event) => end(event, false);
  const cancel = (event) => end(event, true);
  const move = (event) => {
    if (!active) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!dragging && dx * dx + dy * dy < 64) return;
    dragging = true;
    if (!ghost) {
      ghost = document.createElement("div");
      ghost.className = "drag-ghost";
      ghost.textContent = node.dataset.label || node.textContent.trim();
      document.body.append(ghost);
    }
    ghost.style.left = `${event.clientX}px`;
    ghost.style.top = `${event.clientY}px`;
  };
  node.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || active) return;
    active = true;
    dragging = false;
    startX = event.clientX;
    startY = event.clientY;
    try { node.setPointerCapture(event.pointerId); } catch { /* lost pointer */ }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  });
  node.addEventListener("click", (event) => {
    event.stopPropagation();
    onTap();
  });
}

function fit() {
  const stage = document.querySelector(".stage");
  const frame = document.querySelector(".fit");
  if (!stage || !frame) return;
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stage.style.transform = `scale(${scale})`;
  frame.style.width = `${1280 * scale}px`;
  frame.style.height = `${720 * scale}px`;
}

function render() {
  stopType();
  root.replaceChildren(buildFit(), rotateHint());
  startType();
  fit();
}

function rotateHint() {
  return el(
    "div",
    { class: "rotate" },
    el("strong", {}, "가로로 돌려 주세요"),
    el("p", {}, "진료 화면은 가로에서 이어집니다."),
  );
}

function buildFit() {
  const art = state.screen === "result" ? "assets/nurse_smile.png" : "assets/nurse_calm.png";
  const showBanner = !["title", "intro"].includes(state.screen);
  return el(
    "div",
    { class: "fit" },
    el(
      "div",
      { class: "stage", "data-screen": state.screen },
      el("div", { class: "circuit" }),
      el(
        "section",
        { class: "scene" },
        showBanner ? el("div", { class: "banner" }, bannerText()) : null,
        el("img", { class: "art", src: art, alt: "간호사 한석지" }),
      ),
      dialogue(),
      folder(),
      hud(),
      muteButton(),
      state.flash ? el("p", { class: "flash" }, state.flash) : null,
    ),
  );
}

function bannerText() {
  if (state.screen === "scene") {
    const scene = SCENES[state.sceneIndex];
    return `${scene.step}  ${state.sceneIndex + 1}/${SCENES.length}`;
  }
  return { book: "오늘의 백과", chart: "기록부", result: "오늘의 거울", care: "도움" }[state.screen] || "";
}

function dialogue() {
  const scene = SCENES[state.sceneIndex];
  const choice = scene?.choices[state.lineIndex];
  const captured = choice && (choice.crisis
    ? false
    : state.tokens.some((token) => token.id === choice.id));
  const box = el(
    "div",
    { class: "dialogue", onclick: onDialogueClick },
    el("div", { class: "name-tag" }, speech.speaker || "한석지"),
    el("p", { class: "line" }),
    el("p", { class: "prompt", hidden: !(speech.done && (speech.mode === "advance" || speech.nav)) }, speech.prompt),
    el(
      "div",
      { class: "arrows", hidden: !speech.nav },
      el("button", { class: "arrow left", type: "button", "aria-label": "이전 말", onclick: () => moveLine(-1) }, "◀"),
      el("button", { class: "arrow right", type: "button", "aria-label": "다음 말", onclick: () => moveLine(1) }, "▶"),
    ),
    el(
      "button",
      {
        class: "capture",
        type: "button",
        hidden: !(state.screen === "scene" && speech.nav && speech.done) || captured,
        onclick: capture,
      },
      captured ? `확보됨 : 「${choice.label}」` : `단서 확보 : 「${choice?.label || "이 말"}」`,
    ),
    el(
      "button",
      { class: "start-btn", id: "start", type: "button", hidden: state.screen !== "title" || !speech.done, onclick: begin },
      "앉아 보기",
    ),
  );
  return box;
}

function folder() {
  const tall = ["scene", "book", "chart", "result", "care"].includes(state.screen);
  return el(
    "section",
    { class: `folder${tall ? " tall" : ""}` },
    el(
      "div",
      { class: `paper${state.shake ? " shake" : ""}` },
      folderBody(),
    ),
  );
}

function folderBody() {
  if (state.screen === "title" || state.screen === "intro") {
    return el(
      "div",
      { class: "hospital" },
      el("p", { class: "kicker" }, "재미로 읽는 오늘 거울"),
      el("p", { class: "game-title" }, "나의 진료"),
      el("h2", {}, "제일종합병원"),
      el("span", { class: "cross", "aria-hidden": "true" }),
      el("p", { class: "disclaimer" }, DISCLAIMER),
    );
  }
  if (state.screen === "scene") return recordShell(true);
  if (state.screen === "book") return bookBody();
  if (state.screen === "chart") return chartBody();
  if (state.screen === "result") return resultBody();
  return careBody();
}

function recordShell(locked) {
  return [
    el("h2", {}, "오늘의 기록부"),
    el("p", { class: "meta" }, "이름: 나"),
    el("p", { class: "reason" }, "내방 이유: 오늘 거울"),
    el("hr", { class: "rule" }),
    el(
      "div",
      { class: "slots" },
      ["무게", "자리", "오늘"].map((label) =>
        el(
          "button",
          { class: "slot", type: "button", disabled: locked },
          el("span", { class: "slot-label" }, label),
          el("span", { class: "slot-value" }, locked ? "백과 후" : "놓기"),
        ),
      ),
    ),
    el("p", { class: "group-label" }, "확보한 말"),
    el(
      "div",
      { class: "tray" },
      state.tokens.map((token) => el("span", { class: "pill" }, token.label)),
    ),
  ];
}

function bookBody() {
  const open = state.tokens.find((token) => token.id === state.readingId);
  const unread = state.tokens.filter((token) => !token.read).length;
  return [
    el("h2", {}, "오늘의 백과"),
    el("p", { class: "book-hint" }, "말을 누르거나 이 종이 위로 올리세요."),
    el(
      "div",
      { class: "token-list", "data-book": "true" },
      state.tokens.map((token) => {
        const button = el(
          "button",
          {
            class: `token${token.read ? " read" : ""}${token.id === state.readingId ? " open" : ""}`,
            type: "button",
            "data-token": token.id,
            "data-label": token.label,
          },
          token.label,
        );
        attachPress(button, {
          onTap: () => openToken(token.id),
          onDrop: (target) => {
            if (target?.closest?.("[data-book], .paper")) openToken(token.id);
          },
        });
        return button;
      }),
    ),
    open
      ? el(
          "article",
          { class: "entry" },
          el("p", { class: "said" }, `“${open.text}”`),
          el("p", {}, open.encyclopedia[0]),
          el("p", {}, open.encyclopedia[1]),
        )
      : null,
    unread === 0 ? pairingMemo() : null,
    el(
      "button",
      { class: "primary", id: "open-chart", type: "button", disabled: unread > 0, onclick: openChart },
      unread === 0 ? "기록부 열기" : `남은 말 ${unread}`,
    ),
  ];
}

function pairingMemo() {
  return el(
    "section",
    { class: "memo" },
    el("p", {}, "위에서부터 처음 맞는 줄이 오늘 칸입니다."),
    el("ul", {}, PAIRING.map((row) => el("li", {}, `${row.when} ${row.today}`))),
    el("p", { class: "tie" }, TIE_RULE),
  );
}

function chartBody() {
  const selectedSlot = state.selected ? slotOf(state.selected) : null;
  return [
    el("h2", {}, "오늘의 기록부"),
    el("p", { class: "meta" }, "이름: 나"),
    el("p", { class: "reason" }, "내방 이유: 오늘 거울"),
    el("hr", { class: "rule" }),
    el(
      "div",
      { class: "slots" },
      Object.keys(SLOT_WORDS).map((slot) =>
        el(
          "button",
          {
            class: `slot${state.slots[slot] ? " filled" : ""}${selectedSlot === slot ? " target" : ""}`,
            type: "button",
            "data-slot": slot,
            onclick: () => tapSlot(slot),
          },
          el("span", { class: "slot-label" }, { weight: "무게", place: "자리", today: "오늘" }[slot]),
          el("span", { class: "slot-value" }, state.slots[slot] || "놓기"),
        ),
      ),
    ),
    pairingMemo(),
    el(
      "div",
      { class: "groups" },
      Object.entries(SLOT_WORDS).map(([slot, words]) =>
        el(
          "section",
          { class: "group" },
          el("p", { class: "group-label" }, { weight: "무게", place: "자리", today: "오늘" }[slot]),
          el(
            "div",
            { class: "chips" },
            words.map((word) => {
              const button = el(
                "button",
                {
                  class: `chip${state.selected === word ? " selected" : ""}${state.slots[slot] === word ? " placed" : ""}`,
                  type: "button",
                  "data-word": word,
                  "data-label": word,
                },
                word,
              );
              attachPress(button, {
                onTap: () => tapChip(word),
                onDrop: (target) => {
                  const slotNode = target?.closest?.("[data-slot]");
                  if (!slotNode) {
                    state.selected = word;
                    render();
                    return;
                  }
                  place(word, slotNode.dataset.slot);
                },
              });
              return button;
            }),
          ),
        ),
      ),
    ),
    el("p", { class: "feedback" }, state.feedback),
    el("button", { class: "primary", id: "submit", type: "button", onclick: submitChart }, "기록 제출"),
  ];
}

function resultBody() {
  const profile = PROFILES[state.result.expected.profileId];
  const { weight, place, today } = state.result.expected;
  return [
    el("p", { class: "stamp", "aria-hidden": "true" }, "APPROVED"),
    el("h1", { class: "profile-name", "data-profile": profile.id }, profile.name),
    el("p", { class: "summary" }, `무게 ${weight} · 자리 ${place} · 오늘 ${today}`),
    el("p", {}, profile.lines[0]),
    el("p", {}, profile.lines[1]),
    el("p", { class: "action" }, `${profile.today}. ${profile.action}`),
    el("p", { class: "disclaimer", role: "note" }, DISCLAIMER),
    el("button", { class: "ghost", id: "again", type: "button", onclick: resetTitle }, "다른 오늘"),
  ];
}

function careBody() {
  return [
    el("h2", {}, CARE.title),
    el("p", {}, CARE.body),
    CARE.numbers.map((item) =>
      el(
        "a",
        { class: "hotline", href: `tel:${item.tel}` },
        el("span", {}, item.name),
        el("strong", {}, item.tel),
        el("span", { class: "note" }, item.note),
      ),
    ),
    el("p", { class: "emergency" }, CARE.emergency),
    el("button", { class: "ghost", id: "leave", type: "button", onclick: resetTitle }, CARE.leave),
  ];
}

function hud() {
  return el(
    "footer",
    { class: "hud" },
    el("div", { class: "messenger" }, el("span", { class: "mini-cross", "aria-hidden": "true" }), "원내 메신저"),
    el("div", { class: "jms-badge" }, "JMS"),
    el("div", { class: "admin" }, "Admin"),
  );
}

function muteButton() {
  return el(
    "button",
    {
      class: "mute",
      type: "button",
      "aria-label": state.muted ? "소리 켜기" : "소리 끄기",
      onclick: () => {
        state.muted = !state.muted;
        render();
      },
    },
    state.muted ? "🔇" : "🔊",
  );
}

function resetPlay() {
  state.screen = "title";
  state.sceneIndex = 0;
  state.lineIndex = 0;
  state.sceneCaptured = false;
  state.tokens = [];
  state.readingId = null;
  state.selected = null;
  state.slots = emptySlots();
  state.feedback = "";
  state.shake = false;
  state.result = null;
  state.flash = "";
}

function resetTitle() {
  resetPlay();
  showTitle();
}

function showTitle() {
  state.screen = "title";
  say("한석지", NURSE.title, { mode: "static" });
}

function begin(event) {
  event?.stopPropagation();
  ensureAudio();
  playClick();
  state.screen = "intro";
  say("한석지", NURSE.how, {
    onAdvance: () => {
      state.sceneIndex = 0;
      beginScene();
    },
  });
}

function beginScene() {
  state.screen = "scene";
  state.lineIndex = 0;
  state.sceneCaptured = false;
  say("한석지", SCENES[state.sceneIndex].nurse, { onAdvance: showLine });
}

function showLine() {
  const scene = SCENES[state.sceneIndex];
  const choice = scene.choices[state.lineIndex];
  say("나", choice.text, {
    mode: "nav",
    nav: true,
    prompt: `${state.lineIndex + 1} / ${scene.choices.length}`,
  });
}

function moveLine(dir) {
  const count = SCENES[state.sceneIndex].choices.length;
  state.lineIndex = (state.lineIndex + dir + count) % count;
  playBlip();
  showLine();
}

function capture(event) {
  event?.stopPropagation();
  if (!speech.done || state.sceneCaptured) return;
  const choice = SCENES[state.sceneIndex].choices[state.lineIndex];
  ensureAudio();
  playClick();
  if (isCrisis(choice)) {
    state.screen = "care";
    say("한석지", `${CARE.nurse} ${CARE.body}`, { mode: "static" });
    return;
  }
  state.tokens.push({
    id: choice.id,
    label: choice.label,
    text: choice.text,
    tags: { ...choice.tags },
    encyclopedia: choice.encyclopedia.slice(),
    read: false,
  });
  state.sceneCaptured = true;
  state.flash = "단서 확보!";
  const more = state.sceneIndex < SCENES.length - 1;
  say("한석지", more ? "그 말을 기록해 둘게요." : "오늘 말은 여기까지예요. 백과로 읽어 볼까요.", {
    onAdvance: () => {
      state.flash = "";
      if (more) {
        state.sceneIndex += 1;
        beginScene();
      } else {
        state.screen = "book";
        say("한석지", `${NURSE.bookCount} ${TIE_RULE} ${NURSE.bookAsk}`, { mode: "static" });
      }
    },
  });
  window.setTimeout(() => {
    state.flash = "";
    document.querySelector(".flash")?.remove();
  }, 700);
}

function openToken(id) {
  const token = state.tokens.find((item) => item.id === id);
  if (!token) return;
  token.read = true;
  state.readingId = id;
  playClick();
  speech.done = true;
  render();
}

function openChart(event) {
  event?.stopPropagation();
  if (state.tokens.some((token) => !token.read)) return;
  state.screen = "chart";
  state.selected = null;
  state.slots = emptySlots();
  state.feedback = "";
  state.shake = false;
  playClick();
  say("한석지", NURSE.chart, { mode: "static" });
}

function place(word, slotName) {
  const home = slotOf(word);
  ensureAudio();
  playClick();
  if (home !== slotName) {
    state.feedback = NURSE.wrongSlot[home] || NURSE.empty;
    state.shake = true;
    say("한석지", state.feedback, { mode: "static" });
    releaseShake();
    return;
  }
  state.slots[slotName] = word;
  state.selected = null;
  state.feedback = "";
  speech.done = true;
  render();
}

function tapChip(word) {
  const home = slotOf(word);
  if (state.slots[home] === word) {
    state.slots[home] = null;
    state.selected = word;
  } else {
    state.selected = word;
    playClick();
  }
  speech.done = true;
  render();
}

function tapSlot(slotName) {
  if (state.selected) {
    place(state.selected, slotName);
    return;
  }
  if (state.slots[slotName]) {
    state.slots[slotName] = null;
    speech.done = true;
    render();
  }
}

function releaseShake() {
  window.setTimeout(() => {
    state.shake = false;
    document.querySelector(".paper")?.classList.remove("shake");
  }, 480);
}

function submitChart(event) {
  event?.stopPropagation();
  ensureAudio();
  if (!state.slots.weight || !state.slots.place || !state.slots.today) {
    state.feedback = NURSE.empty;
    say("한석지", NURSE.empty, { mode: "static" });
    return;
  }
  const result = grade(state.tokens, state.slots);
  if (!result.ok) {
    state.feedback = NURSE.miss[result.misses[0]];
    state.shake = true;
    say("한석지", state.feedback, { mode: "static" });
    releaseShake();
    return;
  }
  playStamp();
  state.result = result;
  state.screen = "result";
  state.feedback = "";
  const profile = PROFILES[result.expected.profileId];
  say("한석지", profile.lines[0], { mode: "static" });
}

export function start(app) {
  validateContent(SCENES);
  root = app;
  installGuards();
  showTitle();
}
