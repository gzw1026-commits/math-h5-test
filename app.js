(function () {
  "use strict";

  var app = document.getElementById("app");
  if (!app) return;

  var SHARE_CONFIG = {
    title: "小学数学入学准备测评",
    desc: "5-7分钟测一测孩子的20以内数感、10以内加减理解、图形方位、规律分类和简单应用表达。",
    coverPath: "share-cover.svg",
    wechatAppId: "",
    wechatSignatureEndpoint: "",
  };

  var DIMENSIONS = {
    numberSense: "数感与数量",
    calculation: "计算熟练度",
    geometry: "图形认知",
    application: "应用理解",
    advanced: "超前观察",
  };

  var TYPE_META = {
    count: { label: "数数与数量", seconds: 14, dimension: "numberSense" },
    compare: { label: "数字比较", seconds: 12, dimension: "numberSense" },
    add10: { label: "10以内加法", seconds: 15, dimension: "calculation" },
    subtract10: { label: "10以内减法", seconds: 16, dimension: "calculation" },
    teenSense: { label: "11-20数感", seconds: 16, dimension: "numberSense" },
    add20: { label: "20以内加法", seconds: 20, dimension: "calculation" },
    makeTen: { label: "凑十看图", seconds: 24, dimension: "calculation" },
    equation: { label: "算式填空", seconds: 26, dimension: "application" },
    expressionCompare: { label: "式子比较", seconds: 26, dimension: "application" },
    solidShape: { label: "立体图形", seconds: 15, dimension: "geometry" },
    pattern: { label: "规律推理", seconds: 24, dimension: "application" },
    logic: { label: "逻辑推理", seconds: 32, dimension: "application" },
    story: { label: "生活应用题", seconds: 30, dimension: "application" },
    borrowSub: { label: "退位减法", seconds: 26, dimension: "advanced" },
    hundredSense: { label: "100以内数感", seconds: 22, dimension: "advanced" },
    planeShape: { label: "平面图形", seconds: 14, dimension: "advanced" },
  };

  var state = {
    screen: "home",
    questions: [],
    index: 0,
    answers: [],
    selectedAnswer: "",
    startedAt: 0,
    questionStartedAt: 0,
    tick: null,
    now: new Date().getTime(),
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
    var copy = array.slice();
    var i;
    var j;
    var temp;
    for (i = copy.length - 1; i > 0; i -= 1) {
      j = rand(0, i);
      temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function hasOwn(array, value) {
    return array.indexOf(String(value)) !== -1;
  }

  function uniqueOptions(answer, min, max, count) {
    var target = count || 4;
    var values = [String(answer)];
    var offset;
    var next;
    var guard = 0;
    while (values.length < target && guard < 80) {
      offset = sample([-3, -2, -1, 1, 2, 3, 4]);
      next = Math.max(min, Math.min(max, Number(answer) + offset));
      if (!hasOwn(values, next)) values.push(String(next));
      guard += 1;
    }
    return shuffle(values);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function optionQuestion(base) {
    var options = [];
    var i;
    for (i = 0; i < base.options.length; i += 1) options.push(String(base.options[i]));
    base.input = "choice";
    base.options = options;
    base.answer = String(base.answer);
    return base;
  }

  function inputQuestion(base) {
    base.input = "number";
    base.answer = String(base.answer);
    return base;
  }

  function makeDots(count) {
    var html = '<div class="dots">';
    var i;
    for (i = 0; i < count; i += 1) html += '<span class="dot"></span>';
    return html + "</div>";
  }

  function makeTenFrame(filled, extra) {
    var cells = "";
    var extras = "";
    var i;
    for (i = 0; i < 10; i += 1) {
      cells += '<span class="ten-cell">' + (i < filled ? '<span class="dot ten-dot"></span>' : "") + "</span>";
    }
    for (i = 0; i < extra; i += 1) extras += '<span class="dot extra-dot"></span>';
    return '<div class="ten-visual"><div class="ten-frame">' + cells + '</div><div class="extra-dots">' + extras + "</div></div>";
  }

  function makeNumberLine(numbers) {
    var html = '<div class="number-line">';
    var i;
    for (i = 0; i < numbers.length; i += 1) html += '<span class="num-chip">' + escapeHtml(numbers[i]) + "</span>";
    return html + "</div>";
  }

  function solidShapeSvg(kind) {
    var svgs = {
      球:
        '<svg class="shape-svg" viewBox="0 0 160 130" role="img" aria-label="球"><defs><radialGradient id="sphereGradient" cx="34%" cy="30%" r="70%"><stop offset="0%" stop-color="#ffffff"/><stop offset="38%" stop-color="#87c3ed"/><stop offset="100%" stop-color="#3779aa"/></radialGradient></defs><circle cx="80" cy="65" r="48" fill="url(#sphereGradient)" stroke="#2f668f" stroke-width="5"/><path d="M42 62c22 14 55 16 82 0" fill="none" stroke="#ffffff" stroke-width="5" opacity=".7"/></svg>',
      正方体:
        '<svg class="shape-svg" viewBox="0 0 160 130" role="img" aria-label="正方体"><polygon points="52,34 98,34 122,58 76,58" fill="#b5a4e8" stroke="#4d4174" stroke-width="5" stroke-linejoin="round"/><polygon points="76,58 122,58 122,104 76,104" fill="#8067b7" stroke="#4d4174" stroke-width="5" stroke-linejoin="round"/><polygon points="52,34 76,58 76,104 52,80" fill="#9784d2" stroke="#4d4174" stroke-width="5" stroke-linejoin="round"/><line x1="52" y1="80" x2="98" y2="80" stroke="#4d4174" stroke-width="5"/><line x1="98" y1="34" x2="122" y2="58" stroke="#4d4174" stroke-width="5"/></svg>',
      长方体:
        '<svg class="shape-svg wide-shape-svg" viewBox="0 0 220 130" role="img" aria-label="长方体"><polygon points="26,42 158,42 194,66 62,66" fill="#bfe0f5" stroke="#376f99" stroke-width="5" stroke-linejoin="round"/><polygon points="62,66 194,66 194,98 62,98" fill="#69a7d9" stroke="#376f99" stroke-width="5" stroke-linejoin="round"/><polygon points="26,42 62,66 62,98 26,74" fill="#8bc1e6" stroke="#376f99" stroke-width="5" stroke-linejoin="round"/><line x1="158" y1="42" x2="194" y2="66" stroke="#376f99" stroke-width="5"/></svg>',
      圆柱:
        '<svg class="shape-svg" viewBox="0 0 160 130" role="img" aria-label="圆柱"><ellipse cx="80" cy="32" rx="42" ry="18" fill="#f6aa96" stroke="#9b4b3d" stroke-width="5"/><path d="M38 32v58c0 10 19 18 42 18s42-8 42-18V32" fill="#e86f55" stroke="#9b4b3d" stroke-width="5"/><ellipse cx="80" cy="90" rx="42" ry="18" fill="#d95f49" stroke="#9b4b3d" stroke-width="5"/><path d="M38 32c0 10 19 18 42 18s42-8 42-18" fill="none" stroke="#ffffff" stroke-width="4" opacity=".7"/></svg>',
    };
    return '<div class="shape-visual" data-shape="' + kind + '">' + svgs[kind] + "</div>";
  }

  function planeShapeSvg(kind) {
    var svgs = {
      圆形: '<svg class="shape-svg" viewBox="0 0 140 120" role="img" aria-label="圆形"><circle cx="70" cy="60" r="42" fill="#69a7d9" stroke="#376f99" stroke-width="5"/></svg>',
      三角形: '<svg class="shape-svg" viewBox="0 0 140 120" role="img" aria-label="三角形"><polygon points="70,18 116,98 24,98" fill="#f2b84b" stroke="#9a6c13" stroke-width="5" stroke-linejoin="round"/></svg>',
      正方形: '<svg class="shape-svg" viewBox="0 0 140 120" role="img" aria-label="正方形"><rect x="32" y="22" width="76" height="76" fill="#8067b7" stroke="#4d4174" stroke-width="5"/></svg>',
      长方形: '<svg class="shape-svg" viewBox="0 0 140 120" role="img" aria-label="长方形"><rect x="20" y="34" width="100" height="54" fill="#e86f55" stroke="#9b4b3d" stroke-width="5"/></svg>',
    };
    return '<div class="shape-visual" data-shape="' + kind + '">' + svgs[kind] + "</div>";
  }

  function makeQuestion(type, difficulty, prompt, answer, options, visual, input) {
    var meta = TYPE_META[type];
    var question = {
      id: type + "-" + Math.random().toString(16).slice(2),
      type: type,
      typeLabel: meta.label,
      dimension: meta.dimension,
      difficulty: difficulty,
      prompt: prompt,
      answer: answer,
      options: options || [],
      referenceSeconds: meta.seconds,
      visual: visual || "",
    };
    return input === "number" ? inputQuestion(question) : optionQuestion(question);
  }

  function normalizeQuestionVisual(visual) {
    return String(visual || "").replace(/\s+/g, " ").replace(/id="[^"]+"/g, "").slice(0, 260);
  }

  function getQuestionKey(question) {
    return [question.type, question.prompt, question.answer, normalizeQuestionVisual(question.visual)].join("|");
  }

  function createUniqueQuestion(type, usedKeys, usedTypeAnswers) {
    var fallback = null;
    var attempt;
    var question;
    var exactKey;
    var typeAnswerKey;
    for (attempt = 0; attempt < 40; attempt += 1) {
      question = makers[type]();
      exactKey = getQuestionKey(question);
      typeAnswerKey = question.type + "|" + question.answer;
      if (!fallback) fallback = question;
      if (!usedKeys[exactKey] && !usedTypeAnswers[typeAnswerKey]) {
        usedKeys[exactKey] = true;
        usedTypeAnswers[typeAnswerKey] = true;
        return question;
      }
    }
    exactKey = getQuestionKey(fallback);
    usedKeys[exactKey] = true;
    usedTypeAnswers[fallback.type + "|" + fallback.answer] = true;
    return fallback;
  }

  function speechSupported() {
    try {
      return !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
    } catch (error) {
      return false;
    }
  }

  function safeCancelSpeech() {
    try {
      if (window.speechSynthesis && window.speechSynthesis.cancel) window.speechSynthesis.cancel();
    } catch (error) {}
  }

  function getSpeechText(question) {
    return String(question && question.prompt ? question.prompt : "")
      .replace(/□/g, "空格")
      .replace(/\?/g, "多少")
      .replace(/\+/g, " 加 ")
      .replace(/-/g, " 减 ")
      .replace(/=/g, " 等于 ")
      .replace(/>/g, " 大于 ")
      .replace(/</g, " 小于 ")
      .replace(/\s+/g, " ")
      .replace(/^\s+|\s+$/g, "");
  }

  function speakQuestion(question) {
    try {
      if (!speechSupported() || !question) return;
      safeCancelSpeech();
      var utterance = new window.SpeechSynthesisUtterance(getSpeechText(question));
      utterance.lang = "zh-CN";
      utterance.rate = 0.86;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch (error) {}
  }

  function speakCurrentQuestion() {
    if (!speechSupported()) {
      alert("当前微信环境不支持朗读，请家长帮助读题。");
      return;
    }
    if (state.screen === "test") speakQuestion(state.questions[state.index]);
    if (state.screen === "practice") speakQuestion(state.practiceQuestion);
  }

  function renderAndMaybeSpeak(shouldSpeak) {
    render();
    if (shouldSpeak && state.autoRead && speechSupported()) {
      window.setTimeout(speakCurrentQuestion, 120);
    }
  }

  function getPublicShareUrl() {
    try {
      return window.location.href.split("#")[0];
    } catch (error) {
      return "";
    }
  }

  function isHttpPage() {
    try {
      return window.location.protocol.indexOf("http") === 0;
    } catch (error) {
      return false;
    }
  }

  function getShareImageUrl() {
    try {
      if (!isHttpPage()) return "";
      return new URL(SHARE_CONFIG.coverPath, window.location.href).href;
    } catch (error) {
      return "";
    }
  }

  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {});
        return true;
      }
    } catch (error) {}
    try {
      var input = document.createElement("textarea");
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      return true;
    } catch (error2) {
      return false;
    }
  }

  function sharePage() {
    var url = getPublicShareUrl();
    var text = SHARE_CONFIG.title + "\n" + SHARE_CONFIG.desc + "\n" + url;
    try {
      if (navigator.share && isHttpPage()) {
        navigator
          .share({ title: SHARE_CONFIG.title, text: SHARE_CONFIG.desc, url: url })
          .catch(function () {});
        return;
      }
    } catch (error) {}
    copyText(text);
    alert(isHttpPage() ? "分享文案和链接已复制，可以粘贴到微信群。" : "当前还是本地文件链接，已复制文案。发布成 HTTPS 链接后，微信群里的家长才能打开。");
  }

  function initWeChatShare() {
    try {
      if (!isHttpPage()) return;
      if (!SHARE_CONFIG.wechatSignatureEndpoint || !window.wx || !window.fetch) return;
      var pageUrl = getPublicShareUrl();
      window
        .fetch(SHARE_CONFIG.wechatSignatureEndpoint + "?url=" + encodeURIComponent(pageUrl))
        .then(function (response) {
          return response.json();
        })
        .then(function (signature) {
          window.wx.config({
            debug: false,
            appId: signature.appId || SHARE_CONFIG.wechatAppId,
            timestamp: signature.timestamp,
            nonceStr: signature.nonceStr,
            signature: signature.signature,
            jsApiList: ["updateAppMessageShareData", "updateTimelineShareData"],
          });
          window.wx.ready(function () {
            var imageUrl = getShareImageUrl();
            window.wx.updateAppMessageShareData({
              title: SHARE_CONFIG.title,
              desc: SHARE_CONFIG.desc,
              link: pageUrl,
              imgUrl: imageUrl,
            });
            window.wx.updateTimelineShareData({
              title: SHARE_CONFIG.title,
              link: pageUrl,
              imgUrl: imageUrl,
            });
          });
        })
        .catch(function () {});
    } catch (error) {}
  }

  var makers = {
    count: function () {
      var count = rand(5, 12);
      return makeQuestion("count", "foundation", "数一数，一共有几个圆点？", count, uniqueOptions(count, 1, 16), makeDots(count));
    },
    compare: function () {
      var a = rand(4, 20);
      var b = rand(4, 20);
      var answer;
      if (a === b) b += 1;
      answer = Math.max(a, b);
      return makeQuestion("compare", "foundation", a + " 和 " + b + "，哪个数更大？", answer, uniqueOptions(answer, 1, 24), makeNumberLine([a, b]));
    },
    add10: function () {
      var a = rand(1, 8);
      var b = rand(1, 10 - a);
      return makeQuestion("add10", "foundation", a + " + " + b + " = ?", a + b, uniqueOptions(a + b, 0, 12));
    },
    subtract10: function () {
      var a = rand(4, 10);
      var b = rand(1, a);
      return makeQuestion("subtract10", "foundation", a + " - " + b + " = ?", a - b, uniqueOptions(a - b, 0, 10));
    },
    teenSense: function () {
      var start = rand(10, 16);
      var missingIndex = rand(1, 3);
      var numbers = [start, start + 1, start + 2, start + 3, start + 4];
      var answer = numbers[missingIndex];
      var display = numbers.slice();
      display[missingIndex] = "?";
      return makeQuestion("teenSense", "grade1", "找一找，问号应该是哪个数？", answer, uniqueOptions(answer, 8, 22), makeNumberLine(display));
    },
    add20: function () {
      var a = rand(6, 13);
      var b = rand(2, Math.min(6, 20 - a));
      return makeQuestion("add20", "grade1", a + " + " + b + " = ?", a + b, [], "", "number");
    },
    makeTen: function () {
      var pair = sample([
        [8, 5],
        [9, 6],
        [7, 5],
        [8, 6],
        [9, 4],
      ]);
      var a = pair[0];
      var b = pair[1];
      var need = 10 - a;
      var rest = b - need;
      var item = sample([
        { prompt: "看图：左边十格里已经有一些点。还差几个点，十格就满了？", answer: need, visual: makeTenFrame(a, b) },
        { prompt: "看图：把外面的点拿去补满左边十格后，外面还剩几个点？", answer: rest, visual: makeTenFrame(a, b) },
      ]);
      return makeQuestion("makeTen", "grade1", item.prompt, item.answer, uniqueOptions(item.answer, 0, 9), item.visual);
    },
    equation: function () {
      var form = sample([1, 2, 3]);
      var a;
      var answer;
      var total;
      var right;
      if (form === 1) {
        a = rand(5, 9);
        answer = rand(3, 9);
        return makeQuestion("equation", "application", a + " + □ = " + (a + answer) + "，□里填几？", answer, [], "", "number");
      }
      if (form === 2) {
        total = rand(11, 18);
        answer = rand(3, 9);
        return makeQuestion("equation", "application", total + " - □ = " + (total - answer) + "，□里填几？", answer, [], "", "number");
      }
      answer = rand(4, 9);
      right = rand(7, 12);
      return makeQuestion("equation", "application", "□ + " + (right - answer) + " = " + right + "，□里填几？", answer, [], "", "number");
    },
    expressionCompare: function () {
      var leftA = rand(6, 12);
      var leftB = rand(2, 7);
      var rightA = rand(5, 12);
      var rightB = rand(2, 7);
      var left = leftA + leftB;
      var right = rightA + rightB;
      var answer = left === right ? "一样大" : left > right ? "左边大" : "右边大";
      return makeQuestion("expressionCompare", "application", leftA + " + " + leftB + " 和 " + rightA + " + " + rightB + "，哪边大？", answer, ["左边大", "右边大", "一样大", "不能确定"]);
    },
    solidShape: function () {
      var options = ["球", "正方体", "圆柱", "长方体"];
      var answer = sample(options);
      return makeQuestion("solidShape", "grade1", "这个立体图形最像什么？", answer, shuffle(options), solidShapeSvg(answer));
    },
    pattern: function () {
      var patterns = [
        { seq: ["●", "▲", "●", "▲", "●", "?"], answer: "▲", options: ["▲", "●", "■", "5"] },
        { seq: [2, 4, 6, 8, "?"], answer: 10, options: [9, 10, 11, 12] },
        { seq: [5, 7, 9, 11, "?"], answer: 13, options: [12, 13, 14, 15] },
        { seq: [1, 2, 4, 7, 11, "?"], answer: 16, options: [14, 15, 16, 17] },
        { seq: [18, 16, 13, 9, "?"], answer: 4, options: [3, 4, 5, 6] },
        { seq: ["红", "黄", "黄", "红", "黄", "黄", "?"], answer: "红", options: ["红", "黄", "蓝", "绿"] },
      ];
      var p = sample(patterns);
      return makeQuestion("pattern", "application", "看规律，问号应该是什么？", p.answer, p.options, makeNumberLine(p.seq));
    },
    logic: function () {
      var items = [
        { prompt: "小红比小明多2颗糖，小明有7颗。小红有几颗？", answer: 9, options: uniqueOptions(9, 4, 14) },
        { prompt: "三个人排队，小明不在第一个，也不在最后一个。小明排第几？", answer: 2, options: ["1", "2", "3", "不能确定"] },
        { prompt: "一个数比10大，比13小，而且不是12。这个数是几？", answer: 11, options: ["10", "11", "12", "13"] },
        { prompt: "盒子里有红球和蓝球共9个，红球有4个，蓝球有几个？", answer: 5, options: uniqueOptions(5, 1, 9) },
      ];
      var item = sample(items);
      return makeQuestion("logic", "application", item.prompt, item.answer, item.options);
    },
    story: function () {
      var a = rand(5, 12);
      var b = rand(2, 6);
      var add = Math.random() > 0.45;
      var used = Math.min(b, a - 1);
      var answer = add ? a + b : a - used;
      var prompt = add ? "小明有 " + a + " 颗糖，妈妈又给了 " + b + " 颗。现在一共有几颗？" : "小明有 " + a + " 颗糖，吃掉 " + used + " 颗。还剩几颗？";
      return makeQuestion("story", "application", prompt, answer, uniqueOptions(answer, 0, 20));
    },
    borrowSub: function () {
      var pair = sample([
        [13, 5],
        [14, 8],
        [15, 7],
        [16, 9],
        [12, 6],
      ]);
      return makeQuestion("borrowSub", "advanced", pair[0] + " - " + pair[1] + " = ?", pair[0] - pair[1], [], "", "number");
    },
    hundredSense: function () {
      var a = rand(28, 96);
      return makeQuestion("hundredSense", "advanced", a + " 后面的一个数是几？", a + 1, uniqueOptions(a + 1, 20, 100));
    },
    planeShape: function () {
      var options = ["圆形", "三角形", "正方形", "长方形"];
      var answer = sample(options);
      return makeQuestion("planeShape", "advanced", "这个平面图形叫什么？", answer, shuffle(options), planeShapeSvg(answer));
    },
  };

  function generateQuestions() {
    var plan = ["count", "compare", "add10", "subtract10", "teenSense", "teenSense", "add20", "makeTen", "solidShape", "pattern", "pattern", "logic", "logic", "equation", "expressionCompare", "story", "story", "borrowSub", "hundredSense", "planeShape"];
    var usedKeys = {};
    var usedTypeAnswers = {};
    var questions = [];
    var i;
    for (i = 0; i < plan.length; i += 1) questions.push(createUniqueQuestion(plan[i], usedKeys, usedTypeAnswers));
    return shuffle(questions);
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
    safeCancelSpeech();
    state.questions = generateQuestions();
    state.index = 0;
    state.answers = [];
    state.selectedAnswer = "";
    state.startedAt = new Date().getTime();
    state.questionStartedAt = new Date().getTime();
    state.screen = "test";
    state.now = new Date().getTime();
    startTicker();
    renderAndMaybeSpeak(true);
  }

  function startTicker() {
    clearInterval(state.tick);
    state.tick = setInterval(function () {
      state.now = new Date().getTime();
      if (state.screen === "test") renderTimerOnly();
    }, 1000);
  }

  function stopTicker() {
    clearInterval(state.tick);
    state.tick = null;
  }

  function elapsedSeconds(from, to) {
    var end = to || new Date().getTime();
    return Math.max(0, Math.round((end - from) / 1000));
  }

  function formatTime(totalSeconds) {
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return minutes + ":" + String(seconds < 10 ? "0" + seconds : seconds);
  }

  function answerCurrent() {
    var question = state.questions[state.index];
    var rawAnswer = String(state.selectedAnswer).replace(/^\s+|\s+$/g, "");
    var usedSeconds;
    if (!rawAnswer) return;
    usedSeconds = elapsedSeconds(state.questionStartedAt);
    state.answers.push({
      question: question,
      answer: rawAnswer,
      correct: rawAnswer === question.answer,
      usedSeconds: usedSeconds,
      speedRatio: usedSeconds / question.referenceSeconds,
    });
    state.selectedAnswer = "";
    if (state.index >= state.questions.length - 1) {
      finishTest();
    } else {
      state.index += 1;
      state.questionStartedAt = new Date().getTime();
      renderAndMaybeSpeak(true);
    }
  }

  function finishTest() {
    safeCancelSpeech();
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

  function average(numbers) {
    var i;
    var sum = 0;
    if (!numbers.length) return 0;
    for (i = 0; i < numbers.length; i += 1) sum += numbers[i];
    return sum / numbers.length;
  }

  function filterAnswers(answers, predicate) {
    var out = [];
    var i;
    for (i = 0; i < answers.length; i += 1) if (predicate(answers[i])) out.push(answers[i]);
    return out;
  }

  function countCorrect(answers) {
    var count = 0;
    var i;
    for (i = 0; i < answers.length; i += 1) if (answers[i].correct) count += 1;
    return count;
  }

  function groupByDimension(answers) {
    var keys = ["numberSense", "calculation", "geometry", "application", "advanced"];
    var out = [];
    var i;
    var items;
    var correct;
    var speeds;
    var j;
    for (i = 0; i < keys.length; i += 1) {
      items = filterAnswers(answers, function (answer) {
        return answer.question.dimension === keys[i];
      });
      correct = countCorrect(items);
      speeds = [];
      for (j = 0; j < items.length; j += 1) speeds.push(getSpeedScore(items[j]));
      out.push({
        key: keys[i],
        name: DIMENSIONS[keys[i]],
        total: items.length,
        correct: correct,
        accuracy: items.length ? correct / items.length : 0,
        speed: items.length ? average(speeds) : 0,
      });
    }
    return out;
  }

  function calculateResult(answers) {
    var total = answers.length;
    var correct = countCorrect(answers);
    var speedValues = [];
    var i;
    var accuracy = correct / total;
    var grade1Answers;
    var advancedAnswers;
    var foundationAnswers;
    var grade1Accuracy;
    var advancedAccuracy;
    var foundationAccuracy;
    var hardCorrect;
    var stability;
    var speedScore;
    var dimensions;
    var slowTypes;
    var weakDimensions = [];
    var totalSeconds = 0;
    var score;
    var level;
    for (i = 0; i < answers.length; i += 1) speedValues.push(getSpeedScore(answers[i]));
    speedScore = average(speedValues);
    grade1Answers = filterAnswers(answers, function (answer) {
      return answer.question.difficulty === "foundation" || answer.question.difficulty === "grade1" || answer.question.difficulty === "application";
    });
    advancedAnswers = filterAnswers(answers, function (answer) {
      return answer.question.difficulty === "advanced";
    });
    foundationAnswers = filterAnswers(answers, function (answer) {
      return answer.question.difficulty === "foundation";
    });
    grade1Accuracy = grade1Answers.length ? countCorrect(grade1Answers) / grade1Answers.length : 0;
    advancedAccuracy = advancedAnswers.length ? countCorrect(advancedAnswers) / advancedAnswers.length : 0;
    foundationAccuracy = foundationAnswers.length ? countCorrect(foundationAnswers) / foundationAnswers.length : 0;
    hardCorrect = countCorrect(filterAnswers(answers, function (answer) {
      return answer.question.difficulty === "grade1" || answer.question.difficulty === "application" || answer.question.difficulty === "advanced";
    }));
    stability = Math.min(1, 0.55 * grade1Accuracy + 0.25 * foundationAccuracy + 0.2 * Math.min(1, hardCorrect / 12));
    score = Math.round(accuracy * 55 + speedScore * 30 + stability * 15);
    dimensions = groupByDimension(answers);
    for (i = 0; i < dimensions.length; i += 1) if (dimensions[i].total && dimensions[i].accuracy < 0.68) weakDimensions.push(dimensions[i].name);
    for (i = 0; i < answers.length; i += 1) totalSeconds += answers[i].usedSeconds;
    slowTypes = findSlowTypes(answers);
    level = chooseLevel({
      score: score,
      accuracy: accuracy,
      speedScore: speedScore,
      grade1Accuracy: grade1Accuracy,
      advancedAccuracy: advancedAccuracy,
      foundationAccuracy: foundationAccuracy,
    });
    return {
      total: total,
      correct: correct,
      accuracy: accuracy,
      speedScore: speedScore,
      stability: stability,
      score: score,
      grade1Accuracy: grade1Accuracy,
      advancedAccuracy: advancedAccuracy,
      foundationAccuracy: foundationAccuracy,
      dimensions: dimensions,
      slowTypes: slowTypes,
      weakDimensions: weakDimensions,
      totalSeconds: totalSeconds,
      level: level,
      advice: buildAdvice(level, weakDimensions, slowTypes, foundationAccuracy, grade1Accuracy, advancedAccuracy),
    };
  }

  function findSlowTypes(answers) {
    var byType = {};
    var labels = {};
    var keys = [];
    var out = [];
    var i;
    var key;
    var ratioValues;
    var list;
    for (i = 0; i < answers.length; i += 1) {
      key = answers[i].question.type;
      if (!byType[key]) {
        byType[key] = [];
        labels[key] = answers[i].question.typeLabel;
        keys.push(key);
      }
      byType[key].push(answers[i]);
    }
    for (i = 0; i < keys.length; i += 1) {
      key = keys[i];
      ratioValues = [];
      list = byType[key];
      for (var j = 0; j < list.length; j += 1) ratioValues.push(list[j].usedSeconds / list[j].question.referenceSeconds);
      out.push({ label: labels[key], ratio: average(ratioValues) });
    }
    out.sort(function (a, b) {
      return b.ratio - a.ratio;
    });
    var names = [];
    for (i = 0; i < out.length && names.length < 3; i += 1) if (out[i].ratio > 1.35) names.push(out[i].label);
    return names;
  }

  function chooseLevel(metrics) {
    if (metrics.foundationAccuracy < 0.6 || metrics.score < 58) return { name: "需要再多加准备", summary: "基础数感或10以内加减还不够稳，暑假适合先把底座补扎实。" };
    if (metrics.score < 72 || metrics.grade1Accuracy < 0.68) return { name: "可以平稳过渡到小学", summary: "基础项已经有支撑，20以内内容和熟练度还需要继续练。" };
    if (metrics.score < 84 || metrics.grade1Accuracy < 0.78) return { name: "丝滑顺利进入小学", summary: "一年级上册前半内容衔接不错，课堂跟进压力会比较小。" };
    if (metrics.score < 91 || metrics.advancedAccuracy < 0.45) return { name: "已经超额完成入学任务", summary: "20以内数感、计算和应用理解比较稳，可以适当增加综合题。" };
    if (metrics.score < 96 || metrics.advancedAccuracy < 0.72 || metrics.speedScore < 0.62) return { name: "已经接近小学一年级水平", summary: "一年级上册核心内容掌握较好，下册基础内容也有明显表现。" };
    return { name: "简直是天才小学生", summary: "上册内容熟练，下册数感或计算也能应对，超前表现非常亮眼。" };
  }

  function buildAdvice(level, weakDimensions, slowTypes, foundationAccuracy, grade1Accuracy, advancedAccuracy) {
    var strengths = [];
    var nextSteps = [];
    if (foundationAccuracy >= 0.85) strengths.push("入学基础比较稳，数数、比较和10以内加减能支撑一年级开学。");
    if (grade1Accuracy >= 0.8) strengths.push("20以内数感和一年级上册衔接题表现不错。");
    if (advancedAccuracy >= 0.6) strengths.push("已经能碰到一年级下册的部分内容，属于明显超前信号。");
    if (!strengths.length) strengths.push("已经能完成一整套测评，说明孩子具备参与正式学习任务的基础耐心。");
    if (weakDimensions.length) nextSteps.push("优先练习：" + weakDimensions.join("、") + "。");
    if (slowTypes.length) nextSteps.push("这些题型可以做少量限时熟练练习：" + slowTypes.join("、") + "。");
    if (foundationAccuracy < 0.7) nextSteps.push("暑假建议每天10-15分钟做数量对应、10以内分合和口头加减，必要时可考虑系统辅导。");
    else if (grade1Accuracy < 0.75) nextSteps.push("暑假建议重点练20以内数的顺序、分解和简单进位加法。");
    else nextSteps.push("暑假可以用生活购物、分糖果、搭积木等方式练应用题，不必过度刷题。");
    return { reason: level.summary, strengths: strengths, nextSteps: nextSteps };
  }

  function readButtonHtml() {
    return speechSupported() ? '<button class="read-button" data-action="read-question" type="button">再读一遍题目</button>' : '<span class="tag hot">当前微信环境不支持朗读</span>';
  }

  function renderHome() {
    app.innerHTML =
      '<section class="hero"><div class="topbar"><div class="brand"><span class="brand-mark">数</span><span>小学数学入学准备测评</span></div><span class="pill">20题 · 5-7分钟</span></div><div class="hero-grid"><div class="hero-copy"><h1>测一测，孩子能不能顺利接上一年级数学</h1><p class="lead">家长读题，孩子口答，家长代为点击或输入答案。题目随机生成，重点看20以内数感、10以内加减理解、图形和应用表达。</p><div class="parent-guide"><div class="guide-step"><strong>1. 家长读题</strong><span>系统可自动朗读；不支持时请家长读题。</span></div><div class="guide-step"><strong>2. 孩子口答</strong><span>让孩子说答案或讲想法，不考手机操作。</span></div><div class="guide-step"><strong>3. 家长录入</strong><span>系统自动计时、评分，并生成错题复盘。</span></div></div><div class="actions"><button class="primary" data-action="practice">试做一题</button><button class="secondary" data-action="start">正式开始</button><button class="secondary" data-action="preview">评级标准</button><button class="ghost" data-action="share-page">分享</button></div></div></div><p class="footer-hint">结果仅用于家庭观察和暑假练习规划，不作为医学或教育诊断。</p></section>';
  }

  function renderPractice() {
    var question = state.practiceQuestion;
    var correct = state.practiceAnswer === question.answer;
    app.innerHTML =
      '<section class="test-layout"><div class="test-topbar"><div class="brand"><span class="brand-mark">试</span><span>试做一题</span></div><button class="secondary" data-action="start">正式开始</button></div><article class="question-card"><div class="question-meta"><span class="tag">不计分</span><span class="tag alt">' +
      question.typeLabel +
      "</span>" +
      readButtonHtml() +
      '</div><h2 class="question-title">' +
      escapeHtml(question.prompt) +
      '</h2><div class="question-visual ' +
      (question.visual ? "" : "hidden") +
      '">' +
      question.visual +
      '</div><div class="answer-area">' +
      renderPracticeInput(question) +
      "</div>" +
      (state.practiceChecked ? '<div class="practice-feedback ' + (correct ? "ok" : "bad") + '">' + (correct ? "答对啦，可以开始正式测评。" : "这题正确答案是 " + question.answer + "，再进入正式测评也没关系。") + "</div>" : "") +
      '<div class="question-actions"><button class="secondary" data-action="home">返回首页</button><button class="primary" data-action="' +
      (state.practiceChecked ? "start" : "check-practice") +
      '">' +
      (state.practiceChecked ? "正式开始" : "看看结果") +
      "</button></div></article></section>";
  }

  function renderPracticeInput(question) {
    var html = '<div class="options">';
    var i;
    for (i = 0; i < question.options.length; i += 1) {
      html += '<button class="option ' + (state.practiceAnswer === question.options[i] ? "selected" : "") + '" data-practice-answer="' + escapeHtml(question.options[i]) + '">' + escapeHtml(question.options[i]) + "</button>";
    }
    return html + "</div>";
  }

  function renderStandards() {
    var levels = [
      ["需要再多加准备", "基础数感或10以内加减不稳定，先补数量对应和分合。"],
      ["可以平稳过渡到小学", "基础项较稳，20以内内容仍需暑假巩固。"],
      ["丝滑顺利进入小学", "一年级上册前半内容掌握不错，速度正常。"],
      ["已经超额完成入学任务", "20以内与进位加法表现稳定，可增加应用题。"],
      ["已经接近小学一年级水平", "上册核心内容大多掌握，下册基础题也有表现。"],
      ["简直是天才小学生", "上册熟练，下册数感或计算也表现突出。"],
    ];
    var cards = "";
    var i;
    for (i = 0; i < levels.length; i += 1) cards += '<div class="mini-card"><h3>' + levels[i][0] + "</h3><p>" + levels[i][1] + "</p></div>";
    app.innerHTML = '<section class="shell"><div class="topbar"><div class="brand"><span class="brand-mark">标</span><span>评级标准</span></div><button class="secondary" data-action="home">返回首页</button></div><div class="result-card"><h1 class="level">怎么判断准备度？</h1><p class="lead">一年级上册是主线，下册只看超前。20以内内容在本测评中属于重要入学准备项。</p><div class="score-row"><div class="stat"><strong>55%</strong><span>正确率</span></div><div class="stat"><strong>30%</strong><span>按题型用时</span></div><div class="stat"><strong>15%</strong><span>难度与稳定性</span></div><div class="stat"><strong>6级</strong><span>准备度等级</span></div></div></div><div class="report-grid">' + cards + "</div></section>";
  }

  function renderTest() {
    var question = state.questions[state.index];
    var totalElapsed = elapsedSeconds(state.startedAt, state.now);
    var questionElapsed = elapsedSeconds(state.questionStartedAt, state.now);
    var progress = Math.round((state.index / state.questions.length) * 100);
    app.innerHTML =
      '<section class="test-layout"><div class="test-topbar"><div class="brand"><span class="brand-mark">' +
      (state.index + 1) +
      "</span><span>第 " +
      (state.index + 1) +
      " / " +
      state.questions.length +
      ' 题</span></div><button class="ghost" data-action="restart">重新开始</button></div><div class="progress-wrap"><div class="progress-bar" style="width:' +
      progress +
      '%"></div></div><div class="test-main"><article class="question-card"><div class="question-meta"><span class="tag">' +
      question.typeLabel +
      '</span><span class="tag alt">' +
      difficultyLabel(question.difficulty) +
      '</span><span class="tag hot">参考 ' +
      question.referenceSeconds +
      " 秒</span>" +
      readButtonHtml() +
      '</div><h2 class="question-title">' +
      escapeHtml(question.prompt) +
      '</h2><div class="question-visual ' +
      (question.visual ? "" : "hidden") +
      '">' +
      question.visual +
      '</div><div class="answer-area">' +
      renderAnswerInput(question) +
      '</div><div class="question-actions"><button class="secondary" data-action="skip">跳过这题</button><button class="primary" data-action="next" ' +
      (state.selectedAnswer ? "" : "disabled") +
      '>提交答案</button></div></article><aside class="panel"><div><p class="small">总用时</p><div class="timer" data-total-timer>' +
      formatTime(totalElapsed) +
      '</div></div><div><p class="small">本题用时</p><div class="timer" data-question-timer>' +
      formatTime(questionElapsed) +
      '</div></div><div class="stat-grid"><div class="stat"><strong>' +
      state.answers.length +
      '</strong><span>已完成</span></div><div class="stat"><strong>' +
      countCorrect(state.answers) +
      '</strong><span>已答对</span></div></div><p class="small">基础题会更看熟练度；应用题、规律题会给孩子更多思考空间。</p></aside></div></section>';
  }

  function renderAnswerInput(question) {
    var html;
    var i;
    if (question.input === "number") {
      return '<input class="number-input" inputmode="numeric" pattern="[0-9]*" data-answer-input placeholder="输入答案" value="' + escapeHtml(state.selectedAnswer) + '" />';
    }
    html = '<div class="options">';
    for (i = 0; i < question.options.length; i += 1) {
      html += '<button class="option ' + (state.selectedAnswer === question.options[i] ? "selected" : "") + '" data-answer="' + escapeHtml(question.options[i]) + '">' + escapeHtml(question.options[i]) + "</button>";
    }
    return html + "</div>";
  }

  function difficultyLabel(difficulty) {
    var labels = { foundation: "入学基础", grade1: "上册衔接", application: "应用理解", advanced: "超前观察" };
    return labels[difficulty] || "";
  }

  function renderTimerOnly() {
    var totalTimer = document.querySelector("[data-total-timer]");
    var questionTimer = document.querySelector("[data-question-timer]");
    if (totalTimer) totalTimer.innerHTML = formatTime(elapsedSeconds(state.startedAt, state.now));
    if (questionTimer) questionTimer.innerHTML = formatTime(elapsedSeconds(state.questionStartedAt, state.now));
  }

  function renderResult() {
    var result = state.result;
    var mistakes = filterAnswers(state.answers, function (answer) {
      return !answer.correct;
    });
    var html =
      '<section class="result-layout"><div class="topbar"><div class="brand"><span class="brand-mark">果</span><span>测评结果</span></div><div class="actions"><button class="secondary" data-action="restart">再测一次</button><button class="primary" data-action="copy">复制结果文案</button></div></div><div class="result-hero"><article class="result-card"><p class="pill">普通公立小学一年级衔接参考</p><h1 class="level">' +
      result.level.name +
      '</h1><p class="lead">' +
      result.level.summary +
      '</p><div class="score-row"><div class="stat"><strong>' +
      result.score +
      '</strong><span>综合分</span></div><div class="stat"><strong>' +
      Math.round(result.accuracy * 100) +
      '%</strong><span>正确率</span></div><div class="stat"><strong>' +
      Math.round(result.speedScore * 100) +
      '%</strong><span>速度表现</span></div><div class="stat"><strong>' +
      formatTime(result.totalSeconds) +
      '</strong><span>总用时</span></div></div></article><aside class="poster" id="poster"><div class="poster-inner"><div><div class="poster-title">小学数学入学准备测评</div><div class="poster-level">' +
      result.level.name +
      '</div><p class="small">' +
      result.level.summary +
      '</p></div><div class="stat-grid"><div class="stat"><strong>' +
      result.score +
      '</strong><span>综合分</span></div><div class="stat"><strong>' +
      Math.round(result.accuracy * 100) +
      '%</strong><span>正确率</span></div><div class="stat"><strong>' +
      Math.round(result.speedScore * 100) +
      '%</strong><span>速度</span></div><div class="stat"><strong>' +
      formatTime(result.totalSeconds) +
      '</strong><span>用时</span></div></div><div><div class="qr">QR</div><p class="small">分享到家长群，邀请更多孩子一起测一测。</p></div></div></aside></div><div class="report-grid"><div class="mini-card"><h3>能力画像</h3><div class="dimension-list">' +
      renderDimensions(result.dimensions) +
      '</div></div><div class="mini-card"><h3>为什么是这个等级</h3><p>' +
      result.advice.reason +
      '</p><p class="small">一年级上册是主要评分依据，下册题只用于识别超前表现。</p></div><div class="mini-card"><h3>孩子的优势</h3><ul>' +
      renderList(result.advice.strengths) +
      '</ul></div><div class="mini-card"><h3>暑假怎么练</h3><ul>' +
      renderList(result.advice.nextSteps) +
      '</ul></div><div class="mini-card"><h3>用时观察</h3><p>' +
      (result.slowTypes.length ? "相对偏慢的题型：" + result.slowTypes.join("、") + "。" : "整体速度表现比较均衡，没有特别突出的慢项。") +
      '</p></div><div class="mini-card"><h3>超前信号</h3><p>' +
      Math.round(result.advancedAccuracy * 100) +
      "% 的超前观察题答对。" +
      (result.advancedAccuracy >= 0.6 ? "可以适当接触一年级下册基础内容。" : "目前先巩固一年级上册核心内容更合适。") +
      '</p></div><div class="mini-card review-card"><h3>错题复盘</h3>' +
      (mistakes.length ? '<div class="mistake-list">' + renderMistakes(mistakes) + "</div>" : "<p>这次没有错题，基础状态很漂亮。可以重点观察速度和表达是否稳定。</p>") +
      "</div></div></section>";
    app.innerHTML = html;
  }

  function renderList(items) {
    var html = "";
    var i;
    for (i = 0; i < items.length; i += 1) html += "<li>" + escapeHtml(items[i]) + "</li>";
    return html;
  }

  function renderDimensions(dimensions) {
    var html = "";
    var i;
    var value;
    for (i = 0; i < dimensions.length; i += 1) {
      value = Math.round(dimensions[i].accuracy * 100);
      html += '<div class="dimension"><div class="dimension-head"><span>' + dimensions[i].name + "</span><strong>" + (dimensions[i].total ? value + "%" : "未测") + '</strong></div><div class="bar"><span style="width:' + (dimensions[i].total ? value : 0) + '%"></span></div></div>';
    }
    return html;
  }

  function renderMistakes(mistakes) {
    var html = "";
    var i;
    var answer;
    for (i = 0; i < mistakes.length; i += 1) {
      answer = mistakes[i];
      html += '<details class="mistake-item"><summary><span>错题 ' + (i + 1) + "</span><strong>" + answer.question.typeLabel + '</strong></summary><div class="mistake-body"><p>' + escapeHtml(answer.question.prompt) + '</p><div class="' + (answer.question.visual ? "" : "hidden") + '">' + answer.question.visual + '</div><div class="answer-compare"><span>孩子答案：<strong>' + escapeHtml(answer.answer) + "</strong></span><span>正确答案：<strong>" + escapeHtml(answer.question.answer) + "</strong></span></div></div></details>";
    }
    return html;
  }

  function copyResult() {
    var result = state.result;
    var text = "小学数学入学准备测评结果：" + result.level.name + "\n综合分：" + result.score + "分\n正确率：" + Math.round(result.accuracy * 100) + "%\n总用时：" + formatTime(result.totalSeconds) + "\n结论：" + result.level.summary + "\n暑假建议：" + result.advice.nextSteps.join(" ");
    copyText(text);
    alert("结果文案已复制，可以粘贴分享。");
  }

  function render() {
    try {
      if (state.screen === "home") renderHome();
      if (state.screen === "practice") renderPractice();
      if (state.screen === "standards") renderStandards();
      if (state.screen === "test") renderTest();
      if (state.screen === "result") renderResult();
    } catch (error) {
      app.innerHTML = '<section class="result-card"><h1 class="level">页面加载遇到问题</h1><p class="lead">请刷新页面再试。如果在微信里打开仍然白屏，可以先用 Safari 打开测试。</p></section>';
    }
  }

  function closestWithAttr(target, attrName) {
    while (target && target !== document) {
      if (target.getAttribute && target.getAttribute(attrName) !== null) return target;
      target = target.parentNode;
    }
    return null;
  }

  function handleClick(event) {
    var actionNode = closestWithAttr(event.target, "data-action");
    var answerNode = closestWithAttr(event.target, "data-answer");
    var practiceNode = closestWithAttr(event.target, "data-practice-answer");
    var action;
    if (practiceNode) {
      state.practiceAnswer = practiceNode.getAttribute("data-practice-answer");
      state.practiceChecked = false;
      render();
      return;
    }
    if (answerNode) {
      state.selectedAnswer = answerNode.getAttribute("data-answer");
      render();
      return;
    }
    if (!actionNode) return;
    action = actionNode.getAttribute("data-action");
    if (action === "practice") startPractice();
    if (action === "check-practice") checkPractice();
    if (action === "read-question") speakCurrentQuestion();
    if (action === "share-page") sharePage();
    if (action === "start") startTest();
    if (action === "preview") {
      safeCancelSpeech();
      state.screen = "standards";
      render();
    }
    if (action === "home") {
      safeCancelSpeech();
      state.screen = "home";
      render();
    }
    if (action === "restart") {
      safeCancelSpeech();
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
  }

  function handleInput(event) {
    var target = event.target;
    var button;
    if (target && target.getAttribute && target.getAttribute("data-answer-input") !== null) {
      state.selectedAnswer = String(target.value || "").replace(/[^\d]/g, "");
      target.value = state.selectedAnswer;
      button = document.querySelector('[data-action="next"]');
      if (button) button.disabled = !state.selectedAnswer;
    }
  }

  function handleKeydown(event) {
    var key = event.key || event.keyCode;
    if ((key === "Enter" || key === 13) && state.screen === "test" && state.selectedAnswer) answerCurrent();
  }

  try {
    app.addEventListener("click", handleClick, false);
    app.addEventListener("input", handleInput, false);
    document.addEventListener("keydown", handleKeydown, false);
    render();
    initWeChatShare();
  } catch (error) {
    app.innerHTML = '<section class="result-card"><h1 class="level">页面加载遇到问题</h1><p class="lead">请刷新页面再试。</p></section>';
  }
})();
