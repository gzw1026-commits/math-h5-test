(function () {
  "use strict";

  var app = document.getElementById("app");
  if (!app) return;

  var SHARE_CONFIG = {
    title: "小学数学入学准备测评",
    desc: "20道题，5分钟，测一测孩子能否顺利衔接一年级数学。",
    coverPath: "/share-cover.png",
    wechatAppId: "",
    wechatSignatureEndpoint: "",
  };

  var STORAGE_RESULT_KEY = "math-readiness-last-result";
  var STORAGE_UNLOCK_KEY = "math-readiness-result-unlocked";
  var STORAGE_VISITOR_KEY = "math-readiness-visitor-id";
  var TRACKING_ENDPOINT = "/.netlify/functions/track";

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
    decompose: { label: "数的分合", seconds: 18, dimension: "numberSense" },
    placeValue: { label: "十和一", seconds: 18, dimension: "numberSense" },
    add10: { label: "10以内加法", seconds: 15, dimension: "calculation" },
    subtract10: { label: "10以内减法", seconds: 16, dimension: "calculation" },
    teenSense: { label: "11-20数感", seconds: 16, dimension: "numberSense" },
    add20: { label: "20以内加法", seconds: 20, dimension: "calculation" },
    makeTen: { label: "凑十看图", seconds: 24, dimension: "calculation" },
    equation: { label: "算式填空", seconds: 26, dimension: "application" },
    expressionCompare: { label: "式子比较", seconds: 26, dimension: "application" },
    difference: { label: "比多比少", seconds: 26, dimension: "application" },
    solidShape: { label: "立体图形", seconds: 15, dimension: "geometry" },
    position: { label: "顺序方位", seconds: 20, dimension: "geometry" },
    pattern: { label: "规律推理", seconds: 24, dimension: "application" },
    logic: { label: "逻辑推理", seconds: 32, dimension: "application" },
    story: { label: "生活应用题", seconds: 30, dimension: "application" },
    borrowSub: { label: "退位减法", seconds: 26, dimension: "advanced" },
    hundredSense: { label: "100以内数感", seconds: 22, dimension: "advanced" },
    planeShape: { label: "平面图形", seconds: 14, dimension: "advanced" },
  };

  var state = {
    screen: "home",
    mode: "assessment",
    questions: [],
    index: 0,
    answers: [],
    selectedAnswer: "",
    startedAt: 0,
    questionStartedAt: 0,
    tick: null,
    now: new Date().getTime(),
    result: null,
    unlockOverlay: false,
    posterImageUrl: "",
    posterPreviewOpen: false,
    toastMessage: "",
    toastTimer: null,
    autoAdvanceTimer: null,
    analysisTimer: null,
    posterVisible: false,
    practiceQuestion: null,
    practiceAnswer: "",
    practiceChecked: false,
    autoRead: true,
    visitorId: "",
    sessionId: "",
    assessmentId: "",
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

  function splitOptions(need, rest) {
    var answer = need + "和" + rest;
    var values = [answer];
    var total = need + rest;
    var first;
    var i;
    var text;
    for (i = 1; i < total; i += 1) {
      first = i;
      if (first !== need) {
        text = first + "和" + (total - first);
        if (!hasOwn(values, text)) values.push(text);
      }
      if (values.length >= 4) break;
    }
    return shuffle(values);
  }

  function makeNumberLine(numbers) {
    var html = '<div class="number-line">';
    var i;
    for (i = 0; i < numbers.length; i += 1) html += '<span class="num-chip">' + escapeHtml(numbers[i]) + "</span>";
    return html + "</div>";
  }

  function makeSymbolRow(symbols) {
    var html = '<div class="symbol-row">';
    var i;
    for (i = 0; i < symbols.length; i += 1) html += '<span class="symbol-chip">' + escapeHtml(symbols[i]) + "</span>";
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

  function isWeChatBrowser() {
    try {
      return /MicroMessenger/i.test(navigator.userAgent || "");
    } catch (error) {
      return false;
    }
  }

  function safeStorageGet(key) {
    try {
      if (!window.localStorage) return "";
      return window.localStorage.getItem(key) || "";
    } catch (error) {
      return "";
    }
  }

  function safeStorageSet(key, value) {
    try {
      if (!window.localStorage) return false;
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function safeStorageRemove(key) {
    try {
      if (window.localStorage) window.localStorage.removeItem(key);
    } catch (error) {}
  }

  function makeTrackingId(prefix) {
    var randomPart = "";
    var values;
    var i;
    try {
      if (window.crypto && window.crypto.getRandomValues) {
        values = new Uint32Array(2);
        window.crypto.getRandomValues(values);
        for (i = 0; i < values.length; i += 1) randomPart += values[i].toString(16);
      }
    } catch (error) {
      randomPart = "";
    }
    if (!randomPart) randomPart = Math.floor(Math.random() * 1000000000000).toString(16);
    return prefix + "_" + new Date().getTime().toString(16) + "_" + randomPart;
  }

  function getVisitorId() {
    var id = safeStorageGet(STORAGE_VISITOR_KEY);
    if (id && id.length >= 8) return id;
    id = makeTrackingId("v");
    safeStorageSet(STORAGE_VISITOR_KEY, id);
    return id;
  }

  function resetAssessmentTrackingIds() {
    state.sessionId = makeTrackingId("s");
    state.assessmentId = makeTrackingId("a");
  }

  function initTrackingIds() {
    state.visitorId = getVisitorId();
    if (!state.sessionId || !state.assessmentId) resetAssessmentTrackingIds();
  }

  function postTrackingJson(body) {
    var text;
    try {
      text = JSON.stringify(body);
    } catch (error) {
      return;
    }
    try {
      if (window.fetch) {
        window
          .fetch(TRACKING_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: text,
            keepalive: true,
          })
          .catch(function () {});
        return;
      }
    } catch (error2) {}
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", TRACKING_ENDPOINT, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(text);
    } catch (error3) {}
  }

  function trackEvent(eventName, payload) {
    try {
      if (!state.visitorId) state.visitorId = getVisitorId();
      if (!state.sessionId || !state.assessmentId) resetAssessmentTrackingIds();
      postTrackingJson({
        event_name: eventName,
        visitor_id: state.visitorId,
        session_id: state.sessionId,
        assessment_id: state.assessmentId,
        payload: payload || {},
      });
    } catch (error) {}
  }

  function persistAssessment(unlocked) {
    try {
      safeStorageSet(
        STORAGE_RESULT_KEY,
        JSON.stringify({
          result: state.result,
          answers: state.answers,
        })
      );
      safeStorageSet(STORAGE_UNLOCK_KEY, unlocked ? "1" : "0");
    } catch (error) {}
  }

  function restoreUnlockedAssessment() {
    var raw;
    var saved;
    try {
      if (safeStorageGet(STORAGE_UNLOCK_KEY) !== "1") return false;
      raw = safeStorageGet(STORAGE_RESULT_KEY);
      if (!raw) return false;
      saved = JSON.parse(raw);
      if (!saved || !saved.result || !saved.answers) return false;
      state.result = saved.result;
      state.answers = saved.answers;
      state.screen = "result";
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearStoredAssessment() {
    safeStorageRemove(STORAGE_RESULT_KEY);
    safeStorageRemove(STORAGE_UNLOCK_KEY);
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
      var count = rand(8, 16);
      var form = sample([1, 2, 3]);
      var hidden;
      if (form === 1) return makeQuestion("count", "foundation", "数一数，一共有几个圆点？", count, uniqueOptions(count, 1, 20), makeDots(count));
      if (form === 2) return makeQuestion("count", "foundation", "这些圆点表示数字几？", count, uniqueOptions(count, 1, 20), makeDots(count));
      hidden = rand(1, 4);
      return makeQuestion("count", "foundation", "这些圆点再添 " + hidden + " 个，就是几？", count + hidden, uniqueOptions(count + hidden, 1, 20), makeDots(count));
    },
    compare: function () {
      var a = rand(5, 20);
      var b = rand(5, 20);
      var c = rand(5, 20);
      var answer;
      var guard = 0;
      var form = sample([1, 2, 3]);
      if (a === b) b += 1;
      if (b > 20) b = 5;
      while ((c === a || c === b) && guard < 30) {
        c = rand(5, 20);
        guard += 1;
      }
      if (form === 1) {
        answer = Math.max(a, b, c);
        return makeQuestion("compare", "foundation", "这三个数中，哪个数最大？", answer, shuffle([a, b, c]), makeNumberLine([a, b, c]));
      }
      if (form === 2) {
        answer = Math.min(a, b, c);
        return makeQuestion("compare", "foundation", "这三个数中，哪个数最小？", answer, shuffle([a, b, c]), makeNumberLine([a, b, c]));
      }
      answer = b > a ? ">" : b < a ? "<" : "=";
      return makeQuestion("compare", "foundation", b + " 和 " + a + " 中间应该填什么？", answer, [">", "<", "="], makeNumberLine([b, "?", a]));
    },
    decompose: function () {
      var total = rand(6, 10);
      var known = rand(2, total - 2);
      var answer = total - known;
      var form = sample([1, 2, 3, 4, 5]);
      if (form === 1) return makeQuestion("decompose", "foundation", total + " 可以分成 " + known + " 和几？", answer, uniqueOptions(answer, 0, 10), makeNumberLine([known, "?", total]));
      if (form === 2) return makeQuestion("decompose", "foundation", known + " 和几合起来是 " + total + "？", answer, uniqueOptions(answer, 0, 10), makeNumberLine([known, "?", total]));
      if (form === 3) return makeQuestion("decompose", "foundation", total + " 去掉 " + known + "，还剩几？", answer, uniqueOptions(answer, 0, 10));
      return makeQuestion("decompose", "foundation", "想一想，哪一组能组成 " + total + "？", known + "和" + answer, splitOptions(known, answer));
    },
    placeValue: function () {
      var ones = rand(1, 9);
      var answer = 10 + ones;
      var form = sample([1, 2, 3, 4, 5]);
      var number = rand(11, 20);
      if (form === 1) return makeQuestion("placeValue", "grade1", "1个十和 " + ones + " 个一合起来是几？", answer, uniqueOptions(answer, 8, 20), makeNumberLine(["1个十", ones + "个一"]));
      if (form === 2) return makeQuestion("placeValue", "grade1", number + " 里面有几个十？", 1, ["0", "1", "2", "10"], makeNumberLine([number]));
      if (form === 3) return makeQuestion("placeValue", "grade1", number + " 的个位上是几？", number - 10, uniqueOptions(number - 10, 0, 10), makeNumberLine([number]));
      if (form === 4) return makeQuestion("placeValue", "grade1", number + " 由1个十和几组成？", number - 10, uniqueOptions(number - 10, 0, 10), makeNumberLine([number]));
      return makeQuestion("placeValue", "grade1", "比 " + (number - 1) + " 多1的数是几？", number, uniqueOptions(number, 8, 20), makeNumberLine([number - 1, "?"]));
    },
    add10: function () {
      var a = rand(2, 8);
      var b = rand(2, Math.min(7, 10 - a));
      var form = sample([1, 2, 3]);
      if (form === 1) return makeQuestion("add10", "foundation", a + " + " + b + " = ?", a + b, uniqueOptions(a + b, 0, 12));
      if (form === 2) return makeQuestion("add10", "foundation", "左边有 " + a + " 个，右边有 " + b + " 个，一共有几个？", a + b, uniqueOptions(a + b, 0, 12), makeNumberLine([a, b]));
      return makeQuestion("add10", "foundation", "从 " + a + " 往后数 " + b + " 个，数到几？", a + b, uniqueOptions(a + b, 0, 12), makeNumberLine([a, "+ " + b]));
    },
    subtract10: function () {
      var a = rand(4, 10);
      var b = rand(2, a - 1);
      var form = sample([1, 2, 3]);
      if (form === 1) return makeQuestion("subtract10", "foundation", a + " - " + b + " = ?", a - b, uniqueOptions(a - b, 0, 10));
      if (form === 2) return makeQuestion("subtract10", "foundation", "有 " + a + " 个圆点，拿走 " + b + " 个，还剩几个？", a - b, uniqueOptions(a - b, 0, 10), makeDots(a));
      return makeQuestion("subtract10", "foundation", "从 " + a + " 往前数 " + b + " 个，数到几？", a - b, uniqueOptions(a - b, 0, 10), makeNumberLine([a, "- " + b]));
    },
    teenSense: function () {
      var start = rand(10, 16);
      var missingIndex = rand(1, 3);
      var numbers = [start, start + 1, start + 2, start + 3, start + 4];
      var answer = numbers[missingIndex];
      var display = numbers.slice();
      var form = sample([1, 2, 3, 4]);
      display[missingIndex] = "?";
      if (form === 1) return makeQuestion("teenSense", "grade1", "找一找，问号应该是哪个数？", answer, uniqueOptions(answer, 8, 22), makeNumberLine(display));
      if (form === 2) return makeQuestion("teenSense", "grade1", answer + " 前面的一个数是几？", answer - 1, uniqueOptions(answer - 1, 8, 22), makeNumberLine(["?", answer]));
      if (form === 3) return makeQuestion("teenSense", "grade1", answer + " 后面的一个数是几？", answer + 1, uniqueOptions(answer + 1, 8, 22), makeNumberLine([answer, "?"]));
      return makeQuestion("teenSense", "grade1", "从小到大排，" + answer + " 应该在谁的后面？", answer - 1, uniqueOptions(answer - 1, 8, 22), makeNumberLine([answer - 2, "?", answer]));
    },
    add20: function () {
      var a = rand(6, 13);
      var b = rand(2, Math.min(6, 20 - a));
      var form = sample([1, 2, 3]);
      if (form === 1) return makeQuestion("add20", "grade1", a + " + " + b + " = ?", a + b, [], "", "number");
      if (form === 2) return makeQuestion("add20", "grade1", a + " 再添 " + b + "，一共是几？", a + b, [], "", "number");
      return makeQuestion("add20", "grade1", "从 " + a + " 开始往后数 " + b + " 个，数到几？", a + b, [], "", "number");
    },
    makeTen: function () {
      var pair = sample([
        [8, 5],
        [9, 6],
        [7, 5],
        [8, 6],
        [9, 4],
        [6, 7],
        [7, 6],
        [6, 8],
        [8, 7],
        [9, 5],
      ]);
      var a = pair[0];
      var b = pair[1];
      var need = 10 - a;
      var rest = b - need;
      var form = sample([1, 2, 3]);
      if (form === 1) return makeQuestion("makeTen", "grade1", "看图：右边这堆点要怎么拆，才能先补满左边10格？", need + "和" + rest, splitOptions(need, rest), makeTenFrame(a, b));
      if (form === 2) return makeQuestion("makeTen", "grade1", "左边已有 " + a + " 个点，先从右边拿几个点能凑成10？", need, uniqueOptions(need, 0, 9), makeTenFrame(a, b));
      return makeQuestion("makeTen", "grade1", "把右边拆成 " + need + " 和几，就能先凑成10？", rest, uniqueOptions(rest, 0, 9), makeTenFrame(a, b));
    },
    equation: function () {
      var form = sample([1, 2, 3, 4, 5]);
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
      if (form === 3) return makeQuestion("equation", "application", "□ + " + (right - answer) + " = " + right + "，□里填几？", answer, [], "", "number");
      if (form === 4) {
        total = rand(12, 19);
        answer = rand(4, 9);
        return makeQuestion("equation", "application", total + " = " + answer + " + □，□里填几？", total - answer, [], "", "number");
      }
      total = rand(10, 18);
      answer = rand(2, 8);
      return makeQuestion("equation", "application", "□ - " + answer + " = " + (total - answer) + "，□里填几？", total, [], "", "number");
    },
    expressionCompare: function () {
      var leftA = rand(6, 12);
      var leftB = rand(2, 7);
      var rightA = rand(5, 12);
      var rightB = rand(2, 7);
      var form = sample([1, 2, 3]);
      var left = form === 2 ? leftA - Math.min(leftB, leftA - 1) : leftA + leftB;
      var right = form === 3 ? rightA - Math.min(rightB, rightA - 1) : rightA + rightB;
      var leftText = form === 2 ? leftA + " - " + Math.min(leftB, leftA - 1) : leftA + " + " + leftB;
      var rightText = form === 3 ? rightA + " - " + Math.min(rightB, rightA - 1) : rightA + " + " + rightB;
      var answer = left === right ? "一样大" : left > right ? "左边大" : "右边大";
      return makeQuestion("expressionCompare", "application", leftText + " 和 " + rightText + "，哪边大？", answer, ["左边大", "右边大", "一样大", "不能确定"]);
    },
    difference: function () {
      var bigger = rand(9, 18);
      var smaller = rand(4, bigger - 3);
      var names = sample([
        ["小红", "小明", "朵花"],
        ["乐乐", "安安", "颗星"],
        ["哥哥", "妹妹", "块积木"],
      ]);
      var form = sample([1, 2, 3]);
      var prompt = names[0] + "有 " + bigger + " " + names[2] + "，" + names[1] + "有 " + smaller + " " + names[2] + "。";
      if (form === 1) prompt += names[0] + "比" + names[1] + "多几个？";
      if (form === 2) prompt += names[1] + "比" + names[0] + "少几个？";
      if (form === 3) prompt += names[1] + "还要几个，才能和" + names[0] + "一样多？";
      return makeQuestion("difference", "application", prompt, bigger - smaller, uniqueOptions(bigger - smaller, 1, 16));
    },
    solidShape: function () {
      var options = ["球", "正方体", "圆柱", "长方体"];
      var answer = sample(options);
      return makeQuestion("solidShape", "grade1", "这个立体图形最像什么？", answer, shuffle(options), solidShapeSvg(answer));
    },
    position: function () {
      var rows = [
        { seq: ["●", "▲", "■", "★", "◆"], answer: 4, target: "★" },
        { seq: ["圆", "正", "三", "长", "圆"], answer: 2, target: "正" },
        { seq: ["1", "3", "5", "7", "9"], answer: 3, target: "5" },
        { seq: ["小", "中", "大", "高", "低"], answer: 1, target: "小" },
        { seq: ["红", "蓝", "绿", "黄", "紫"], answer: 5, target: "紫" },
      ];
      var row = sample(rows);
      var form = sample([1, 2]);
      if (form === 1) return makeQuestion("position", "foundation", "从左往右数，" + row.target + " 排第几？", row.answer, ["1", "2", "3", "4", "5"], makeSymbolRow(row.seq));
      return makeQuestion("position", "foundation", "从右往左数，" + row.target + " 排第几？", 6 - row.answer, ["1", "2", "3", "4", "5"], makeSymbolRow(row.seq));
    },
    pattern: function () {
      var patterns = [
        { seq: ["●", "▲", "●", "▲", "●", "?"], answer: "▲", options: ["▲", "●", "■", "5"] },
        { seq: ["■", "■", "▲", "■", "■", "?"], answer: "▲", options: ["▲", "●", "■", "◆"] },
        { seq: [2, 4, 6, 8, "?"], answer: 10, options: [9, 10, 11, 12] },
        { seq: [5, 7, 9, 11, "?"], answer: 13, options: [12, 13, 14, 15] },
        { seq: [3, 6, 9, 12, "?"], answer: 15, options: [13, 14, 15, 16] },
        { seq: [16, 14, 12, 10, "?"], answer: 8, options: [6, 8, 9, 12] },
        { seq: [20, 18, 16, 14, "?"], answer: 12, options: [10, 11, 12, 13] },
        { seq: ["红", "黄", "黄", "红", "黄", "黄", "?"], answer: "红", options: ["红", "黄", "蓝", "绿"] },
        { seq: ["大", "小", "小", "大", "小", "小", "?"], answer: "大", options: ["大", "小", "中", "高"] },
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
        { prompt: "小华前面有3人，后面有4人，这一排一共有几人？", answer: 8, options: uniqueOptions(8, 4, 12) },
        { prompt: "一个数比15小，比12大，而且不是14。这个数是几？", answer: 13, options: ["12", "13", "14", "15"] },
        { prompt: "小猫、小狗、小兔排队。小狗在小猫后面，小兔在小狗后面。谁排最后？", answer: "小兔", options: ["小猫", "小狗", "小兔", "不能确定"] },
        { prompt: "书包里有铅笔和橡皮共8个，橡皮有3个，铅笔有几个？", answer: 5, options: uniqueOptions(5, 1, 9) },
      ];
      var item = sample(items);
      return makeQuestion("logic", "application", item.prompt, item.answer, item.options);
    },
    story: function () {
      var form = sample([1, 2, 3, 4, 5]);
      var a = rand(5, 12);
      var b = rand(2, 6);
      var c = rand(2, 5);
      var used = Math.min(b, a - 1);
      var answer;
      var prompt;
      if (form === 1) {
        answer = a + b;
        prompt = "小明有 " + a + " 颗糖，妈妈又给了 " + b + " 颗。现在一共有几颗？";
      } else if (form === 2) {
        answer = a - used;
        prompt = "小明有 " + a + " 颗糖，吃掉 " + used + " 颗。还剩几颗？";
      } else if (form === 3) {
        answer = a + b - c;
        prompt = "篮子里有 " + a + " 个苹果，又放进 " + b + " 个，拿走 " + c + " 个。现在有几个？";
      } else if (form === 4) {
        answer = a - b + c;
        prompt = "盒子里有 " + a + " 块积木，拿走 " + b + " 块，又放回 " + c + " 块。现在有几块？";
      } else {
        answer = a + b;
        prompt = "第一组有 " + a + " 人，第二组有 " + b + " 人，两组一共有几人？";
      }
      return makeQuestion("story", "application", prompt, answer, uniqueOptions(answer, 0, 20));
    },
    borrowSub: function () {
      var pair = sample([
        [13, 5],
        [14, 8],
        [15, 7],
        [16, 9],
        [12, 6],
        [11, 4],
        [17, 8],
        [18, 9],
        [15, 6],
        [13, 7],
      ]);
      var form = sample([1, 2]);
      if (form === 1) return makeQuestion("borrowSub", "advanced", pair[0] + " - " + pair[1] + " = ?", pair[0] - pair[1], [], "", "number");
      return makeQuestion("borrowSub", "advanced", pair[0] + " 个里面拿走 " + pair[1] + " 个，还剩几个？", pair[0] - pair[1], [], "", "number");
    },
    hundredSense: function () {
      var a = rand(28, 96);
      var form = sample([1, 2, 3, 4]);
      if (form === 1) return makeQuestion("hundredSense", "advanced", a + " 后面的一个数是几？", a + 1, uniqueOptions(a + 1, 20, 100));
      if (form === 2) return makeQuestion("hundredSense", "advanced", a + " 前面的一个数是几？", a - 1, uniqueOptions(a - 1, 20, 100));
      if (form === 3) return makeQuestion("hundredSense", "advanced", "比 " + a + " 多10的数是几？", a + 10, uniqueOptions(a + 10, 20, 110));
      return makeQuestion("hundredSense", "advanced", "十位上是 " + Math.floor(a / 10) + "，个位上是 " + (a % 10) + "，这个数是几？", a, uniqueOptions(a, 20, 100));
    },
    planeShape: function () {
      var options = ["圆形", "三角形", "正方形", "长方形"];
      var answer = sample(options);
      var form = sample([1, 2, 3]);
      if (form === 1) return makeQuestion("planeShape", "advanced", "这个平面图形叫什么？", answer, shuffle(options), planeShapeSvg(answer));
      if (form === 2) return makeQuestion("planeShape", "advanced", "哪种图形有4条一样长的边？", "正方形", shuffle(options), planeShapeSvg("正方形"));
      return makeQuestion("planeShape", "advanced", "哪种图形没有角？", "圆形", shuffle(options), planeShapeSvg("圆形"));
    },
  };

  var dailyMakers = {
    story: function () {
      var form = sample([1, 2, 3, 4, 5, 6]);
      var a = rand(8, 18);
      var b = rand(3, 9);
      var c = rand(2, 7);
      var answer;
      var prompt;
      if (form === 1) {
        answer = a + b - c;
        prompt = "书架上有 " + a + " 本书，又放上 " + b + " 本，借走 " + c + " 本。现在书架上有几本？";
      } else if (form === 2) {
        answer = a - b + c;
        prompt = "盒子里有 " + a + " 支铅笔，小朋友拿走 " + b + " 支，又放回 " + c + " 支。盒子里现在有几支？";
      } else if (form === 3) {
        answer = a + b;
        prompt = "一班有 " + a + " 人参加跳绳，二班比一班多 " + b + " 人。二班有几人参加？";
      } else if (form === 4) {
        answer = a - b;
        prompt = "小红有 " + a + " 张贴纸，小明比小红少 " + b + " 张。小明有几张？";
      } else if (form === 5) {
        answer = a + b + c;
        prompt = "第一行有 " + a + " 朵花，第二行有 " + b + " 朵，第三行有 " + c + " 朵。一共有几朵花？";
      } else {
        answer = a - b;
        prompt = "停车场原来有 " + a + " 辆车，开走 " + b + " 辆。还剩几辆？";
      }
      return makeQuestion("story", "application", prompt, answer, [], "", "number");
    },
    queue: function () {
      var before = rand(2, 8);
      var after = rand(2, 8);
      var form = sample([1, 2, 3]);
      if (form === 1) return makeQuestion("logic", "application", "小明排队，前面有 " + before + " 人，后面有 " + after + " 人。这一队一共有几人？", before + after + 1, [], "", "number");
      if (form === 2) return makeQuestion("logic", "application", "一队共有 " + (before + after + 1) + " 人，小明前面有 " + before + " 人。小明后面有几人？", after, [], "", "number");
      return makeQuestion("logic", "application", "从前往后数，小明排第 " + (before + 1) + "；从后往前数，小明排第 " + (after + 1) + "。这一队共有几人？", before + after + 1, [], "", "number");
    },
    equation: function () {
      var total = rand(12, 20);
      var part = rand(3, 9);
      var form = sample([1, 2, 3, 4]);
      if (form === 1) return makeQuestion("equation", "application", "□ + " + part + " = " + total + "，□里填几？", total - part, [], "", "number");
      if (form === 2) return makeQuestion("equation", "application", total + " - □ = " + part + "，□里填几？", total - part, [], "", "number");
      if (form === 3) return makeQuestion("equation", "application", part + " + □ = " + total + "，□里填几？", total - part, [], "", "number");
      return makeQuestion("equation", "application", "□ - " + part + " = " + (total - part) + "，□里填几？", total, [], "", "number");
    },
    compare: function () {
      var a = rand(8, 18);
      var b = rand(2, 8);
      var c = rand(8, 18);
      var d = rand(2, 8);
      var left = sample([a + b, a - Math.min(b, a - 1)]);
      var right = sample([c + d, c - Math.min(d, c - 1)]);
      var leftText = left === a + b ? a + " + " + b : a + " - " + Math.min(b, a - 1);
      var rightText = right === c + d ? c + " + " + d : c + " - " + Math.min(d, c - 1);
      var answer = left === right ? "一样大" : left > right ? "左边大" : "右边大";
      return makeQuestion("expressionCompare", "application", leftText + " 和 " + rightText + "，哪边大？", answer, ["左边大", "右边大", "一样大", "不能确定"]);
    },
    countRelation: function () {
      var total = rand(12, 20);
      var known = rand(4, total - 4);
      var form = sample([1, 2, 3]);
      if (form === 1) return makeQuestion("difference", "application", "公鸡和母鸡一共有 " + total + " 只，公鸡有 " + known + " 只，母鸡有几只？", total - known, [], "", "number");
      if (form === 2) return makeQuestion("difference", "application", "红球和蓝球共 " + total + " 个，蓝球有 " + known + " 个，红球有几个？", total - known, [], "", "number");
      return makeQuestion("difference", "application", "一共有 " + total + " 个水果，其中苹果有 " + known + " 个，其他水果有几个？", total - known, [], "", "number");
    },
    pattern: function () {
      var patterns = [
        { seq: [4, 7, 10, 13, "?"], answer: 16, options: [15, 16, 17, 18] },
        { seq: [20, 17, 14, 11, "?"], answer: 8, options: [7, 8, 9, 10] },
        { seq: ["红", "蓝", "蓝", "红", "蓝", "蓝", "?"], answer: "红", options: ["红", "蓝", "黄", "绿"] },
        { seq: ["○", "△", "□", "○", "△", "?"], answer: "□", options: ["○", "△", "□", "☆"] },
      ];
      var p = sample(patterns);
      return makeQuestion("pattern", "application", "看规律，问号应该是什么？", p.answer, p.options, makeNumberLine(p.seq));
    },
    timePage: function () {
      var start = rand(2, 8);
      var end = start + rand(3, 8);
      return makeQuestion("story", "application", "小朋友今天从第 " + start + " 页看到第 " + end + " 页，今天看了多少页？", end - start + 1, [], "", "number");
    },
    geometry: function () {
      var form = sample([1, 2, 3]);
      var shape;
      if (form === 1) return makeQuestion("planeShape", "advanced", "长方形有几个角？", 4, ["3", "4", "5", "6"], planeShapeSvg("长方形"));
      if (form === 2) return makeQuestion("planeShape", "advanced", "三角形有几条边？", 3, ["2", "3", "4", "5"], planeShapeSvg("三角形"));
      shape = sample(["正方体", "长方体", "圆柱", "球"]);
      return makeQuestion("solidShape", "grade1", "这个立体图形最像什么？", shape, ["正方体", "长方体", "圆柱", "球"], solidShapeSvg(shape));
    },
  };

  function generateDailyQuestions() {
    var plan = ["story", "story", "queue", "equation", "compare", "countRelation", "pattern", "timePage", "geometry", "story"];
    var usedKeys = {};
    var usedTypeAnswers = {};
    var questions = [];
    var i;
    var makerName;
    for (i = 0; i < plan.length; i += 1) {
      makerName = plan[i];
      questions.push(createUniqueDailyQuestion(makerName, usedKeys, usedTypeAnswers));
    }
    return shuffle(questions);
  }

  function createUniqueDailyQuestion(makerName, usedKeys, usedTypeAnswers) {
    var fallback = null;
    var attempt;
    var question;
    var exactKey;
    var typeAnswerKey;
    for (attempt = 0; attempt < 40; attempt += 1) {
      question = dailyMakers[makerName]();
      exactKey = getQuestionKey(question);
      typeAnswerKey = makerName + "|" + question.answer;
      if (!fallback) fallback = question;
      if (!usedKeys[exactKey] && !usedTypeAnswers[typeAnswerKey]) {
        usedKeys[exactKey] = true;
        usedTypeAnswers[typeAnswerKey] = true;
        return question;
      }
    }
    exactKey = getQuestionKey(fallback);
    usedKeys[exactKey] = true;
    usedTypeAnswers[makerName + "|" + fallback.answer] = true;
    return fallback;
  }

  function generateQuestions() {
    var plan = ["count", "compare", "decompose", "placeValue", "add10", "subtract10", "teenSense", "add20", "makeTen", "equation", "expressionCompare", "difference", "solidShape", "position", "pattern", "logic", "story", "borrowSub", "hundredSense", "planeShape"];
    var usedKeys = {};
    var usedTypeAnswers = {};
    var questions = [];
    var i;
    for (i = 0; i < plan.length; i += 1) questions.push(createUniqueQuestion(plan[i], usedKeys, usedTypeAnswers));
    return shuffle(questions);
  }

  function startPractice() {
    state.practiceQuestion = makers[sample(["count", "compare", "decompose", "add10", "subtract10", "teenSense", "pattern", "position"])]();
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
    clearFlowTimers();
    clearStoredAssessment();
    resetAssessmentTrackingIds();
    state.mode = "assessment";
    state.questions = generateQuestions();
    state.index = 0;
    state.answers = [];
    state.selectedAnswer = "";
    state.toastMessage = "";
    state.posterVisible = false;
    state.startedAt = new Date().getTime();
    state.questionStartedAt = new Date().getTime();
    state.screen = "test";
    state.now = new Date().getTime();
    startTicker();
    trackEvent("start_test", {});
    renderAndMaybeSpeak(true);
  }

  function startDailyPractice() {
    safeCancelSpeech();
    clearFlowTimers();
    state.mode = "daily";
    state.questions = generateDailyQuestions();
    state.index = 0;
    state.answers = [];
    state.selectedAnswer = "";
    state.toastMessage = "";
    state.posterVisible = false;
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

  function clearFlowTimers() {
    try {
      clearTimeout(state.toastTimer);
      clearTimeout(state.autoAdvanceTimer);
      clearTimeout(state.analysisTimer);
    } catch (error) {}
    state.toastTimer = null;
    state.autoAdvanceTimer = null;
    state.analysisTimer = null;
  }

  function showProgressToast() {
    var percent = Math.round((state.answers.length / state.questions.length) * 100);
    if (!state.answers.length || state.answers.length >= state.questions.length) return;
    if (state.answers.length % 5 !== 0) return;
    try {
      clearTimeout(state.toastTimer);
    } catch (error) {}
    state.toastMessage = "已完成" + percent + "%，继续加油！";
    render();
    state.toastTimer = window.setTimeout(function () {
      state.toastMessage = "";
      if (state.screen === "test") render();
    }, 2000);
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
    var durationMs;
    var isCorrect;
    if (!rawAnswer) return;
    durationMs = Math.max(0, new Date().getTime() - state.questionStartedAt);
    usedSeconds = elapsedSeconds(state.questionStartedAt);
    isCorrect = rawAnswer === question.answer;
    state.answers = state.answers.slice(0, state.index);
    state.answers.push({
      question: question,
      answer: rawAnswer,
      correct: isCorrect,
      usedSeconds: usedSeconds,
      speedRatio: usedSeconds / question.referenceSeconds,
    });
    if (state.mode === "assessment") {
      trackEvent("question_answered", {
        question_id: question.id,
        question_category: question.type,
        is_correct: isCorrect,
        duration_ms: durationMs,
      });
    }
    state.selectedAnswer = "";
    if (state.index >= state.questions.length - 1) {
      finishTest();
    } else {
      state.index += 1;
      state.questionStartedAt = new Date().getTime();
      showProgressToast();
      renderAndMaybeSpeak(true);
    }
  }

  function goPreviousQuestion() {
    if (state.screen !== "test") return;
    if (state.index <= 0) return;
    safeCancelSpeech();
    state.index -= 1;
    state.answers = state.answers.slice(0, state.index);
    state.selectedAnswer = "";
    state.questionStartedAt = new Date().getTime();
    renderAndMaybeSpeak(false);
  }

  function finishTest() {
    safeCancelSpeech();
    stopTicker();
    clearFlowTimers();
    if (state.mode === "daily") {
      state.screen = "dailyResult";
      render();
      return;
    }
    state.result = calculateResult(state.answers);
    trackEvent("finish_test", {
      duration_ms: Math.max(0, new Date().getTime() - state.startedAt),
      total_questions: state.answers.length,
      correct_count: countCorrect(state.answers),
    });
    trackEvent("result_level", {
      level: state.result.level.name,
      score: state.result.score,
    });
    state.unlockOverlay = false;
    state.posterImageUrl = "";
    state.posterPreviewOpen = false;
    state.posterVisible = false;
    persistAssessment(false);
    state.screen = "analyzing";
    render();
    state.analysisTimer = window.setTimeout(function () {
      state.screen = "sharePoster";
      render();
    }, 1500);
  }

  function unlockResult() {
    state.unlockOverlay = false;
    state.posterPreviewOpen = false;
    trackEvent("unlock_result", {});
    persistAssessment(true);
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
      '<section class="hero page-fade"><div class="home-hero"><div class="free-badge">免费测评</div><h1>测一测<br>孩子能不能顺利衔接一年级数学</h1><p class="lead hero-lead">20道题｜约5分钟完成<br>覆盖20以内数感、加减法、图形、逻辑思维。</p></div><div class="parent-guide value-guide"><div class="guide-step"><span class="step-icon">1</span><strong>家长读题</strong><span>按题目轻声读给孩子听。</span></div><div class="guide-step"><span class="step-icon">2</span><strong>孩子回答</strong><span>孩子口答，家长代为点击。</span></div><div class="guide-step"><span class="step-icon">3</span><strong>AI生成测评报告</strong><span>生成等级、优势和家庭建议。</span></div></div><div class="home-cta"><button class="primary hero-button" data-action="start">立即免费测评</button><button class="secondary daily-button" data-action="daily">每天高阶练习题</button><div class="sub-actions"><button class="text-button" data-action="practice">试做一题</button><button class="text-button" data-action="share-page">分享给家长</button></div><button class="link-button" data-action="preview">查看评分标准 &gt;</button></div><p class="footer-hint">高阶练习适合日常巩固，题目更接近一年级真实练习。</p></section>';
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
    var actionHtml =
      question.input === "number"
        ? '<button class="secondary" data-action="prev" ' +
          (state.index > 0 ? "" : "disabled") +
          '>上一题</button><button class="secondary" data-action="skip">跳过</button><button class="primary" data-action="next" ' +
          (state.selectedAnswer ? "" : "disabled") +
          ">提交答案</button>"
        : '<button class="secondary" data-action="prev" ' + (state.index > 0 ? "" : "disabled") + '>上一题</button><button class="secondary" data-action="skip">跳过</button>';
    app.innerHTML =
      '<section class="test-layout page-fade"><div class="test-topbar"><div class="brand"><span class="brand-mark">' +
      (state.index + 1) +
      "</span><span>第 " +
      (state.index + 1) +
      " / " +
      state.questions.length +
      ' 题</span></div><button class="ghost" data-action="restart">重新开始</button></div><div class="progress-wrap"><div class="progress-bar" style="width:' +
      progress +
      '%"></div></div><div class="progress-blocks">' +
      renderProgressBlocks() +
      '</div><div class="test-main"><article class="question-card"><div class="question-meta"><span class="tag">' +
      question.typeLabel +
      '</span><span class="tag alt">' +
      difficultyLabel(question.difficulty) +
      '</span><span class="tag hot">参考 ' +
      question.referenceSeconds +
      " 秒</span>" +
      readButtonHtml() +
      '</div><div class="question-center"><h2 class="question-title">' +
      escapeHtml(question.prompt) +
      '</h2><div class="question-visual ' +
      (question.visual ? "" : "hidden") +
      '">' +
      question.visual +
      '</div><div class="answer-area">' +
      renderAnswerInput(question) +
      '</div></div><div class="question-bottom"><div class="question-actions">' +
      actionHtml +
      '</div><div class="timer-strip"><span>总计时 <strong data-total-timer>' +
      formatTime(totalElapsed) +
      '</strong></span><span>本题 <strong data-question-timer>' +
      formatTime(questionElapsed) +
      "</strong></span><span>已答 <strong>" +
      state.answers.length +
      " / " +
      state.questions.length +
      "</strong></span></div></div>" +
      '</article><aside class="panel"><div><p class="small">总用时</p><div class="timer" data-total-timer>' +
      formatTime(totalElapsed) +
      '</div></div><div><p class="small">本题用时</p><div class="timer" data-question-timer>' +
      formatTime(questionElapsed) +
      '</div></div><div class="stat-grid"><div class="stat"><strong>' +
      state.answers.length +
      '</strong><span>已完成</span></div><div class="stat"><strong>' +
      countCorrect(state.answers) +
      '</strong><span>已答对</span></div></div><p class="small">基础题会更看熟练度；应用题、规律题会给孩子更多思考空间。</p></aside></div>' +
      (state.toastMessage ? '<div class="encourage-toast">🎉 ' + escapeHtml(state.toastMessage) + "</div>" : "") +
      "</section>";
  }

  function renderProgressBlocks() {
    var html = "";
    var i;
    for (i = 0; i < state.questions.length; i += 1) {
      html += '<span class="' + (i < state.answers.length ? "done" : i === state.index ? "active" : "") + '"></span>';
    }
    return html;
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

  function renderAnalyzing() {
    app.innerHTML =
      '<section class="complete-layout page-fade"><article class="complete-card"><div class="complete-burst">🎉</div><h1>恭喜！</h1><p class="lead">孩子已经完成全部20道题！</p><div class="analysis-box"><div class="analysis-spinner"></div><strong>AI正在分析孩子数学能力...</strong><span>正在生成能力画像、优势和家庭建议</span></div></article></section>';
  }

  function getHomeShareUrl() {
    var url = getPublicShareUrl();
    try {
      return url.split("?")[0].split("#")[0];
    } catch (error) {
      return url;
    }
  }

  function getQrImageUrl(size) {
    return "https://api.qrserver.com/v1/create-qr-code/?size=" + size + "x" + size + "&margin=12&data=" + encodeURIComponent(getHomeShareUrl());
  }

  function renderPosterPreviewCard() {
    return (
      '<div class="share-poster-card"><div class="poster-free">免费测评</div><h2>小学数学入学准备测评</h2><p class="poster-line">20道题｜约5分钟</p><p class="poster-copy">测一测孩子能不能顺利衔接一年级数学</p><div class="poster-qr"><img src="' +
      getQrImageUrl(220) +
      '" alt="扫码免费测评二维码"></div><strong>扫码免费测评</strong></div>'
    );
  }

  function renderSharePoster() {
    var saveButton = isWeChatBrowser() ? "" : '<a class="secondary save-poster-button" href="' + escapeHtml(state.posterImageUrl) + '" download="小学数学入学准备测评海报.png">保存图片</a>';
    var overlay = state.posterPreviewOpen && state.posterImageUrl
      ? '<div class="poster-preview-mask"><div class="poster-preview-panel"><p>' +
        (isWeChatBrowser() ? "长按图片保存，发送给家人或家长群。" : "可保存图片后发送给家人或家长群。") +
        '</p><img src="' +
        escapeHtml(state.posterImageUrl) +
        '" alt="分享海报大图">' +
        saveButton +
        '<button class="text-button" data-action="close-poster-preview">关闭预览</button></div></div>'
      : "";
    app.innerHTML =
      '<section class="share-poster-layout page-fade"><div class="share-poster-head"><h1>测评已完成</h1><p>孩子的完整测评报告已经生成</p></div>' +
      renderPosterPreviewCard() +
      '<p class="share-poster-tip">长按保存图片，发送给家人或家长群，其他家长扫码即可免费测评</p><div class="share-poster-actions"><button class="primary hero-button" data-action="generate-share-poster">生成分享海报</button><button class="secondary" data-action="confirm-unlock">我已分享，查看结果</button></div>' +
      overlay +
      "</section>";
  }

  function drawRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    var words = String(text).split("");
    var line = "";
    var i;
    for (i = 0; i < words.length; i += 1) {
      if (ctx.measureText(line + words[i]).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = words[i];
        y += lineHeight;
      } else {
        line += words[i];
      }
    }
    if (line) ctx.fillText(line, x, y);
    return y;
  }

  function drawFallbackQr(ctx, x, y, size) {
    var cells = 29;
    var cell = size / cells;
    var i;
    var j;
    var value;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = "#182032";
    function finder(px, py) {
      ctx.fillRect(x + px * cell, y + py * cell, cell * 7, cell * 7);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + (px + 1) * cell, y + (py + 1) * cell, cell * 5, cell * 5);
      ctx.fillStyle = "#182032";
      ctx.fillRect(x + (px + 2) * cell, y + (py + 2) * cell, cell * 3, cell * 3);
    }
    finder(1, 1);
    finder(21, 1);
    finder(1, 21);
    for (i = 0; i < cells; i += 1) {
      for (j = 0; j < cells; j += 1) {
        if ((i < 9 && j < 9) || (i > 19 && j < 9) || (i < 9 && j > 19)) continue;
        value = (i * 7 + j * 11 + getHomeShareUrl().length * 3) % 5;
        if (value === 0 || value === 2) ctx.fillRect(x + i * cell, y + j * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
  }

  function drawSharePoster(qrImage) {
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");
    var gradient;
    canvas.width = 1080;
    canvas.height = 1440;
    gradient = ctx.createLinearGradient(0, 0, 1080, 1440);
    gradient.addColorStop(0, "#fff8e7");
    gradient.addColorStop(1, "#eefbf3");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1440);

    drawRoundRect(ctx, 70, 74, 940, 1240, 48);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "rgba(18, 183, 106, 0.18)";
    ctx.lineWidth = 4;
    ctx.stroke();

    drawRoundRect(ctx, 110, 118, 218, 82, 41);
    ctx.fillStyle = "#ff5a1f";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 42px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("免费测评", 219, 172);

    ctx.fillStyle = "#182032";
    ctx.font = "900 78px sans-serif";
    ctx.textAlign = "left";
    drawWrappedText(ctx, "小学数学入学准备测评", 110, 330, 860, 92);

    ctx.fillStyle = "#12b76a";
    ctx.font = "900 46px sans-serif";
    ctx.fillText("20道题｜约5分钟", 110, 510);

    ctx.fillStyle = "#475467";
    ctx.font = "700 44px sans-serif";
    drawWrappedText(ctx, "测一测孩子能不能顺利衔接一年级数学", 110, 620, 830, 62);

    drawRoundRect(ctx, 335, 760, 410, 410, 36);
    ctx.fillStyle = "#f7fff9";
    ctx.fill();
    if (qrImage) ctx.drawImage(qrImage, 385, 810, 310, 310);
    else drawFallbackQr(ctx, 385, 810, 310);

    ctx.fillStyle = "#182032";
    ctx.font = "900 46px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("扫码免费测评", 540, 1250);
    ctx.fillStyle = "#667085";
    ctx.font = "500 26px sans-serif";
    ctx.fillText(getHomeShareUrl(), 540, 1304);
    return canvas.toDataURL("image/png");
  }

  function generateSharePoster() {
    var img;
    trackEvent("generate_poster", {});
    try {
      img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        try {
          state.posterImageUrl = drawSharePoster(img);
        } catch (error) {
          state.posterImageUrl = drawSharePoster(null);
        }
        state.posterPreviewOpen = true;
        render();
      };
      img.onerror = function () {
        state.posterImageUrl = drawSharePoster(null);
        state.posterPreviewOpen = true;
        render();
      };
      img.src = getQrImageUrl(360);
    } catch (error2) {
      state.posterImageUrl = drawSharePoster(null);
      state.posterPreviewOpen = true;
      render();
    }
  }

  function renderUnlock() {
    var inWechat = isWeChatBrowser();
    var buttonText = "分享后查看结果";
    var overlayTitle = inWechat ? "点击右上角..." : "分享链接已准备好";
    var overlayText = inWechat ? "发送给好友，或发送到微信群。分享后回到这里点击下方按钮查看完整报告。" : "可以发送给家人或班级群。完成后回到这里点击下方按钮查看完整报告。";
    var overlay = state.unlockOverlay
      ? '<div class="share-mask"><div class="share-arrow">...</div><div class="share-dialog"><h2>' +
        overlayTitle +
        '</h2><p>' +
        overlayText +
        '</p><div class="share-options"><span>发送给好友</span><span>发送到微信群</span></div><button class="primary" data-action="confirm-unlock">我已分享，查看结果</button></div></div>'
      : "";
    app.innerHTML =
      '<section class="unlock-layout page-fade"><div class="topbar"><div class="brand"><span class="brand-mark">报</span><span>测评报告</span></div></div><article class="unlock-card"><p class="pill">数学能力分析已完成</p><h1>免费查看完整测评报告</h1><p class="lead">详细报告已生成。分享给家人或班级群即可查看完整报告。</p><div class="unlock-actions"><button class="primary hero-button" data-action="share-unlock">' +
      buttonText +
      '</button><button class="secondary" data-action="restart">重新测一次</button></div></article><p class="footer-hint">不会读取真实分享状态，点击确认后即可查看结果。</p>' +
      overlay +
      "</section>";
  }

  function renderDailyResult() {
    var total = state.answers.length;
    var correct = countCorrect(state.answers);
    var percent = total ? Math.round((correct / total) * 100) : 0;
    var mistakes = filterAnswers(state.answers, function (answer) {
      return !answer.correct;
    });
    var title = percent >= 90 ? "今日高阶练习很稳" : percent >= 70 ? "今日练习完成不错" : "今日重点复盘错题";
    app.innerHTML =
      '<section class="result-layout page-fade"><div class="topbar"><div class="brand"><span class="brand-mark">练</span><span>每日高阶练习</span></div><button class="secondary" data-action="home">返回首页</button></div><article class="result-card result-summary"><p class="pill">一年级真实题型练习</p><h1 class="level">' +
      title +
      '</h1><p class="lead">这组题更偏一年级练习纸里的应用题、填空题和数量关系题。</p><div class="score-row"><div class="stat score-stat"><strong>' +
      correct +
      "/" +
      total +
      '</strong><span>答对题数</span></div><div class="stat"><strong>' +
      percent +
      '%</strong><span>正确率</span></div><div class="stat"><strong>' +
      formatTime(elapsedSeconds(state.startedAt)) +
      '</strong><span>总用时</span></div><div class="stat"><strong>' +
      mistakes.length +
      '</strong><span>错题</span></div></div></article><div class="report-grid"><div class="mini-card"><h3>今日建议</h3><p>' +
      (mistakes.length ? "先把错题讲清楚：让孩子说一说题目问什么、已知什么、要求什么，再列式。" : "今天表现很棒，可以继续保持每天10分钟的综合题练习。") +
      '</p></div><div class="mini-card review-card"><h3>错题复盘</h3>' +
      (mistakes.length ? '<div class="mistake-list">' + renderMistakes(mistakes) + "</div>" : "<p>这组高阶题没有错题，可以明天继续挑战。</p>") +
      '</div><div class="result-actions"><button class="primary hero-button" data-action="daily">再来一组高阶练习</button><button class="secondary" data-action="start">做入学测评</button></div></div></section>';
  }

  function getDisplayGrade(score) {
    if (score >= 95) return { mark: "A+", text: "优秀" };
    if (score >= 88) return { mark: "A", text: "优秀" };
    if (score >= 78) return { mark: "B+", text: "良好" };
    if (score >= 68) return { mark: "B", text: "稳步衔接" };
    return { mark: "C", text: "需要加强" };
  }

  function getDimensionScore(dimensions, key) {
    var i;
    for (i = 0; i < dimensions.length; i += 1) {
      if (dimensions[i].key === key) return Math.round(dimensions[i].accuracy * 100);
    }
    return 0;
  }

  function renderAbilityCards(result) {
    var items = [
      ["数感", getDimensionScore(result.dimensions, "numberSense")],
      ["计算", getDimensionScore(result.dimensions, "calculation")],
      ["图形", getDimensionScore(result.dimensions, "geometry")],
      ["逻辑", getDimensionScore(result.dimensions, "application")],
    ];
    var html = "";
    var i;
    for (i = 0; i < items.length; i += 1) {
      html += '<div class="ability-card"><span>' + items[i][0] + '</span><strong>' + items[i][1] + '</strong><div class="bar"><span style="width:' + items[i][1] + '%"></span></div></div>';
    }
    return html;
  }

  function renderAbilityRadar(result) {
    var scores = [
      getDimensionScore(result.dimensions, "numberSense"),
      getDimensionScore(result.dimensions, "calculation"),
      getDimensionScore(result.dimensions, "geometry"),
      getDimensionScore(result.dimensions, "application"),
    ];
    var labels = ["数感", "计算", "图形", "逻辑"];
    var points = "";
    var labelHtml = "";
    var center = 50;
    var radius = 34;
    var angles = [-90, 0, 90, 180];
    var i;
    var angle;
    var r;
    var x;
    var y;
    for (i = 0; i < scores.length; i += 1) {
      angle = (Math.PI / 180) * angles[i];
      r = radius * scores[i] / 100;
      x = center + Math.cos(angle) * r;
      y = center + Math.sin(angle) * r;
      points += x + "," + y + " ";
    }
    for (i = 0; i < labels.length; i += 1) labelHtml += '<span>' + labels[i] + '</span>';
    return '<div class="radar-card"><svg viewBox="0 0 100 100" aria-label="能力雷达图"><polygon points="50,16 84,50 50,84 16,50" class="radar-grid"></polygon><line x1="50" y1="16" x2="50" y2="84"></line><line x1="16" y1="50" x2="84" y2="50"></line><polygon points="' + points + '" class="radar-area"></polygon></svg><div class="radar-labels">' + labelHtml + "</div></div>";
  }

  function renderResult() {
    var result = state.result;
    var grade = getDisplayGrade(result.score);
    var mistakes = filterAnswers(state.answers, function (answer) {
      return !answer.correct;
    });
    var html =
      '<section class="result-layout page-fade"><div class="topbar"><div class="brand"><span class="brand-mark">果</span><span>完整测评报告</span></div><button class="secondary" data-action="restart">再测一次</button></div><div class="result-hero"><article class="result-card result-summary"><div class="grade-badge"><strong>' +
      grade.mark +
      '</strong><span>' +
      grade.text +
      '</span></div><p class="pill">孩子等级</p><h1 class="level">' +
      result.level.name +
      '</h1><p class="lead">' +
      result.level.summary +
      '</p><div class="score-row"><div class="stat score-stat"><strong>' +
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
      '</strong><span>用时</span></div></div><div><div class="qr">QR</div><p class="small">分享到家长群，邀请更多孩子一起测一测。</p></div></div></aside></div><div class="report-grid"><div class="mini-card ability-section"><h3>能力雷达图</h3>' +
      renderAbilityRadar(result) +
      '<div class="ability-grid">' +
      renderAbilityCards(result) +
      '</div></div><div class="mini-card"><h3>为什么是这个等级</h3><p>' +
      result.advice.reason +
      '</p><p class="small">一年级上册是主要评分依据，下册题只用于识别超前表现。</p></div><div class="mini-card"><h3>优势</h3><ul>' +
      renderList(result.advice.strengths) +
      '</ul></div><div class="mini-card"><h3>需要加强</h3><p>' +
      (result.weakDimensions.length ? result.weakDimensions.join("、") : "暂未发现明显短板，可以继续保持稳定练习。") +
      '</p></div><div class="mini-card"><h3>家庭建议</h3><ul>' +
      renderList(result.advice.nextSteps) +
      '</ul></div><div class="mini-card"><h3>用时观察</h3><p>' +
      (result.slowTypes.length ? "相对偏慢的题型：" + result.slowTypes.join("、") + "。" : "整体速度表现比较均衡，没有特别突出的慢项。") +
      '</p></div><div class="mini-card"><h3>超前信号</h3><p>' +
      Math.round(result.advancedAccuracy * 100) +
      "% 的超前观察题答对。" +
      (result.advancedAccuracy >= 0.6 ? "可以适当接触一年级下册基础内容。" : "目前先巩固一年级上册核心内容更合适。") +
      '</p></div><div class="mini-card review-card"><h3>错题复盘</h3>' +
      (mistakes.length ? '<div class="mistake-list">' + renderMistakes(mistakes) + "</div>" : "<p>这次没有错题，基础状态很漂亮。可以重点观察速度和表达是否稳定。</p>") +
      '</div><div class="result-actions"><button class="primary hero-button" data-action="poster">生成分享海报</button><button class="secondary" data-action="copy">复制结果文案</button></div>' +
      (state.posterVisible ? '<div class="poster-mobile"><div class="poster-inner"><div><div class="poster-title">小学数学入学准备测评</div><div class="poster-level">' + result.level.name + '</div><p class="small">' + result.level.summary + '</p></div><div class="stat-grid"><div class="stat"><strong>' + result.score + '</strong><span>综合分</span></div><div class="stat"><strong>' + Math.round(result.accuracy * 100) + '%</strong><span>正确率</span></div></div><p class="small">可截图保存，分享给家人一起看。</p></div></div>' : "") +
      "</div></section>";
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
      if (state.screen === "analyzing") renderAnalyzing();
      if (state.screen === "sharePoster") renderSharePoster();
      if (state.screen === "unlock") renderUnlock();
      if (state.screen === "result") renderResult();
      if (state.screen === "dailyResult") renderDailyResult();
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
      if (state.screen === "test" && state.questions[state.index] && state.questions[state.index].input !== "number") {
        try {
          clearTimeout(state.autoAdvanceTimer);
        } catch (error) {}
        state.autoAdvanceTimer = window.setTimeout(function () {
          answerCurrent();
        }, 120);
      }
      return;
    }
    if (!actionNode) return;
    action = actionNode.getAttribute("data-action");
    if (action === "practice") startPractice();
    if (action === "check-practice") checkPractice();
    if (action === "read-question") speakCurrentQuestion();
    if (action === "share-page") sharePage();
    if (action === "start") startTest();
    if (action === "daily") startDailyPractice();
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
      clearFlowTimers();
      state.result = null;
      state.answers = [];
      state.unlockOverlay = false;
      state.posterImageUrl = "";
      state.posterPreviewOpen = false;
      state.posterVisible = false;
      clearStoredAssessment();
      state.screen = "home";
      render();
    }
    if (action === "share-unlock") {
      if (!isWeChatBrowser()) copyText(SHARE_CONFIG.title + "\n" + SHARE_CONFIG.desc + "\n" + getPublicShareUrl());
      state.unlockOverlay = true;
      render();
    }
    if (action === "generate-share-poster") generateSharePoster();
    if (action === "close-poster-preview") {
      state.posterPreviewOpen = false;
      render();
    }
    if (action === "confirm-unlock") unlockResult();
    if (action === "skip") {
      state.selectedAnswer = "（跳过）";
      answerCurrent();
    }
    if (action === "prev") goPreviousQuestion();
    if (action === "next") answerCurrent();
    if (action === "poster") {
      state.posterVisible = true;
      render();
    }
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
    initTrackingIds();
    restoreUnlockedAssessment();
    render();
    initWeChatShare();
    trackEvent("page_view", {});
  } catch (error) {
    app.innerHTML = '<section class="result-card"><h1 class="level">页面加载遇到问题</h1><p class="lead">请刷新页面再试。</p></section>';
  }
})();
