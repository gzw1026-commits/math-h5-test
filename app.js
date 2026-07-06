const app = document.querySelector("#app");

const SHARE_CONFIG = {
  title: "小学数学入学准备测评",
  desc: "5-7分钟测一测孩子的20以内数感、10以内加减理解、图形方位、规律分类和简单应用表达。",
  coverPath: "share-cover.svg",
  wechatAppId: "",
  wechatSignatureEndpoint: "",
};

const DIMENSIONS = {
  numberSense: "数感与数量",
  calculation: "计算熟练度",
  geometry: "图形认知",
  application: "应用理解",
  advanced: "超前观察",
};

const TYPE_META = {
  count: { label: "数数与数量", seconds: 14, dimension: "numberSense" },
  compare: { label: "数字比较", seconds: 12, dimension: "numberSense" },
  add10: { label: "10以内加法", seconds: 15, dimension: "calculation" },
  subtract10: { label: "10以内减法", seconds: 16, dimension: "calculation" },
  teenSense: { label: "11-20数感", seconds: 16, dimension: "numberSense" },
  add20: { label: "20以内加法", seconds: 20, dimension: "calculation" },
  carryAdd: { label: "进位加法", seconds: 24, dimension: "calculation" },
  makeTen: { label: "凑十法", seconds: 24, dimension: "calculation" },
  decomposeSub: { label: "拆十退位", seconds: 28, dimension: "calculation" },
  equation: { label: "算式填空", seconds: 26, dimension: "application" },
  expressionCompare: { label: "式子比较", seconds: 26, dimension: "application" },
  solidShape: { label: "立体图形", seconds: 15, dimension: "geometry" },
  pattern: { label: "规律推理", seconds: 24, dimension: "application" },
  logic: { label: "逻辑推理", seconds: 32, dimension: "application" },
  story: { label: "生活应用题", seconds: 30, dimension: "application" },
  borrowSub: { label: "退位减法", seconds: 26, dimension: "advanced" },
  hundredSense: { label: "100以内数感", seconds: 22, dimension: "advanced" },
  planeShape: { label: "平面图形", seconds: 14, dimension: "advanced" },
  hundredCalc: { label: "100以内口算", seconds: 28, dimension: "advanced" },
};

const state = {
  screen: "home",
  questions: [],
  index: 0,
  answers: [],
  selectedAnswer: "",
  startedAt: 0,
  questionStartedAt: 0,
  tick: null,
  now: Date.now(),
  result: null,
  practiceQuestion: null,
  practiceAnswer: "",
  practiceChecked: false,
  autoRead: true,
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sample(array) {
  return array[rand(0, array.length - 1)];
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function uniqueOptions(answer, min, max, count = 4) {
  const values = new Set([answer]);
  while (values.size < count) {
    const offset = sample([-3, -2, -1, 1, 2, 3, 4]);
    const next = Math.max(min, Math.min(max, answer + offset));
    values.add(next);
  }
  return shuffle([...values]).map(String);
}

function optionQuestion(base) {
  return { input: "choice", ...base, options: base.options.map(String), answer: String(base.answer) };
}

function inputQuestion(base) {
  return { input: "number", ...base, answer: String(base.answer) };
}

function makeDots(count) {
  return `<div class="dots">${Array.from({ length: count }, () => `<span class="dot"></span>`).join("")}</div>`;
}

function makeTenFrame(filled, extra = 0) {
  const cells = Array.from({ length: 10 }, (_, index) => {
    const dot = index < filled ? `<span class="dot ten-dot"></span>` : "";
    return `<span class="ten-cell">${dot}</span>`;
  }).join("");
  const extras = Array.from({ length: extra }, () => `<span class="dot extra-dot"></span>`).join("");
  return `<div class="ten-visual"><div class="ten-frame">${cells}</div><div class="extra-dots">${extras}</div></div>`;
}

function makeNumberLine(numbers) {
  return `<div class="number-line">${numbers.map((number) => `<span class="num-chip">${number}</span>`).join("")}</div>`;
}

function makeShapes(shapes) {
  return `<div class="shapes">${shapes.map((shape) => `<span class="shape ${shape.className}">${shape.text || ""}</span>`).join("")}</div>`;
}

function solidShapeSvg(kind) {
  const svgs = {
    球: `
      <svg class="shape-svg" viewBox="0 0 160 130" role="img" aria-label="球">
        <defs>
          <radialGradient id="sphereGradient" cx="34%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="38%" stop-color="#87c3ed"/>
            <stop offset="100%" stop-color="#3779aa"/>
          </radialGradient>
        </defs>
        <circle cx="80" cy="65" r="48" fill="url(#sphereGradient)" stroke="#2f668f" stroke-width="5"/>
        <path d="M42 62c22 14 55 16 82 0" fill="none" stroke="#ffffff" stroke-width="5" opacity=".7"/>
      </svg>
    `,
    正方体: `
      <svg class="shape-svg" viewBox="0 0 160 130" role="img" aria-label="正方体">
        <polygon points="52,34 98,34 122,58 76,58" fill="#b5a4e8" stroke="#4d4174" stroke-width="5" stroke-linejoin="round"/>
        <polygon points="76,58 122,58 122,104 76,104" fill="#8067b7" stroke="#4d4174" stroke-width="5" stroke-linejoin="round"/>
        <polygon points="52,34 76,58 76,104 52,80" fill="#9784d2" stroke="#4d4174" stroke-width="5" stroke-linejoin="round"/>
        <line x1="52" y1="80" x2="98" y2="80" stroke="#4d4174" stroke-width="5"/>
        <line x1="98" y1="34" x2="122" y2="58" stroke="#4d4174" stroke-width="5"/>
      </svg>
    `,
    长方体: `
      <svg class="shape-svg wide-shape-svg" viewBox="0 0 220 130" role="img" aria-label="长方体">
        <polygon points="26,42 158,42 194,66 62,66" fill="#bfe0f5" stroke="#376f99" stroke-width="5" stroke-linejoin="round"/>
        <polygon points="62,66 194,66 194,98 62,98" fill="#69a7d9" stroke="#376f99" stroke-width="5" stroke-linejoin="round"/>
        <polygon points="26,42 62,66 62,98 26,74" fill="#8bc1e6" stroke="#376f99" stroke-width="5" stroke-linejoin="round"/>
        <line x1="158" y1="42" x2="194" y2="66" stroke="#376f99" stroke-width="5"/>
      </svg>
    `,
    圆柱: `
      <svg class="shape-svg" viewBox="0 0 160 130" role="img" aria-label="圆柱">
        <ellipse cx="80" cy="32" rx="42" ry="18" fill="#f6aa96" stroke="#9b4b3d" stroke-width="5"/>
        <path d="M38 32v58c0 10 19 18 42 18s42-8 42-18V32" fill="#e86f55" stroke="#9b4b3d" stroke-width="5"/>
        <ellipse cx="80" cy="90" rx="42" ry="18" fill="#d95f49" stroke="#9b4b3d" stroke-width="5"/>
        <path d="M38 32c0 10 19 18 42 18s42-8 42-18" fill="none" stroke="#ffffff" stroke-width="4" opacity=".7"/>
      </svg>
    `,
  };
  return `<div class="shape-visual" data-shape="${kind}">${svgs[kind]}</div>`;
}

function planeShapeSvg(kind) {
  const svgs = {
    圆形: `<svg class="shape-svg" viewBox="0 0 140 120" role="img" aria-label="圆形"><circle cx="70" cy="60" r="42" fill="#69a7d9" stroke="#376f99" stroke-width="5"/></svg>`,
    三角形: `<svg class="shape-svg" viewBox="0 0 140 120" role="img" aria-label="三角形"><polygon points="70,18 116,98 24,98" fill="#f2b84b" stroke="#9a6c13" stroke-width="5" stroke-linejoin="round"/></svg>`,
    正方形: `<svg class="shape-svg" viewBox="0 0 140 120" role="img" aria-label="正方形"><rect x="32" y="22" width="76" height="76" fill="#8067b7" stroke="#4d4174" stroke-width="5"/></svg>`,
    长方形: `<svg class="shape-svg" viewBox="0 0 140 120" role="img" aria-label="长方形"><rect x="20" y="34" width="100" height="54" fill="#e86f55" stroke="#9b4b3d" stroke-width="5"/></svg>`,
  };
  return `<div class="shape-visual" data-shape="${kind}">${svgs[kind]}</div>`;
}

function makeQuestion(type, difficulty, prompt, answer, options, visual = "", input = "choice") {
  const meta = TYPE_META[type];
  const question = {
    id: `${type}-${Math.random().toString(16).slice(2)}`,
    type,
    typeLabel: meta.label,
    dimension: meta.dimension,
    difficulty,
    prompt,
    answer,
    options,
    referenceSeconds: meta.seconds,
    visual,
  };
  return input === "number" ? inputQuestion(question) : optionQuestion(question);
}

function normalizeQuestionVisual(visual = "") {
  return visual.replace(/\s+/g, " ").replace(/id="[^"]+"/g, "").slice(0, 260);
}

function getQuestionKey(question) {
  return [
    question.type,
    question.prompt,
    question.answer,
    normalizeQuestionVisual(question.visual),
  ].join("|");
}

function createUniqueQuestion(type, usedKeys, usedTypeAnswers) {
  let fallback = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const question = makers[type]();
    const exactKey = getQuestionKey(question);
    const typeAnswerKey = `${question.type}|${question.answer}`;
    fallback = fallback || question;
    if (!usedKeys.has(exactKey) && !usedTypeAnswers.has(typeAnswerKey)) {
      usedKeys.add(exactKey);
      usedTypeAnswers.add(typeAnswerKey);
      return question;
    }
  }
  const fallbackKey = getQuestionKey(fallback);
  usedKeys.add(fallbackKey);
  usedTypeAnswers.add(`${fallback.type}|${fallback.answer}`);
  return fallback;
}

function getSpeechText(question) {
  return (question?.prompt || "")
    .replace(/□/g, "空格")
    .replace(/\?/g, "多少")
    .replace(/\+/g, " 加 ")
    .replace(/-/g, " 减 ")
    .replace(/=/g, " 等于 ")
    .replace(/>/g, " 大于 ")
    .replace(/</g, " 小于 ")
    .replace(/\s+/g, " ")
    .trim();
}

function speakQuestion(question) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window) || !question) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(getSpeechText(question));
  utterance.lang = "zh-CN";
  utterance.rate = 0.86;
  utterance.pitch = 1.05;
  window.speechSynthesis.speak(utterance);
}

function speakCurrentQuestion() {
  if (state.screen === "test") speakQuestion(state.questions[state.index]);
  if (state.screen === "practice") speakQuestion(state.practiceQuestion);
}

function renderAndMaybeSpeak(shouldSpeak = false) {
  render();
  if (shouldSpeak && state.autoRead) window.setTimeout(speakCurrentQuestion, 120);
}

function getPublicShareUrl() {
  return window.location.href.split("#")[0];
}

function getShareImageUrl() {
  if (!window.location.protocol.startsWith("http")) return "";
  return new URL(SHARE_CONFIG.coverPath, window.location.href).href;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement("textarea");
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

async function sharePage() {
  const url = getPublicShareUrl();
  const text = `${SHARE_CONFIG.title}\n${SHARE_CONFIG.desc}\n${url}`;
  if (navigator.share && window.location.protocol.startsWith("http")) {
    try {
      await navigator.share({
        title: SHARE_CONFIG.title,
        text: SHARE_CONFIG.desc,
        url,
      });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  await copyText(text);
  alert(window.location.protocol.startsWith("http") ? "分享文案和链接已复制，可以粘贴到微信群。" : "当前还是本地文件链接，已复制文案。发布成 HTTPS 链接后，微信群里的家长才能打开。");
}

async function initWeChatShare() {
  if (!window.location.protocol.startsWith("http")) return;
  if (!SHARE_CONFIG.wechatSignatureEndpoint || !window.wx) return;
  try {
    const pageUrl = getPublicShareUrl();
    const response = await fetch(`${SHARE_CONFIG.wechatSignatureEndpoint}?url=${encodeURIComponent(pageUrl)}`);
    const signature = await response.json();
    window.wx.config({
      debug: false,
      appId: signature.appId || SHARE_CONFIG.wechatAppId,
      timestamp: signature.timestamp,
      nonceStr: signature.nonceStr,
      signature: signature.signature,
      jsApiList: ["updateAppMessageShareData", "updateTimelineShareData"],
    });
    window.wx.ready(() => {
      const message = {
        title: SHARE_CONFIG.title,
        desc: SHARE_CONFIG.desc,
        link: pageUrl,
        imgUrl: getShareImageUrl(),
      };
      window.wx.updateAppMessageShareData(message);
      window.wx.updateTimelineShareData({
        title: SHARE_CONFIG.title,
        link: pageUrl,
        imgUrl: message.imgUrl,
      });
    });
  } catch (error) {
    console.warn("微信分享配置失败", error);
  }
}

const makers = {
  count() {
    const count = rand(5, 12);
    return makeQuestion("count", "foundation", "数一数，一共有几个圆点？", count, uniqueOptions(count, 1, 16), makeDots(count));
  },
  compare() {
    const a = rand(4, 20);
    let b = rand(4, 20);
    if (a === b) b += 1;
    const answer = Math.max(a, b);
    return makeQuestion("compare", "foundation", `${a} 和 ${b}，哪个数更大？`, answer, uniqueOptions(answer, 1, 24), makeNumberLine([a, b]));
  },
  add10() {
    const a = rand(1, 8);
    const b = rand(1, 10 - a);
    return makeQuestion("add10", "foundation", `${a} + ${b} = ?`, a + b, uniqueOptions(a + b, 0, 12));
  },
  subtract10() {
    const a = rand(4, 10);
    const b = rand(1, a);
    return makeQuestion("subtract10", "foundation", `${a} - ${b} = ?`, a - b, uniqueOptions(a - b, 0, 10));
  },
  teenSense() {
    const start = rand(10, 16);
    const missingIndex = rand(1, 3);
    const numbers = [start, start + 1, start + 2, start + 3, start + 4];
    const answer = numbers[missingIndex];
    const display = numbers.map((number, index) => (index === missingIndex ? "?" : number));
    return makeQuestion("teenSense", "grade1", "找一找，问号应该是哪个数？", answer, uniqueOptions(answer, 8, 22), makeNumberLine(display));
  },
  add20() {
    const a = rand(6, 13);
    const b = rand(2, Math.min(6, 20 - a));
    return makeQuestion("add20", "grade1", `${a} + ${b} = ?`, a + b, [], "", "number");
  },
  carryAdd() {
    const pairs = [
      [8, 5],
      [9, 4],
      [7, 6],
      [8, 7],
      [9, 6],
      [6, 6],
    ];
    const [a, b] = sample(pairs);
    return makeQuestion("carryAdd", "grade1", `${a} + ${b} = ?`, a + b, [], "", "number");
  },
  makeTen() {
    const pairs = [
      [8, 5],
      [9, 6],
      [7, 5],
      [8, 6],
      [9, 4],
    ];
    const [a, b] = sample(pairs);
    const need = 10 - a;
    const rest = b - need;
    const item = sample([
      {
        prompt: "看图：左边十格里已经有一些点。还差几个点，十格就满了？",
        answer: need,
        visual: makeTenFrame(a, b),
      },
      {
        prompt: "看图：把外面的点拿去补满左边十格后，外面还剩几个点？",
        answer: rest,
        visual: makeTenFrame(a, b),
      },
    ]);
    return makeQuestion("makeTen", "grade1", item.prompt, item.answer, uniqueOptions(item.answer, 0, 9), item.visual);
  },
  decomposeSub() {
    const pairs = [
      [13, 8],
      [14, 6],
      [15, 7],
      [16, 9],
      [12, 5],
    ];
    const [a, b] = sample(pairs);
    const first = a - 10;
    const rest = b - first;
    return makeQuestion(
      "decomposeSub",
      "advanced",
      `${a} - ${b} 用拆十法，先减 ${first} 到 10，还要再减几？`,
      rest,
      uniqueOptions(rest, 1, 9),
      makeNumberLine([a, "-", first, "=", 10, "再 -", "?"]),
    );
  },
  equation() {
    const forms = [
      () => {
        const a = rand(5, 9);
        const answer = rand(3, 9);
        return { prompt: `${a} + □ = ${a + answer}，□里填几？`, answer };
      },
      () => {
        const total = rand(11, 18);
        const answer = rand(3, 9);
        return { prompt: `${total} - □ = ${total - answer}，□里填几？`, answer };
      },
      () => {
        const answer = rand(4, 9);
        const right = rand(7, 12);
        return { prompt: `□ + ${right - answer} = ${right}，□里填几？`, answer };
      },
    ];
    const item = sample(forms)();
    return makeQuestion("equation", "application", item.prompt, item.answer, [], "", "number");
  },
  expressionCompare() {
    const leftA = rand(6, 12);
    const leftB = rand(2, 7);
    const rightA = rand(5, 12);
    const rightB = rand(2, 7);
    const left = leftA + leftB;
    const right = rightA + rightB;
    const answer = left === right ? "一样大" : left > right ? "左边大" : "右边大";
    return makeQuestion(
      "expressionCompare",
      "application",
      `${leftA} + ${leftB} 和 ${rightA} + ${rightB}，哪边大？`,
      answer,
      ["左边大", "右边大", "一样大", "不能确定"],
    );
  },
  solidShape() {
    const options = ["球", "正方体", "圆柱", "长方体"];
    const answer = sample(options);
    const item = { answer, visual: solidShapeSvg(answer), prompt: "这个立体图形最像什么？" };
    return makeQuestion("solidShape", "grade1", item.prompt, item.answer, shuffle(options), item.visual);
  },
  pattern() {
    const patterns = [
      { seq: ["●", "▲", "●", "▲", "●", "?"], answer: "▲", options: ["▲", "●", "■", "5"] },
      { seq: [2, 4, 6, 8, "?"], answer: 10, options: [9, 10, 11, 12] },
      { seq: [5, 7, 9, 11, "?"], answer: 13, options: [12, 13, 14, 15] },
      { seq: [1, 2, 4, 7, 11, "?"], answer: 16, options: [14, 15, 16, 17] },
      { seq: [18, 16, 13, 9, "?"], answer: 4, options: [3, 4, 5, 6] },
      { seq: ["红", "黄", "黄", "红", "黄", "黄", "?"], answer: "红", options: ["红", "黄", "蓝", "绿"] },
    ];
    const p = sample(patterns);
    return makeQuestion("pattern", "application", "看规律，问号应该是什么？", p.answer, p.options, makeNumberLine(p.seq));
  },
  logic() {
    const items = [
      {
        prompt: "小红比小明多2颗糖，小明有7颗。小红有几颗？",
        answer: 9,
        options: uniqueOptions(9, 4, 14),
      },
      {
        prompt: "三个人排队，小明不在第一个，也不在最后一个。小明排第几？",
        answer: 2,
        options: ["1", "2", "3", "不能确定"],
      },
      {
        prompt: "一个数比10大，比13小，而且不是12。这个数是几？",
        answer: 11,
        options: ["10", "11", "12", "13"],
      },
      {
        prompt: "盒子里有红球和蓝球共9个，红球有4个，蓝球有几个？",
        answer: 5,
        options: uniqueOptions(5, 1, 9),
      },
    ];
    const item = sample(items);
    return makeQuestion("logic", "application", item.prompt, item.answer, item.options);
  },
  story() {
    const a = rand(5, 12);
    const b = rand(2, 6);
    const add = Math.random() > 0.45;
    const answer = add ? a + b : a - Math.min(b, a - 1);
    const prompt = add
      ? `小明有 ${a} 颗糖，妈妈又给了 ${b} 颗。现在一共有几颗？`
      : `小明有 ${a} 颗糖，吃掉 ${Math.min(b, a - 1)} 颗。还剩几颗？`;
    return makeQuestion("story", "application", prompt, answer, uniqueOptions(answer, 0, 20));
  },
  borrowSub() {
    const pairs = [
      [13, 5],
      [14, 8],
      [15, 7],
      [16, 9],
      [12, 6],
    ];
    const [a, b] = sample(pairs);
    return makeQuestion("borrowSub", "advanced", `${a} - ${b} = ?`, a - b, [], "", "number");
  },
  hundredSense() {
    const a = rand(28, 96);
    const answer = a + 1;
    return makeQuestion("hundredSense", "advanced", `${a} 后面的一个数是几？`, answer, uniqueOptions(answer, 20, 100));
  },
  planeShape() {
    const options = ["圆形", "三角形", "正方形", "长方形"];
    const answer = sample(options);
    return makeQuestion("planeShape", "advanced", "这个平面图形叫什么？", answer, shuffle(options), planeShapeSvg(answer));
  },
  hundredCalc() {
    const a = rand(20, 70);
    const b = sample([5, 6, 7, 8, 9, 10, 20]);
    const answer = a + b;
    return makeQuestion("hundredCalc", "advanced", `${a} + ${b} = ?`, answer, [], "", "number");
  },
};

function generateQuestions() {
  const plan = [
    "count",
    "compare",
    "add10",
    "subtract10",
    "teenSense",
    "teenSense",
    "add20",
    "makeTen",
    "solidShape",
    "pattern",
    "pattern",
    "logic",
    "logic",
    "equation",
    "expressionCompare",
    "story",
    "story",
    "borrowSub",
    "hundredSense",
    "planeShape",
  ];
  const usedKeys = new Set();
  const usedTypeAnswers = new Set();
  return shuffle(plan.map((type) => createUniqueQuestion(type, usedKeys, usedTypeAnswers)));
}

function startPractice() {
  state.practiceQuestion = makers.count();
  state.practiceAnswer = "";
  state.practiceChecked = false;
  state.screen = "practice";
  renderAndMaybeSpeak(true);
}

function checkPractice() {
  if (!state.practiceAnswer) return;
  state.practiceChecked = true;
  render();
}

function startTest() {
  window.speechSynthesis?.cancel();
  state.questions = generateQuestions();
  state.index = 0;
  state.answers = [];
  state.selectedAnswer = "";
  state.startedAt = Date.now();
  state.questionStartedAt = Date.now();
  state.screen = "test";
  state.now = Date.now();
  startTicker();
  renderAndMaybeSpeak(true);
}

function startTicker() {
  clearInterval(state.tick);
  state.tick = setInterval(() => {
    state.now = Date.now();
    if (state.screen === "test") renderTimerOnly();
  }, 1000);
}

function stopTicker() {
  clearInterval(state.tick);
  state.tick = null;
}

function elapsedSeconds(from, to = Date.now()) {
  return Math.max(0, Math.round((to - from) / 1000));
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function answerCurrent() {
  const question = state.questions[state.index];
  const rawAnswer = String(state.selectedAnswer).trim();
  if (!rawAnswer) return;
  const usedSeconds = elapsedSeconds(state.questionStartedAt);
  state.answers.push({
    question,
    answer: rawAnswer,
    correct: rawAnswer === question.answer,
    usedSeconds,
    speedRatio: usedSeconds / question.referenceSeconds,
  });
  state.selectedAnswer = "";
  if (state.index >= state.questions.length - 1) {
    finishTest();
  } else {
    state.index += 1;
    state.questionStartedAt = Date.now();
    renderAndMaybeSpeak(true);
  }
}

function finishTest() {
  window.speechSynthesis?.cancel();
  stopTicker();
  state.result = calculateResult(state.answers);
  state.screen = "result";
  render();
}

function getSpeedScore(answer) {
  if (answer.usedSeconds <= answer.question.referenceSeconds * 0.85) return 1;
  if (answer.usedSeconds <= answer.question.referenceSeconds * 1.2) return 0.88;
  if (answer.usedSeconds <= answer.question.referenceSeconds * 1.7) return 0.62;
  if (answer.usedSeconds <= answer.question.referenceSeconds * 2.4) return 0.34;
  return 0.15;
}

function groupByDimension(answers) {
  return Object.keys(DIMENSIONS).map((key) => {
    const items = answers.filter((answer) => answer.question.dimension === key);
    const correct = items.filter((answer) => answer.correct).length;
    const speed = items.length ? average(items.map(getSpeedScore)) : 0;
    return {
      key,
      name: DIMENSIONS[key],
      total: items.length,
      correct,
      accuracy: items.length ? correct / items.length : 0,
      speed,
    };
  });
}

function average(numbers) {
  if (!numbers.length) return 0;
  return numbers.reduce((sum, number) => sum + number, 0) / numbers.length;
}

function calculateResult(answers) {
  const total = answers.length;
  const correct = answers.filter((answer) => answer.correct).length;
  const accuracy = correct / total;
  const speedScore = average(answers.map(getSpeedScore));

  const grade1Answers = answers.filter((answer) => ["foundation", "grade1", "application"].includes(answer.question.difficulty));
  const advancedAnswers = answers.filter((answer) => answer.question.difficulty === "advanced");
  const foundationAnswers = answers.filter((answer) => answer.question.difficulty === "foundation");

  const grade1Accuracy = grade1Answers.filter((answer) => answer.correct).length / grade1Answers.length;
  const advancedAccuracy = advancedAnswers.filter((answer) => answer.correct).length / advancedAnswers.length;
  const foundationAccuracy = foundationAnswers.filter((answer) => answer.correct).length / foundationAnswers.length;

  const hardCorrect = answers.filter((answer) => answer.correct && ["grade1", "application", "advanced"].includes(answer.question.difficulty)).length;
  const stability = Math.min(1, 0.55 * grade1Accuracy + 0.25 * foundationAccuracy + 0.2 * Math.min(1, hardCorrect / 12));

  const score = Math.round(accuracy * 55 + speedScore * 30 + stability * 15);
  const dimensions = groupByDimension(answers);
  const slowTypes = findSlowTypes(answers);
  const weakDimensions = dimensions.filter((dimension) => dimension.total && dimension.accuracy < 0.68).map((dimension) => dimension.name);
  const totalSeconds = answers.reduce((sum, answer) => sum + answer.usedSeconds, 0);

  const level = chooseLevel({
    score,
    accuracy,
    speedScore,
    grade1Accuracy,
    advancedAccuracy,
    foundationAccuracy,
  });

  return {
    total,
    correct,
    accuracy,
    speedScore,
    stability,
    score,
    grade1Accuracy,
    advancedAccuracy,
    foundationAccuracy,
    dimensions,
    slowTypes,
    weakDimensions,
    totalSeconds,
    level,
    advice: buildAdvice(level, weakDimensions, slowTypes, foundationAccuracy, grade1Accuracy, advancedAccuracy),
  };
}

function findSlowTypes(answers) {
  const byType = {};
  answers.forEach((answer) => {
    byType[answer.question.type] ||= [];
    byType[answer.question.type].push(answer);
  });
  return Object.values(byType)
    .map((items) => ({
      label: items[0].question.typeLabel,
      ratio: average(items.map((item) => item.usedSeconds / item.question.referenceSeconds)),
    }))
    .filter((item) => item.ratio > 1.35)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3)
    .map((item) => item.label);
}

function chooseLevel(metrics) {
  const { score, grade1Accuracy, advancedAccuracy, foundationAccuracy, speedScore } = metrics;
  if (foundationAccuracy < 0.6 || score < 58) {
    return {
      name: "需要再多加准备",
      summary: "基础数感或10以内加减还不够稳，暑假适合先把底座补扎实。",
    };
  }
  if (score < 72 || grade1Accuracy < 0.68) {
    return {
      name: "可以平稳过渡到小学",
      summary: "基础项已经有支撑，20以内内容和熟练度还需要继续练。",
    };
  }
  if (score < 84 || grade1Accuracy < 0.78) {
    return {
      name: "丝滑顺利进入小学",
      summary: "一年级上册前半内容衔接不错，课堂跟进压力会比较小。",
    };
  }
  if (score < 91 || advancedAccuracy < 0.45) {
    return {
      name: "已经超额完成入学任务",
      summary: "20以内数感、计算和应用理解比较稳，可以适当增加综合题。",
    };
  }
  if (score < 96 || advancedAccuracy < 0.72 || speedScore < 0.62) {
    return {
      name: "已经接近小学一年级水平",
      summary: "一年级上册核心内容掌握较好，下册基础内容也有明显表现。",
    };
  }
  return {
    name: "简直是天才小学生",
    summary: "上册内容熟练，下册数感或计算也能应对，超前表现非常亮眼。",
  };
}

function buildAdvice(level, weakDimensions, slowTypes, foundationAccuracy, grade1Accuracy, advancedAccuracy) {
  const strengths = [];
  const nextSteps = [];

  if (foundationAccuracy >= 0.85) strengths.push("入学基础比较稳，数数、比较和10以内加减能支撑一年级开学。");
  if (grade1Accuracy >= 0.8) strengths.push("20以内数感和一年级上册衔接题表现不错。");
  if (advancedAccuracy >= 0.6) strengths.push("已经能碰到一年级下册的部分内容，属于明显超前信号。");
  if (!strengths.length) strengths.push("已经能完成一整套测评，说明孩子具备参与正式学习任务的基础耐心。");

  if (weakDimensions.length) nextSteps.push(`优先练习：${weakDimensions.join("、")}。`);
  if (slowTypes.length) nextSteps.push(`这些题型可以做少量限时熟练练习：${slowTypes.join("、")}。`);
  if (foundationAccuracy < 0.7) nextSteps.push("暑假建议每天10-15分钟做数量对应、10以内分合和口头加减，必要时可考虑系统辅导。");
  else if (grade1Accuracy < 0.75) nextSteps.push("暑假建议重点练20以内数的顺序、分解和简单进位加法。");
  else nextSteps.push("暑假可以用生活购物、分糖果、搭积木等方式练应用题，不必过度刷题。");

  return {
    reason: level.summary,
    strengths,
    nextSteps,
  };
}

function renderHome() {
  app.innerHTML = `
    <section class="hero">
      <div class="topbar">
        <div class="brand"><span class="brand-mark">数</span><span>小学数学入学准备测评</span></div>
        <span class="pill">普通公立小学 · 一年级衔接</span>
      </div>
      <div class="hero-grid">
        <div class="hero-copy">
          <h1>测一测，孩子能不能顺利接上一年级数学</h1>
          <p class="lead">约5-7分钟完成20题。建议家长帮助朗读题目，孩子口头回答，家长代为点击或输入答案，这样更能测到孩子真实的理解和表达。</p>
          <div class="actions">
            <button class="primary" data-action="practice">试做一题</button>
            <button class="secondary" data-action="start">正式开始</button>
            <button class="secondary" data-action="preview">查看评级标准</button>
            <button class="ghost" data-action="share-page">分享给家长</button>
          </div>
          <div class="parent-guide">
            <div class="guide-step"><strong>1. 家长读题</strong><span>按屏幕题目原意读给孩子听，必要时可以慢读一遍。</span></div>
            <div class="guide-step"><strong>2. 孩子口答</strong><span>让孩子说出答案或讲一讲想法，不把操作手机作为考点。</span></div>
            <div class="guide-step"><strong>3. 家长录入</strong><span>家长根据孩子回答点击选项或输入数字，系统自动计时评分。</span></div>
          </div>
          <div class="standards">
            <div class="standard-item"><strong>55% 正确率</strong><span>判断知识掌握是否稳，尤其关注一年级上册核心内容。</span></div>
            <div class="standard-item"><strong>30% 用时表现</strong><span>不同题型单独计时，基础题更看熟练度，应用题允许思考。</span></div>
            <div class="standard-item"><strong>15% 稳定与难度</strong><span>结合基础题稳定性、挑战题突破和短板分布。</span></div>
          </div>
        </div>
        <div class="visual-board" aria-hidden="true">
          <div class="number-path">
            <span class="bubble">5</span>
            <span class="bubble">10</span>
            <span class="bubble">20</span>
            <span class="bubble">+</span>
            <span class="bubble">?</span>
          </div>
          <div class="board-note">
            <strong>题目会随机变化</strong>
            <span>系统按题型模板生成20题，每次的数字、选项、部分情境和图形会不同。</span>
          </div>
        </div>
      </div>
      <p class="footer-hint">结果仅用于家庭观察和暑假练习规划，不作为医学或教育诊断。</p>
    </section>
  `;
}

function renderPractice() {
  const question = state.practiceQuestion;
  const correct = state.practiceAnswer === question.answer;
  app.innerHTML = `
    <section class="test-layout">
      <div class="test-topbar">
        <div class="brand"><span class="brand-mark">试</span><span>试做一题</span></div>
        <button class="secondary" data-action="start">正式开始</button>
      </div>
      <article class="question-card">
        <div class="question-meta">
          <span class="tag">不计分</span>
          <span class="tag alt">${question.typeLabel}</span>
          <button class="read-button" data-action="read-question" type="button">再读一遍题目</button>
        </div>
        <h2 class="question-title">${question.prompt}</h2>
        <div class="question-visual ${question.visual ? "" : "hidden"}">${question.visual}</div>
        <div class="answer-area">${renderPracticeInput(question)}</div>
        ${
          state.practiceChecked
            ? `<div class="practice-feedback ${correct ? "ok" : "bad"}">${correct ? "答对啦，可以开始正式测评。" : `这题正确答案是 ${question.answer}，再进入正式测评也没关系。`}</div>`
            : ""
        }
        <div class="question-actions">
          <button class="secondary" data-action="home">返回首页</button>
          <button class="primary" data-action="${state.practiceChecked ? "start" : "check-practice"}">${state.practiceChecked ? "正式开始" : "看看结果"}</button>
        </div>
      </article>
    </section>
  `;
}

function renderPracticeInput(question) {
  return `
    <div class="options">
      ${question.options
        .map(
          (option) => `
            <button class="option ${state.practiceAnswer === option ? "selected" : ""}" data-practice-answer="${option}">
              ${option}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderStandards() {
  app.innerHTML = `
    <section class="shell">
      <div class="topbar">
        <div class="brand"><span class="brand-mark">标</span><span>评级标准</span></div>
        <button class="secondary" data-action="home">返回首页</button>
      </div>
      <div class="result-card">
        <h1 class="level">怎么判断准备度？</h1>
        <p class="lead">一年级上册是主线，下册只看超前。20以内内容在本测评中属于重要入学准备项。</p>
        <div class="score-row">
          <div class="stat"><strong>55%</strong><span>正确率</span></div>
          <div class="stat"><strong>30%</strong><span>按题型用时</span></div>
          <div class="stat"><strong>15%</strong><span>难度与稳定性</span></div>
          <div class="stat"><strong>6级</strong><span>准备度等级</span></div>
        </div>
      </div>
      <div class="report-grid">
        ${[
          ["需要再多加准备", "基础数感或10以内加减不稳定，先补数量对应和分合。"],
          ["可以平稳过渡到小学", "基础项较稳，20以内内容仍需暑假巩固。"],
          ["丝滑顺利进入小学", "一年级上册前半内容掌握不错，速度正常。"],
          ["已经超额完成入学任务", "20以内与进位加法表现稳定，可增加应用题。"],
          ["已经接近小学一年级水平", "上册核心内容大多掌握，下册基础题也有表现。"],
          ["简直是天才小学生", "上册熟练，下册数感或计算也表现突出。"],
        ]
          .map(([title, text]) => `<div class="mini-card"><h3>${title}</h3><p>${text}</p></div>`)
          .join("")}
      </div>
    </section>
  `;
}

function renderTest() {
  const question = state.questions[state.index];
  const totalElapsed = elapsedSeconds(state.startedAt, state.now);
  const questionElapsed = elapsedSeconds(state.questionStartedAt, state.now);
  const progress = Math.round((state.index / state.questions.length) * 100);
  app.innerHTML = `
    <section class="test-layout">
      <div class="test-topbar">
        <div class="brand"><span class="brand-mark">${state.index + 1}</span><span>第 ${state.index + 1} / ${state.questions.length} 题</span></div>
        <button class="ghost" data-action="restart">重新开始</button>
      </div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${progress}%"></div></div>
      <div class="test-main">
        <article class="question-card">
          <div class="question-meta">
            <span class="tag">${question.typeLabel}</span>
            <span class="tag alt">${difficultyLabel(question.difficulty)}</span>
            <span class="tag hot">参考 ${question.referenceSeconds} 秒</span>
            <button class="read-button" data-action="read-question" type="button">再读一遍题目</button>
          </div>
          <h2 class="question-title">${question.prompt}</h2>
          <div class="question-visual ${question.visual ? "" : "hidden"}">${question.visual}</div>
          <div class="answer-area">
            ${renderAnswerInput(question)}
          </div>
          <div class="question-actions">
            <button class="secondary" data-action="skip">跳过这题</button>
            <button class="primary" data-action="next" ${state.selectedAnswer ? "" : "disabled"}>提交答案</button>
          </div>
        </article>
        <aside class="panel">
          <div>
            <p class="small">总用时</p>
            <div class="timer" data-total-timer>${formatTime(totalElapsed)}</div>
          </div>
          <div>
            <p class="small">本题用时</p>
            <div class="timer" data-question-timer>${formatTime(questionElapsed)}</div>
          </div>
          <div class="stat-grid">
            <div class="stat"><strong>${state.answers.length}</strong><span>已完成</span></div>
            <div class="stat"><strong>${state.answers.filter((answer) => answer.correct).length}</strong><span>已答对</span></div>
          </div>
          <p class="small">基础题会更看熟练度；应用题、规律题会给孩子更多思考空间。</p>
        </aside>
      </div>
    </section>
  `;
}

function renderAnswerInput(question) {
  if (question.input === "number") {
    return `<input class="number-input" inputmode="numeric" pattern="[0-9]*" data-answer-input placeholder="输入答案" value="${state.selectedAnswer}" />`;
  }
  return `
    <div class="options">
      ${question.options
        .map(
          (option) => `
            <button class="option ${state.selectedAnswer === option ? "selected" : ""}" data-answer="${option}">
              ${option}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function difficultyLabel(difficulty) {
  return {
    foundation: "入学基础",
    grade1: "上册衔接",
    application: "应用理解",
    advanced: "超前观察",
  }[difficulty];
}

function renderTimerOnly() {
  const totalTimer = document.querySelector("[data-total-timer]");
  const questionTimer = document.querySelector("[data-question-timer]");
  if (totalTimer) totalTimer.textContent = formatTime(elapsedSeconds(state.startedAt, state.now));
  if (questionTimer) questionTimer.textContent = formatTime(elapsedSeconds(state.questionStartedAt, state.now));
}

function renderResult() {
  const result = state.result;
  const mistakes = state.answers.filter((answer) => !answer.correct);
  app.innerHTML = `
    <section class="result-layout">
      <div class="topbar">
        <div class="brand"><span class="brand-mark">果</span><span>测评结果</span></div>
        <div class="actions">
          <button class="secondary" data-action="restart">再测一次</button>
          <button class="primary" data-action="copy">复制结果文案</button>
        </div>
      </div>
      <div class="result-hero">
        <article class="result-card">
          <p class="pill">普通公立小学一年级衔接参考</p>
          <h1 class="level">${result.level.name}</h1>
          <p class="lead">${result.level.summary}</p>
          <div class="score-row">
            <div class="stat"><strong>${result.score}</strong><span>综合分</span></div>
            <div class="stat"><strong>${Math.round(result.accuracy * 100)}%</strong><span>正确率</span></div>
            <div class="stat"><strong>${Math.round(result.speedScore * 100)}%</strong><span>速度表现</span></div>
            <div class="stat"><strong>${formatTime(result.totalSeconds)}</strong><span>总用时</span></div>
          </div>
        </article>
        <aside class="poster" id="poster">
          <div class="poster-inner">
            <div>
              <div class="poster-title">小学数学入学准备测评</div>
              <div class="poster-level">${result.level.name}</div>
              <p class="small">${result.level.summary}</p>
            </div>
            <div class="stat-grid">
              <div class="stat"><strong>${result.score}</strong><span>综合分</span></div>
              <div class="stat"><strong>${Math.round(result.accuracy * 100)}%</strong><span>正确率</span></div>
              <div class="stat"><strong>${Math.round(result.speedScore * 100)}%</strong><span>速度</span></div>
              <div class="stat"><strong>${formatTime(result.totalSeconds)}</strong><span>用时</span></div>
            </div>
            <div>
              <div class="qr">QR</div>
              <p class="small">分享到家长群，邀请更多孩子一起测一测。</p>
            </div>
          </div>
        </aside>
      </div>
      <div class="report-grid">
        <div class="mini-card">
          <h3>能力画像</h3>
          <div class="dimension-list">
            ${result.dimensions.map(renderDimension).join("")}
          </div>
        </div>
        <div class="mini-card">
          <h3>为什么是这个等级</h3>
          <p>${result.advice.reason}</p>
          <p class="small">一年级上册是主要评分依据，下册题只用于识别超前表现。</p>
        </div>
        <div class="mini-card">
          <h3>孩子的优势</h3>
          <ul>${result.advice.strengths.map((item) => `<li>${item}</li>`).join("")}</ul>
        </div>
        <div class="mini-card">
          <h3>暑假怎么练</h3>
          <ul>${result.advice.nextSteps.map((item) => `<li>${item}</li>`).join("")}</ul>
        </div>
        <div class="mini-card">
          <h3>用时观察</h3>
          <p>${result.slowTypes.length ? `相对偏慢的题型：${result.slowTypes.join("、")}。` : "整体速度表现比较均衡，没有特别突出的慢项。"}</p>
        </div>
        <div class="mini-card">
          <h3>超前信号</h3>
          <p>${Math.round(result.advancedAccuracy * 100)}% 的超前观察题答对。${result.advancedAccuracy >= 0.6 ? "可以适当接触一年级下册基础内容。" : "目前先巩固一年级上册核心内容更合适。"}</p>
        </div>
        <div class="mini-card review-card">
          <h3>错题复盘</h3>
          ${
            mistakes.length
              ? `<div class="mistake-list">${mistakes.map(renderMistake).join("")}</div>`
              : `<p>这次没有错题，基础状态很漂亮。可以重点观察速度和表达是否稳定。</p>`
          }
        </div>
      </div>
    </section>
  `;
}

function renderMistake(answer, index) {
  return `
    <details class="mistake-item">
      <summary>
        <span>错题 ${index + 1}</span>
        <strong>${answer.question.typeLabel}</strong>
      </summary>
      <div class="mistake-body">
        <p>${answer.question.prompt}</p>
        <div class="${answer.question.visual ? "" : "hidden"}">${answer.question.visual}</div>
        <div class="answer-compare">
          <span>孩子答案：<strong>${answer.answer}</strong></span>
          <span>正确答案：<strong>${answer.question.answer}</strong></span>
        </div>
      </div>
    </details>
  `;
}

function renderDimension(dimension) {
  const value = Math.round(dimension.accuracy * 100);
  return `
    <div class="dimension">
      <div class="dimension-head"><span>${dimension.name}</span><strong>${dimension.total ? `${value}%` : "未测"}</strong></div>
      <div class="bar"><span style="width:${dimension.total ? value : 0}%"></span></div>
    </div>
  `;
}

function copyResult() {
  const result = state.result;
  const text = `小学数学入学准备测评结果：${result.level.name}
综合分：${result.score}分
正确率：${Math.round(result.accuracy * 100)}%
总用时：${formatTime(result.totalSeconds)}
结论：${result.level.summary}
暑假建议：${result.advice.nextSteps.join(" ")}`;
  navigator.clipboard?.writeText(text);
  alert("结果文案已复制，可以粘贴分享。");
}

function render() {
  if (state.screen === "home") renderHome();
  if (state.screen === "practice") renderPractice();
  if (state.screen === "standards") renderStandards();
  if (state.screen === "test") renderTest();
  if (state.screen === "result") renderResult();
}

app.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  const answer = event.target.closest("[data-answer]")?.dataset.answer;
  const practiceAnswer = event.target.closest("[data-practice-answer]")?.dataset.practiceAnswer;
  if (practiceAnswer !== undefined) {
    state.practiceAnswer = practiceAnswer;
    state.practiceChecked = false;
    render();
    return;
  }
  if (answer !== undefined) {
    state.selectedAnswer = answer;
    render();
    return;
  }
  if (!action) return;
  if (action === "practice") startPractice();
  if (action === "check-practice") checkPractice();
  if (action === "read-question") speakCurrentQuestion();
  if (action === "share-page") sharePage();
  if (action === "start") startTest();
  if (action === "preview") {
    window.speechSynthesis?.cancel();
    state.screen = "standards";
    render();
  }
  if (action === "home") {
    window.speechSynthesis?.cancel();
    state.screen = "home";
    render();
  }
  if (action === "restart") {
    window.speechSynthesis?.cancel();
    stopTicker();
    state.screen = "home";
    render();
  }
  if (action === "skip") {
    state.selectedAnswer = "（跳过）";
    answerCurrent();
  }
  if (action === "next") answerCurrent();
  if (action === "copy") copyResult();
});

app.addEventListener("input", (event) => {
  if (event.target.matches("[data-answer-input]")) {
    state.selectedAnswer = event.target.value.replace(/[^\d]/g, "");
    event.target.value = state.selectedAnswer;
    const button = document.querySelector('[data-action="next"]');
    if (button) button.disabled = !state.selectedAnswer;
  }
});

app.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && state.screen === "test" && state.selectedAnswer) answerCurrent();
});

render();
initWeChatShare();
