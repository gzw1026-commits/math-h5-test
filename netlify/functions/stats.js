"use strict";

function json(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function fail(statusCode, errorCode) {
  return json(statusCode, { ok: false, error: errorCode || "request_failed" });
}

function getHeader(headers, name) {
  var key;
  var lower = String(name).toLowerCase();
  headers = headers || {};
  for (key in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, key) && String(key).toLowerCase() === lower) return headers[key];
  }
  return "";
}

function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function uniqueCount(map) {
  var key;
  var count = 0;
  for (key in map) {
    if (Object.prototype.hasOwnProperty.call(map, key)) count += 1;
  }
  return count;
}

function pushCount(map, key) {
  key = String(key || "未知");
  map[key] = (map[key] || 0) + 1;
}

function pushAccuracy(map, key, isCorrect) {
  key = String(key || "未知");
  if (!map[key]) map[key] = { total: 0, correct: 0 };
  map[key].total += 1;
  if (isCorrect) map[key].correct += 1;
}

function accuracyArray(map) {
  var key;
  var out = [];
  for (key in map) {
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      out.push({
        name: key,
        total: map[key].total,
        correct: map[key].correct,
        accuracy: percent(map[key].correct, map[key].total),
      });
    }
  }
  out.sort(function (a, b) {
    if (a.accuracy === b.accuracy) return b.total - a.total;
    return a.accuracy - b.accuracy;
  });
  return out;
}

function countArray(map) {
  var key;
  var out = [];
  for (key in map) {
    if (Object.prototype.hasOwnProperty.call(map, key)) out.push({ name: key, count: map[key] });
  }
  out.sort(function (a, b) {
    return b.count - a.count;
  });
  return out;
}

function parseRequestBody(event) {
  var contentType = getHeader(event.headers, "content-type").toLowerCase();
  var body = event.body || "";
  var parts;
  var item;
  var pair;
  var data = {};
  var i;

  if (contentType.indexOf("application/json") !== -1) {
    return JSON.parse(body || "{}");
  }

  if (contentType.indexOf("application/x-www-form-urlencoded") !== -1) {
    parts = body.split("&");
    for (i = 0; i < parts.length; i += 1) {
      item = parts[i];
      if (!item) continue;
      pair = item.split("=");
      data[decodeURIComponent(pair[0] || "")] = decodeURIComponent((pair[1] || "").replace(/\+/g, " "));
    }
    return data;
  }

  return null;
}

function normalizePassword(value) {
  return String(value || "").replace(/^\s+|\s+$/g, "");
}

function buildStats(rows) {
  var pageSessions = {};
  var startedAssessments = {};
  var finishedAssessments = {};
  var posterAssessments = {};
  var unlockedAssessments = {};
  var levelMap = {};
  var questionMap = {};
  var categoryMap = {};
  var finishDurations = [];
  var i;
  var row;
  var payload;

  rows = rows || [];
  for (i = 0; i < rows.length; i += 1) {
    row = rows[i] || {};
    payload = row.payload || {};
    if (row.event_name === "page_view") pageSessions[row.session_id] = true;
    if (row.event_name === "start_test") startedAssessments[row.assessment_id] = true;
    if (row.event_name === "finish_test") {
      finishedAssessments[row.assessment_id] = true;
      if (typeof payload.duration_ms === "number" && isFinite(payload.duration_ms)) finishDurations.push(payload.duration_ms);
    }
    if (row.event_name === "generate_poster") posterAssessments[row.assessment_id] = true;
    if (row.event_name === "unlock_result") unlockedAssessments[row.assessment_id] = true;
    if (row.event_name === "result_level") pushCount(levelMap, payload.level);
    if (row.event_name === "question_answered") {
      pushAccuracy(questionMap, payload.question_id, payload.is_correct);
      pushAccuracy(categoryMap, payload.question_category, payload.is_correct);
    }
  }

  var visitSessions = uniqueCount(pageSessions);
  var starts = uniqueCount(startedAssessments);
  var finishes = uniqueCount(finishedAssessments);
  var posters = uniqueCount(posterAssessments);
  var unlocks = uniqueCount(unlockedAssessments);
  var durationSum = 0;
  for (i = 0; i < finishDurations.length; i += 1) durationSum += finishDurations[i];

  return {
    summary: {
      visit_sessions: visitSessions,
      start_tests: starts,
      finish_tests: finishes,
      start_rate: percent(starts, visitSessions),
      finish_rate: percent(finishes, starts),
      poster_rate: percent(posters, finishes),
      result_view_rate: percent(unlocks, finishes),
      average_finish_seconds: finishDurations.length ? Math.round(durationSum / finishDurations.length / 1000) : 0,
    },
    level_distribution: countArray(levelMap),
    question_accuracy: accuracyArray(questionMap),
    category_accuracy: accuracyArray(categoryMap),
  };
}

exports.handler = async function (event) {
  var data;
  var submittedPassword;
  var supabaseUrl;
  var serviceKey;
  var adminPassword;
  var response;
  var rows;

  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return fail(405, "method_not_allowed");

  try {
    data = parseRequestBody(event);
  } catch (error) {
    return fail(400, "invalid_body");
  }
  if (!data) return fail(415, "unsupported_content_type");

  adminPassword = normalizePassword(process.env.ADMIN_PASSWORD);
  submittedPassword = normalizePassword(data.password || data.adminPassword);
  if (!adminPassword || !submittedPassword || submittedPassword !== adminPassword) return fail(401, "unauthorized");

  supabaseUrl = process.env.SUPABASE_URL;
  serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return fail(500, "missing_env");

  try {
    response = await fetch(String(supabaseUrl).replace(/\/$/, "") + "/rest/v1/events?select=event_name,session_id,assessment_id,payload,created_at&order=created_at.desc&limit=10000", {
      method: "GET",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
        Accept: "application/json",
      },
    });
    if (!response.ok) return fail(500, "supabase_request_failed");
    rows = await response.json();
    return json(200, { ok: true, data: buildStats(rows) });
  } catch (error2) {
    return fail(500, "supabase_request_failed");
  }
};
