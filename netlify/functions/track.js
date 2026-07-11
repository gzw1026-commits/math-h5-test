"use strict";

var ALLOWED_EVENTS = {
  page_view: true,
  start_test: true,
  question_answered: true,
  finish_test: true,
  generate_poster: true,
  unlock_result: true,
  result_level: true,
};

var MAX_BODY_BYTES = 10 * 1024;

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

function getHeader(headers, name) {
  var key;
  var lower = String(name).toLowerCase();
  headers = headers || {};
  for (key in headers) {
    if (Object.prototype.hasOwnProperty.call(headers, key) && String(key).toLowerCase() === lower) {
      return headers[key];
    }
  }
  return "";
}

function isPlainObject(value) {
  return !!value && Object.prototype.toString.call(value) === "[object Object]";
}

function validId(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(value);
}

function validSmallString(value, max) {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function validDuration(value) {
  return typeof value === "number" && isFinite(value) && value >= 0 && value <= 30 * 60 * 1000;
}

function normalizePayload(eventName, payload) {
  var clean = {};
  var key;
  var allowed;
  if (!isPlainObject(payload)) return null;
  if (JSON.stringify(payload).length > 4000) return null;

  if (eventName === "question_answered") {
    allowed = { question_id: true, question_category: true, is_correct: true, duration_ms: true };
    for (key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key) && !allowed[key]) return null;
    }
    if (!validSmallString(payload.question_id, 120)) return null;
    if (!validSmallString(payload.question_category, 80)) return null;
    if (typeof payload.is_correct !== "boolean") return null;
    if (!validDuration(payload.duration_ms)) return null;
    clean.question_id = payload.question_id;
    clean.question_category = payload.question_category;
    clean.is_correct = payload.is_correct;
    clean.duration_ms = Math.round(payload.duration_ms);
    return clean;
  }

  if (eventName === "finish_test") {
    if (payload.duration_ms !== undefined && validDuration(payload.duration_ms)) clean.duration_ms = Math.round(payload.duration_ms);
    if (typeof payload.total_questions === "number" && payload.total_questions >= 0 && payload.total_questions <= 100) clean.total_questions = Math.round(payload.total_questions);
    if (typeof payload.correct_count === "number" && payload.correct_count >= 0 && payload.correct_count <= 100) clean.correct_count = Math.round(payload.correct_count);
    return clean;
  }

  if (eventName === "result_level") {
    if (!validSmallString(payload.level, 80)) return null;
    clean.level = payload.level;
    if (typeof payload.score === "number" && payload.score >= 0 && payload.score <= 100) clean.score = Math.round(payload.score);
    return clean;
  }

  return clean;
}

exports.handler = async function (event) {
  var contentType;
  var bodySize;
  var data;
  var payload;
  var supabaseUrl;
  var serviceKey;
  var response;
  var row;

  if (event.httpMethod !== "POST") return json(405, { ok: false });

  contentType = getHeader(event.headers, "content-type");
  if (contentType.toLowerCase().indexOf("application/json") === -1) return json(415, { ok: false });

  bodySize = Buffer.byteLength(event.body || "", event.isBase64Encoded ? "base64" : "utf8");
  if (bodySize <= 0 || bodySize > MAX_BODY_BYTES) return json(413, { ok: false });

  try {
    data = JSON.parse(event.body || "{}");
  } catch (error) {
    return json(400, { ok: false });
  }

  if (!data || !ALLOWED_EVENTS[data.event_name]) return json(400, { ok: false });
  if (!validId(data.visitor_id) || !validId(data.session_id) || !validId(data.assessment_id)) return json(400, { ok: false });

  payload = normalizePayload(data.event_name, data.payload || {});
  if (!payload) return json(400, { ok: false });

  supabaseUrl = process.env.SUPABASE_URL;
  serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json(500, { ok: false });

  row = {
    event_name: data.event_name,
    visitor_id: data.visitor_id,
    session_id: data.session_id,
    assessment_id: data.assessment_id,
    payload: payload,
    user_agent: String(getHeader(event.headers, "user-agent") || "").slice(0, 500),
    created_at: new Date().toISOString(),
  };

  try {
    response = await fetch(String(supabaseUrl).replace(/\/$/, "") + "/rest/v1/events", {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify([row]),
    });
    if (!response.ok) return json(500, { ok: false });
    return json(200, { ok: true });
  } catch (error2) {
    return json(500, { ok: false });
  }
};
