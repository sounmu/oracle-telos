/* eslint-disable */
/*
 * Telos 프론트엔드 (바닐라 JS)
 * 백엔드: oracle-telos (Next.js) API
 *   GET  /api/patents?dataset=korea      → PatentMapResponse
 *   POST /api/search   {query,k,dataset} → SearchResponse (hits, addedPoints, warnings, coverage, elements)
 *   POST /api/compare  {idea,id}         → PatentComparison (rows, proximity, claimsReviewed, claimsTotal, sourceUrl)
 *   GET  /api/patent/:id[?refresh=1]     → PatentFull
 *   POST /api/agent    {idea,dataset}    → SSE AgentEvent 스트림
 *   (제안) GET /api/cases?q=             → DisputeCase[]  지금은 telos.cases.js를 쓴다
 *
 * 실행 방식
 *   - 저장소의 public/telos-ui/ 에 이 폴더를 넣고 http://localhost:3000/telos-ui/ 로 열면 같은 출처라 바로 API를 쓴다.
 *   - 파일을 직접 열면(file://) 또는 ?mock=1 이면 telos.mock.js 목업을 쓴다.
 *   - 다른 주소의 서버를 쓰려면 ?api=http://localhost:3000 (서버에 CORS 허용 필요)
 *   - #demo 를 붙이면 예시 문장으로 바로 검색한다.
 */
(() => {
  "use strict";

  // ---------- 설정 ----------
  const params = new URLSearchParams(location.search);
  const CONFIG = {
    apiBase: (params.get("api") || "").replace(/\/$/, ""),
    dataset: "korea",
    k: 12,
    autoCompare: 3,
    mock: params.has("mock") || location.protocol === "file:",
    minIdea: 5,
    maxIdea: 4000,
  };
  const EXAMPLE = "생분해성 고분자 미립구에 GLP-1 유사체를 담아 4주 동안 방출하는 서방형 주사제";

  // ---------- 유틸 ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const appNo = (id) => String(id || "").replace(/^kipris:/, "");
  const fmtDate = (d) => (d ? String(d).slice(0, 10).replace(/-/g, ".") : "");
  const isAbort = (e) => e && (e.name === "AbortError" || e.message === "Aborted");
  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      if (signal) signal.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
    });
  }
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  // ---------- API ----------
  class ApiError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }
  async function request(path, options = {}) {
    let res;
    try {
      res = await fetch(CONFIG.apiBase + path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    } catch (e) {
      if (isAbort(e)) throw e;
      throw new ApiError(0, "서버에 연결하지 못했어요. 개발 서버가 켜져 있는지 확인해 주세요.");
    }
    let body = null;
    try { body = await res.json(); } catch { /* 본문 없음 */ }
    if (!res.ok) throw new ApiError(res.status, (body && body.error) || `서버 오류가 났어요 (${res.status})`);
    return body;
  }
  const M = window.TELOS_MOCK;
  const api = {
    async patents(signal) {
      if (CONFIG.mock) { await sleep(150, signal); return M.patents; }
      return request(`/api/patents?dataset=${CONFIG.dataset}`, { signal });
    },
    async search(query, signal) {
      if (CONFIG.mock) { await sleep(900, signal); return M.search; }
      return request("/api/search", { method: "POST", body: JSON.stringify({ query, k: CONFIG.k, dataset: CONFIG.dataset }), signal });
    },
    async compare(idea, id, signal) {
      if (CONFIG.mock) { await sleep(700 + Math.random() * 900, signal); return M.compare(id); }
      return request("/api/compare", { method: "POST", body: JSON.stringify({ idea, id }), signal });
    },
    async patent(id, refresh, signal) {
      if (CONFIG.mock) { await sleep(250, signal); return M.patent(id); }
      return request(`/api/patent/${encodeURIComponent(id)}${refresh ? "?refresh=1" : ""}`, { signal });
    },
    async agent(idea, onEvent, signal) {
      if (CONFIG.mock) {
        onEvent({ type: "status", message: "특허를 찾고 있어요" });
        await sleep(500, signal);
        onEvent({ type: "tool", name: "search_patents", input: {} });
        await sleep(500, signal);
        for (const piece of M.agentText.match(/[\s\S]{1,10}/g)) { onEvent({ type: "text", delta: piece }); await sleep(25, signal); }
        onEvent({ type: "done" });
        return;
      }
      let res;
      try {
        res = await fetch(CONFIG.apiBase + "/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea, dataset: CONFIG.dataset, includeContext: false }), signal });
      } catch (e) {
        if (isAbort(e)) throw e;
        throw new ApiError(0, "서버에 연결하지 못했어요.");
      }
      if (!res.ok || !res.body) {
        let b = null; try { b = await res.json(); } catch { /* 없음 */ }
        throw new ApiError(res.status, (b && b.error) || `서버 오류가 났어요 (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let cut;
        while ((cut = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, cut);
          buf = buf.slice(cut + 2);
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            let ev;
            try { ev = JSON.parse(line.slice(6)); } catch { continue; }
            if (ev.type === "done" || ev.type === "error") finished = true;
            onEvent(ev);
          }
        }
      }
      if (!finished) throw new ApiError(0, "응답이 끝나기 전에 연결이 끊겼어요.");
    },
    // 제안 API가 생기기 전까지 로컬 데이터에서 키워드로 고른다.
    cases(texts, limit = 5) {
      const all = Array.isArray(window.TELOS_CASES) ? window.TELOS_CASES : [];
      const hay = texts.filter(Boolean).join(" ").toLowerCase();
      return all
        .map((c) => {
          const kws = (c.keywords || []).map((k) => String(k).toLowerCase());
          const hitKws = kws.filter((k) => k && hay.includes(k));
          return { c, score: hitKws.length, hitKws };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
  };

  // ---------- 표시 규칙 ----------
  const DECISION = {
    ACCEPTED: { label: "등록", cls: "t-green", color: "#0B8A5A" },
    REJECTED: { label: "거절", cls: "t-red", color: "#E42939" },
    PENDING: { label: "심사중", cls: "t-gray", color: "#8B95A1" },
    UNKNOWN: { label: "상태 미확인", cls: "t-gray", color: "#B0B8C1" },
  };
  // 백엔드 src/lib/proximity.ts 단계와 같다. 온도 숫자는 화면용으로 공통 비율을 32~40도로 옮긴 값이다.
  const LEVEL = {
    hot: { short: "뜨거움", word: "뜨거워요", desc: "가까운 요소가 많아요. 자세히 비교해 봐요", color: "#FF6B3D", ink: "#C2410C", mouth: "M41 128q7 -6 14 0" },
    warm: { short: "따뜻", word: "따뜻해요", desc: "겹치는 기술 요소가 있어요", color: "#FFB547", ink: "#B45309", mouth: "M41 126h14" },
    cool: { short: "서늘", word: "서늘해요", desc: "다른 점이 많아요", color: "#6BA7F5", ink: "#1B64DA", mouth: "M41 125q7 6 14 0" },
    insufficient: { short: "자료 부족", word: "자료가 부족해요", desc: "원문에서 근거를 확인한 요소가 적어요", color: "#B9AEF5", ink: "#5B4BB7", mouth: "M41 126h14" },
  };
  const LEVEL_ORDER = ["hot", "warm", "cool", "insufficient"];
  const RELATION = {
    common: { label: "공통", cls: "r-common" },
    different: { label: "차이", cls: "r-different" },
    unconfirmed: { label: "확인 필요", cls: "r-unconfirmed" },
  };
  function tempOf(cmp) {
    if (!cmp || cmp.proximity.level === "insufficient") return null;
    const confirmed = cmp.rows.filter((r) => r.relation !== "unconfirmed");
    if (!confirmed.length) return null;
    const common = confirmed.filter((r) => r.relation === "common").length;
    return 32 + (common / confirmed.length) * 8;
  }
  const tempText = (t) => (t == null ? "--°" : `${t.toFixed(1)}°`);
  function levelBadge(level) {
    const L = LEVEL[level];
    return `<span class="lv lv-${level}"><i></i>${esc(L.short)}</span>`;
  }
  function thermoSvg(level, temp, size = 44) {
    const L = LEVEL[level] || LEVEL.insufficient;
    const ratio = temp == null ? 0.1 : Math.max(0, Math.min(1, (temp - 30) / 12));
    const h = Math.round(14 + ratio * 80);
    return `<svg width="${size}" height="${Math.round(size * 1.56)}" viewBox="0 0 96 150" aria-hidden="true">
      <rect x="33" y="8" width="30" height="100" rx="15" fill="#fff" stroke="#191F28" stroke-width="4"/>
      <rect x="42" y="${104 - h}" width="12" height="${h}" rx="6" fill="${L.color}"/>
      <circle cx="48" cy="118" r="24" fill="${L.color}" stroke="#191F28" stroke-width="4"/>
      <circle cx="40" cy="115" r="3.5" fill="#191F28"/><circle cx="56" cy="115" r="3.5" fill="#191F28"/>
      <path d="${L.mouth}" fill="none" stroke="#191F28" stroke-width="3.5" stroke-linecap="round"/></svg>`;
  }

  // ---------- 상태 ----------
  const state = {
    view: "search",
    mode: "text",
    idea: "",
    hits: [],
    coverage: null,
    elements: [],
    warnings: [],
    comps: new Map(), // id → {status:'loading'|'ready'|'error', data?, message?}
    points: [],
    selected: null,
    tab: "patents",
    level: "all",
    relFilter: "all",
    mapColor: "proximity",
    searchCtrl: null,
    compareCtrl: new Map(),
    agentCtrl: null,
    detailCtrl: null,
    patentCache: new Map(),
    searchError: null,
    searching: false,
  };

  // ---------- 화면 전환 ----------
  const views = { search: $("#view-search"), results: $("#view-results"), compare: $("#view-compare") };
  function go(name) {
    if (name === "results" && !state.hits.length && !state.searching && !state.searchError) return;
    if (name === "compare" && !state.selected) return;
    state.view = name;
    Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; });
    $$(".tabs-top button").forEach((b) => b.setAttribute("aria-current", b.dataset.go === name ? "page" : "false"));
    $("#backBtn").hidden = name === "search";
    window.scrollTo({ top: 0 });
    if (name === "results") requestAnimationFrame(drawMap);
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-go]");
    if (t && !t.disabled) go(t.dataset.go);
  });
  $("#backBtn").addEventListener("click", () => go(state.view === "compare" ? "results" : "search"));

  // ---------- 연결 상태 ----------
  async function loadMap() {
    const badge = $("#srcBadge");
    if (CONFIG.mock) { badge.textContent = "예시 데이터"; badge.className = "src-badge mock"; }
    try {
      const res = await api.patents();
      state.points = res.points || [];
      const kipris = (res.status && res.status.sources || []).find((s) => s.source === "kipris");
      if (!CONFIG.mock) {
        if (kipris && kipris.configured) { badge.textContent = `KIPRIS 연결됨 · 색인 ${(kipris.count || 0).toLocaleString()}건`; badge.className = "src-badge live"; }
        else { badge.textContent = "KIPRIS 키 없음"; badge.className = "src-badge off"; }
      }
      $("#mapMeta").textContent = res.builtAt ? `색인 ${fmtDate(res.builtAt)} · ${state.points.length.toLocaleString()}건` : `${state.points.length.toLocaleString()}건`;
    } catch (e) {
      badge.textContent = "서버 연결 안 됨";
      badge.className = "src-badge off";
      $("#searchError").hidden = false;
      $("#searchError").innerHTML = `<b>서버에 연결하지 못했어요</b>${esc(e.message)} <a href="?mock=1">예시 데이터로 보기</a>`;
    }
  }

  // ---------- 입력 ----------
  const modeText = {
    text: ["내 기술을 한두 문장으로 적어 주세요", EXAMPLE],
    question: ["궁금한 걸 편하게 물어보세요", "경쟁사 출신 연구원이 우리 미립구 제조공정을 개발해도 괜찮을까요?"],
    patent: ["특허번호나 회사명을 입력해 주세요", "10-2021-0000001 또는 회사명"],
  };
  const CATEGORIES = [
    ["톡신", "균주 · 정제 · 제형", "보툴리눔 톡신 균주를 배양하고 정제해 주사제로 만드는 공정"],
    ["필러", "HA · PLLA · PCL · 가교", "가교 히알루론산에 리도카인을 섞은 피부 주입용 필러"],
    ["스킨부스터", "PDRN · PN · 엑소좀", "연어 정소에서 추출한 PDRN을 정제해 피부에 주입하는 스킨부스터"],
    ["콜라겐부스터", "고분자 미세입자 · 제조공정", "PDLLA 미세입자를 다공성으로 만들어 콜라겐 생성을 유도하는 주사제"],
    ["서방형 주사제", "미립구 · 방출 제어", EXAMPLE],
    ["에너지 장비", "HIFU · RF · 레이저", "고강도 집속 초음파로 피부 진피층을 가열하는 리프팅 장비"],
  ];
  const QUICK = ["보툴리눔 톡신", "HA 필러", "콜라겐부스터", "PDRN 스킨부스터", "서방형 주사제", "HIFU·RF 장비"];
  const idea = $("#idea");
  function setMode(m) {
    state.mode = m;
    $$("#modes .chip").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.mode === m)));
    const isText = m in modeText;
    $("#mode-text").hidden = !isText;
    $("#mode-category").hidden = m !== "category";
    $("#mode-upload").hidden = m !== "upload";
    if (isText) { $("#ideaLabel").textContent = modeText[m][0]; idea.placeholder = modeText[m][1]; }
  }
  $$("#modes .chip").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  const chevron = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M8 5l5 5-5 5" fill="none" stroke="#B0B8C1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  $("#catList").innerHTML = CATEGORIES.map(([n, s], i) => `
    <button class="rowitem" type="button" data-cat="${i}">
      <div class="ri-body"><span class="ri-title">${esc(n)}</span><span class="ri-meta">${esc(s)}</span></div>
      <span class="ri-right">${chevron}</span>
    </button>`).join("");
  $("#catList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    idea.value = CATEGORIES[Number(b.dataset.cat)][2];
    setMode("text");
    updateCount();
    idea.focus();
  });
  $("#quickChips").innerHTML = QUICK.map((q, i) => `<button class="chip soft" type="button" data-q="${i}">${esc(q)}</button>`).join("");
  $("#quickChips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-q]");
    if (!b) return;
    const cat = CATEGORIES.find(([n]) => QUICK[Number(b.dataset.q)].includes(n.slice(0, 2)));
    idea.value = cat ? cat[2] : QUICK[Number(b.dataset.q)];
    setMode("text");
    updateCount();
  });
  $("#fileInput").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (/\.txt$/i.test(f.name)) {
      idea.value = (await f.text()).slice(0, CONFIG.maxIdea);
      setMode("text");
      updateCount();
      toast("파일 내용을 입력창에 넣었어요");
    } else {
      toast("PDF·PPTX·DOCX는 기술 요소 추출 API가 생기면 연결돼요");
    }
  });
  function updateCount() {
    const n = idea.value.trim().length;
    $("#ideaCount").textContent = `${n.toLocaleString()} / 4,000`;
    $("#ideaHint").textContent = n < CONFIG.minIdea ? "5자 이상 적어 주세요" : "좋아요. 찾아볼게요";
  }
  idea.addEventListener("input", updateCount);
  idea.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); $("#searchForm").requestSubmit(); }
  });
  $("#searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = idea.value.trim();
    const box = $("#searchError");
    if (text.length < CONFIG.minIdea) {
      box.hidden = false;
      box.innerHTML = "<b>조금 더 적어 주세요</b>기술을 5자 이상으로 설명해야 비교할 수 있어요.";
      idea.focus();
      return;
    }
    box.hidden = true;
    runSearch(text);
  });

  // ---------- 검색 ----------
  function setStatus(html) { $("#statusLine").innerHTML = html; }
  async function runSearch(text) {
    if (state.searchCtrl) state.searchCtrl.abort();
    state.compareCtrl.forEach((c) => c.abort());
    state.compareCtrl.clear();
    if (state.agentCtrl) state.agentCtrl.abort();
    const ctrl = new AbortController();
    state.searchCtrl = ctrl;
    Object.assign(state, { idea: text, hits: [], coverage: null, elements: [], warnings: [], comps: new Map(), selected: null, level: "all", tab: "patents", searchError: null, searching: true });
    $("#ideaEcho").textContent = text;
    $("#agentText").hidden = true;
    $("#agentText").textContent = "";
    $("#agentStatus").textContent = "";
    $("#navResults").disabled = false;
    $("#navCompare").disabled = true;
    setTab("patents");
    renderResults();
    renderHero();
    go("results");
    setStatus('<span class="spinner"></span>기술을 요소로 나누고 KIPRIS에서 찾고 있어요');
    try {
      const res = await api.search(text, ctrl.signal);
      if (ctrl.signal.aborted) return;
      state.hits = res.hits || [];
      state.coverage = res.coverage || null;
      state.elements = res.elements || [];
      state.warnings = res.warnings || [];
      mergePoints(res.addedPoints || []);
      state.searching = false;
      setStatus(state.hits.length ? `특허 ${state.hits.length}건을 찾았어요` : "");
      renderCoverage();
      renderResults();
      drawMap();
      const top = state.hits.slice(0, CONFIG.autoCompare);
      if (!top.length) { renderHero(); return; }
      top.forEach((h) => runCompare(h.id));
      if (location.hash === "#demo-compare") openCompare(top[0].id);
      if (location.hash === "#demo-cases") { setTab("cases"); renderResults(); }
    } catch (e) {
      if (isAbort(e)) return;
      state.searching = false;
      state.searchError = e;
      setStatus("");
      renderResults();
      renderHero();
    }
  }
  function mergePoints(added) {
    if (!added.length) return;
    const byId = new Map(state.points.map((p) => [p.id, p]));
    added.forEach((p) => byId.set(p.id, p));
    state.points = [...byId.values()];
    $("#mapMeta").textContent = `${state.points.length.toLocaleString()}건`;
  }
  async function runCompare(id) {
    if (state.compareCtrl.has(id)) return;
    const ctrl = new AbortController();
    state.compareCtrl.set(id, ctrl);
    state.comps.set(id, { status: "loading" });
    renderResults();
    renderHero();
    try {
      const data = await api.compare(state.idea, id, ctrl.signal);
      state.comps.set(id, { status: "ready", data });
    } catch (e) {
      if (isAbort(e)) return;
      state.comps.set(id, { status: "error", message: e.message });
    } finally {
      state.compareCtrl.delete(id);
    }
    renderResults();
    renderHero();
    drawMap();
    if (state.view === "compare" && state.selected === id) renderCompare();
  }

  // ---------- 검색 요약 ----------
  function renderCoverage() {
    const card = $("#coverageCard");
    const cov = state.coverage;
    const hasAny = state.elements.length || (cov && cov.queries && cov.queries.length) || state.warnings.length;
    card.hidden = !hasAny;
    if (!hasAny) return;
    $("#elementChips").innerHTML = state.elements.map((x) => `<span class="chip soft" style="cursor:default">${esc(x)}</span>`).join("") || '<span class="caption">기술 요소를 나누지 못했어요</span>';
    $("#queryChips").innerHTML = cov && cov.queries ? cov.queries.map((q) => `<span class="chip soft" style="cursor:default">${esc(q)}</span>`).join("") : "";
    $("#coverageText").textContent = cov ? `후보 ${cov.candidates.toLocaleString()}건 중 상위 ${state.hits.length}건을 보여줘요. 이번 검색으로 상세를 새로 받은 특허는 ${cov.detailed}건이에요.` : "";
    const warn = $("#warnBox");
    warn.hidden = !state.warnings.length;
    warn.innerHTML = state.warnings.length ? `<b>확인해 주세요</b>${state.warnings.map(esc).join("<br>")}` : "";
  }

  // ---------- 결과 목록 ----------
  function levelOf(id) {
    const c = state.comps.get(id);
    if (!c) return "none";
    if (c.status === "ready") return c.data.proximity.level;
    return c.status; // loading | error
  }
  function setTab(tab) {
    state.tab = tab;
    $$("#resultTabs button").forEach((x) => x.setAttribute("aria-selected", String(x.dataset.tab === tab)));
  }
  $("#resultTabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    setTab(b.dataset.tab);
    renderResults();
  });
  $("#levelFilters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-level]");
    if (!b) return;
    state.level = b.dataset.level;
    renderResults();
  });
  function renderResults() {
    const list = $("#resultList");
    const filters = $("#levelFilters");
    const matched = currentCases();
    $("#patentCount").textContent = state.hits.length;
    $("#caseCount").textContent = matched.length;

    if (state.searching) {
      filters.innerHTML = "";
      $("#tabHint").textContent = "";
      list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
      return;
    }
    if (state.searchError) {
      filters.innerHTML = "";
      $("#tabHint").textContent = "";
      const e = state.searchError;
      const setup = e.status === 503;
      list.innerHTML = `<div class="alert" role="alert"><b>${setup ? "서버 설정이 필요해요" : "찾지 못했어요"}</b>${esc(e.message)}</div>
        <div class="mt-s" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small ghost" type="button" id="retryBtn">다시 시도</button>${CONFIG.mock ? "" : '<a class="btn small ghost" href="?mock=1#demo" style="text-decoration:none">예시 데이터로 보기</a>'}</div>`;
      $("#retryBtn").addEventListener("click", () => runSearch(state.idea));
      return;
    }

    if (state.tab === "cases") {
      filters.innerHTML = "";
      $("#tabHint").textContent = "내 기술 설명, 찾은 특허, 기술 요소에 같은 키워드가 있는 분쟁이에요. 어떤 기술 차이가 결론을 갈랐는지 보여드려요.";
      list.innerHTML = matched.length
        ? matched.map(({ c, hitKws }) => caseHTML(c, hitKws, false)).join("")
        : '<p class="empty">같은 키워드로 묶인 분쟁 사례가 아직 없어요.<br>사례 데이터가 늘면 여기에 보여드려요.</p>';
      return;
    }

    // 특허 탭
    const counts = { all: state.hits.length, hot: 0, warm: 0, cool: 0, insufficient: 0, none: 0 };
    state.hits.forEach((h) => {
      const lv = levelOf(h.id);
      if (lv in counts) counts[lv] += 1; else counts.none += 1;
    });
    const fdefs = [["all", "전체"], ["hot", "뜨거움"], ["warm", "따뜻"], ["cool", "서늘"], ["insufficient", "자료 부족"], ["none", "비교 전"]];
    filters.innerHTML = fdefs.filter(([k]) => k === "all" || counts[k] > 0)
      .map(([k, label]) => `<button class="chip" type="button" data-level="${k}" aria-pressed="${state.level === k}">${label} ${counts[k]}</button>`).join("");
    $("#tabHint").textContent = "뜨거움·따뜻은 부딪힐 수 있는 특허, 서늘은 확장에 참고할 특허로 보면 돼요. 상위 3건은 자동으로 비교해요.";
    const shown = state.hits.filter((h) => {
      if (state.level === "all") return true;
      const lv = levelOf(h.id);
      if (state.level === "none") return !(lv in LEVEL);
      return lv === state.level;
    });
    if (!state.hits.length) {
      const cov = state.coverage;
      list.innerHTML = `<p class="empty">${cov && cov.candidates ? `후보 ${cov.candidates}건을 찾았지만 기준을 넘는 특허가 없어요.<br>기술을 조금 더 구체적으로 적어 보세요.` : "찾은 특허가 없어요.<br>다른 표현으로 다시 적어 보세요."}</p>`;
      return;
    }
    list.innerHTML = shown.map(hitHTML).join("") || '<p class="empty">이 조건에 맞는 특허가 없어요</p>';
  }
  function hitHTML(h) {
    const d = DECISION[h.decision] || DECISION.UNKNOWN;
    const c = state.comps.get(h.id);
    let side;
    if (!c) side = `<button class="btn small ghost" type="button" data-compare="${esc(h.id)}">근접도 보기</button>`;
    else if (c.status === "loading") side = '<span class="lv lv-loading"><span class="spinner" style="width:12px;height:12px;flex-basis:12px"></span>비교 중</span>';
    else if (c.status === "error") side = `<button class="lv lv-error" type="button" data-compare-retry="${esc(h.id)}" title="${esc(c.message)}">다시 비교</button>`;
    else side = `<span class="lv-wrap">${levelBadge(c.data.proximity.level)}<span class="score"><b>${tempText(tempOf(c.data))}</b></span></span>`;
    const summary = c && c.status === "ready" && c.data.summary ? c.data.summary : h.abstract;
    return `<div class="hit">
      <button class="hit-main" type="button" data-open="${esc(h.id)}">
        <span class="tagline" style="margin:0"><span class="tag ${d.cls}">${d.label}</span><span class="caption">${esc(h.applicant || "출원인 정보 없음")} · 출원번호 ${esc(appNo(h.id))}${h.filed ? " · " + fmtDate(h.filed) : ""}</span></span>
        <span class="ri-title">${esc(h.title)}</span>
        <span class="ri-meta" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(summary)}</span>
      </button>
      <div class="hit-side">${side}<span class="score">검색 점수 <b>${Number(h.score).toFixed(2)}</b></span></div>
    </div>`;
  }
  $("#resultList").addEventListener("click", (e) => {
    const open = e.target.closest("[data-open]");
    if (open) { openCompare(open.dataset.open); return; }
    const cmp = e.target.closest("[data-compare]");
    if (cmp) { runCompare(cmp.dataset.compare); return; }
    const retry = e.target.closest("[data-compare-retry]");
    if (retry) { state.comps.delete(retry.dataset.compareRetry); runCompare(retry.dataset.compareRetry); }
  });

  // ---------- 근접도 온도 (상단) ----------
  function setThermo(level, temp) {
    const L = LEVEL[level] || LEVEL.insufficient;
    const ratio = temp == null ? 0 : Math.max(0, Math.min(1, (temp - 30) / 12));
    const h = Math.round(14 + ratio * 80);
    const fill = $("#thermoFill");
    fill.setAttribute("height", h);
    fill.setAttribute("y", 104 - h);
    const color = level ? L.color : "#D1D6DB";
    fill.setAttribute("fill", color);
    $("#thermoBulb").setAttribute("fill", color);
    $("#thermoMouth").setAttribute("d", level ? L.mouth : "M41 126h14");
  }
  function renderHero() {
    const comps = [...state.comps.entries()];
    const ready = comps.filter(([, c]) => c.status === "ready");
    const loading = comps.some(([, c]) => c.status === "loading");
    const num = $("#tempNum");
    const word = $("#tempWord");
    const desc = $("#tempDesc");
    const body = $("#whyBody");
    if (state.searching || (!ready.length && loading)) {
      setThermo(null, null);
      num.textContent = "--°"; num.style.color = "";
      word.textContent = "비교하는 중이에요";
      desc.textContent = "상위 특허를 원문과 대조하고 있어요";
      body.innerHTML = "";
      return;
    }
    if (!ready.length) {
      setThermo(null, null);
      num.textContent = "--°"; num.style.color = "";
      const err = comps.find(([, c]) => c.status === "error");
      word.textContent = state.searchError ? "검색이 끝나지 않았어요" : err ? "비교하지 못했어요" : state.hits.length ? "아직 비교 전이에요" : "비교할 특허가 없어요";
      desc.textContent = err ? err[1].message : "특허를 고르면 근접도를 계산해요";
      body.innerHTML = "";
      return;
    }
    // 가장 가까운 특허: 온도가 가장 높은 것, 없으면 자료 부족
    let best = null;
    ready.forEach(([id, c]) => {
      const t = tempOf(c.data);
      if (!best || (t ?? -1) > (best.t ?? -1)) best = { id, c: c.data, t };
    });
    const level = best.c.proximity.level;
    const L = LEVEL[level];
    setThermo(level, best.t);
    num.textContent = tempText(best.t);
    num.style.color = L.ink;
    word.textContent = L.word;
    const hit = state.hits.find((h) => h.id === best.id);
    desc.textContent = hit ? `${hit.title}` : L.desc;
    $("#thermo").setAttribute("aria-label", `근접도 온도계, ${tempText(best.t)}, ${L.word}`);
    const tally = LEVEL_ORDER.map((k) => [k, ready.filter(([, c]) => c.data.proximity.level === k).length]).filter(([, n]) => n);
    body.innerHTML = `
      <p style="margin:0;font-size:15px;line-height:1.6">${esc(best.c.proximity.reason)}</p>
      ${best.c.proximity.commonElements.length ? `<div class="chips">${best.c.proximity.commonElements.map((x) => `<span class="tag t-orange">${esc(x)}</span>`).join("")}</div>` : ""}
      <p class="caption" style="margin:0">비교한 특허 ${ready.length}건 · ${tally.map(([k, n]) => `${LEVEL[k].short} ${n}`).join(" · ")}</p>
      <p class="caption" style="margin:0">온도는 원문 인용으로 근거를 확인한 요소 중 겹치는 비율을 32~40°로 옮긴 값이에요. 검색 점수와 다르고, 법적 위험도가 아니에요.</p>
      <button class="btn small ghost" type="button" data-open="${esc(best.id)}" style="align-self:flex-start">이 특허와 비교 보기</button>`;
  }
  $("#whyBody").addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]");
    if (b) openCompare(b.dataset.open);
  });

  // ---------- 분쟁 사례 ----------
  function caseTexts(extra = []) {
    return [state.idea, ...state.elements, ...((state.coverage && state.coverage.queries) || []), ...state.hits.map((h) => h.title), ...extra];
  }
  function currentCases() { return state.hits.length || state.idea ? api.cases(caseTexts()) : []; }
  function caseHTML(c, hitKws, open) {
    const steps = (c.steps || []).map((s, i) => `<li class="${i === c.steps.length - 1 ? "done" : ""}"><span class="n">${i + 1}</span><div><div class="s-date">${esc(s.date)}</div><div class="s-what">${esc(s.text)}</div></div></li>`).join("");
    const facts = [["결과", c.result], ["판단 이유", c.reason], ["기술적 영향", c.techImpact], ["사업 영향", c.bizImpact]]
      .filter(([, v]) => v).map(([k, v]) => `<div><h4>${k}</h4><p>${esc(v)}</p></div>`).join("");
    const ids = [...((c.ids && c.ids.patents) || []), ...((c.ids && c.ids.cases) || [])];
    const src = (c.sources || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(" · ");
    const period = c.period ? `${esc(c.period.start || "")}~${esc(c.period.end || "")}` : "";
    return `<details class="why case-item" style="margin:8px 0;background:var(--card);box-shadow:inset 0 0 0 1px var(--line)" ${open ? "open" : ""}>
      <summary style="min-height:auto;padding:14px 0;align-items:flex-start;gap:12px">
        <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
          <span class="tagline" style="margin:0">${(c.procedures || []).slice(0, 3).map((p) => `<span class="tag t-gray">${esc(p)}</span>`).join("")}<span class="tag t-blue">${esc(c.relation || "")}</span></span>
          <span class="ri-title">${esc(c.plaintiff)} vs ${esc(c.defendant)}</span>
          <span class="ri-meta">${esc(c.tech)}${period ? " · " + period : ""}</span>
          ${hitKws && hitKws.length ? `<span class="caption">겹친 키워드: ${hitKws.map(esc).join(", ")}</span>` : ""}
        </div>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" style="flex:0 0 20px;margin-top:4px"><path d="M5 8l5 5 5-5" fill="none" stroke="#8B95A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </summary>
      <div class="case-card" style="padding:4px 0 18px">
        ${steps ? `<ol class="steps" aria-label="분쟁 과정">${steps}</ol>` : ""}
        <div class="facts">${facts}</div>
        ${ids.length ? `<p class="caption" style="margin:0">식별 정보 · ${ids.map(esc).join(", ")}</p>` : ""}
        ${src ? `<p class="caption" style="margin:0">출처 · ${src}</p>` : ""}
      </div>
    </details>`;
  }

  // ---------- 비교 화면 ----------
  async function openCompare(id) {
    state.selected = id;
    state.relFilter = "all";
    $("#navCompare").disabled = false;
    go("compare");
    renderCompare();
    if (!state.comps.has(id) && state.idea) runCompare(id);
    loadPatent(id, false);
  }
  async function loadPatent(id, refresh) {
    if (state.detailCtrl) state.detailCtrl.abort();
    const ctrl = new AbortController();
    state.detailCtrl = ctrl;
    const status = $("#refreshStatus");
    if (refresh) status.innerHTML = '<span class="spinner" style="width:12px;height:12px;flex-basis:12px;vertical-align:-2px"></span> KIPRIS 조회 중이에요';
    try {
      const full = await api.patent(id, refresh, ctrl.signal);
      state.patentCache.set(id, full);
      if (refresh) { const t = new Date(); status.textContent = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")} 갱신됐어요`; }
    } catch (e) {
      if (isAbort(e)) return;
      status.textContent = refresh ? `갱신하지 못했어요: ${e.message}` : `상세를 불러오지 못했어요: ${e.message}`;
    }
    if (state.selected === id) renderCompare();
  }
  $("#refreshBtn").addEventListener("click", () => { if (state.selected) loadPatent(state.selected, true); });
  $("#relFilters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-rel]");
    if (!b) return;
    state.relFilter = b.dataset.rel;
    renderCompare();
  });
  $("#cmpRows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-compare-retry]");
    if (b) { state.comps.delete(b.dataset.compareRetry); runCompare(b.dataset.compareRetry); }
  });
  function renderCompare() {
    const id = state.selected;
    if (!id) return;
    const hit = state.hits.find((h) => h.id === id) || state.points.find((p) => p.id === id) || { id, title: "특허", decision: "UNKNOWN" };
    const full = state.patentCache.get(id);
    const title = (full && full.title) || hit.title;
    const decision = (full && full.decision) || hit.decision;
    const d = DECISION[decision] || DECISION.UNKNOWN;
    const applicants = (full && full.applicants && full.applicants.join(", ")) || hit.applicant || "";
    $("#cmpHead").innerHTML = `<div class="cmp-head">
      <span class="tagline" style="margin:0"><span class="tag ${d.cls}">${d.label}</span>${full && full.rawStatus ? `<span class="tag t-gray">원문 상태 ${esc(full.rawStatus)}</span>` : ""}</span>
      <h1>${esc(title)}</h1>
      <dl class="meta-grid">
        <dt>출원번호</dt><dd>${esc(appNo(id))}</dd>
        ${applicants ? `<dt>출원인</dt><dd>${esc(applicants)}</dd>` : ""}
        ${(full && full.filed) || hit.filed ? `<dt>출원일</dt><dd>${fmtDate((full && full.filed) || hit.filed)}</dd>` : ""}
        ${full && full.publication ? `<dt>공개번호</dt><dd>${esc(full.publication)}</dd>` : ""}
        ${(full && full.cpcLabels && full.cpcLabels.length) || hit.cpc ? `<dt>CPC</dt><dd>${esc(((full && full.cpcLabels) || [hit.cpc]).join(", "))}</dd>` : ""}
      </dl>
      <p class="caption" style="margin:0">내 기술 · ${esc(state.idea)}</p>
    </div>`;

    const c = state.comps.get(id);
    const rowsEl = $("#cmpRows");
    const filt = $("#relFilters");
    if (!state.idea) {
      $("#cmpSum").textContent = "내 기술을 먼저 입력해 주세요";
      $("#cmpReason").textContent = "";
      $("#cmpTemp").innerHTML = "";
      filt.innerHTML = "";
      rowsEl.innerHTML = "";
      $("#cmpFoot").textContent = "";
    } else if (!c || c.status === "loading") {
      $("#cmpSum").textContent = "원문과 대조하는 중이에요";
      $("#cmpReason").textContent = "청구항과 초록에서 기술 요소별 근거를 찾고 있어요";
      $("#cmpTemp").innerHTML = "";
      filt.innerHTML = "";
      rowsEl.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
      $("#cmpFoot").textContent = "";
    } else if (c.status === "error") {
      $("#cmpSum").textContent = "비교하지 못했어요";
      $("#cmpReason").textContent = "";
      $("#cmpTemp").innerHTML = "";
      filt.innerHTML = "";
      rowsEl.innerHTML = `<div class="alert" role="alert">${esc(c.message)}</div><button class="btn small ghost mt-s" type="button" data-compare-retry="${esc(id)}">다시 비교</button>`;
      $("#cmpFoot").textContent = "";
    } else {
      const cmp = c.data;
      const rows = cmp.rows || [];
      const confirmed = rows.filter((r) => r.relation !== "unconfirmed");
      const common = confirmed.filter((r) => r.relation === "common");
      const diff = confirmed.filter((r) => r.relation === "different");
      $("#cmpSum").innerHTML = confirmed.length
        ? `근거를 확인한 ${confirmed.length}개 요소 중<br><em>${common.length}개가 같고</em> ${diff.length}개가 달라요`
        : "원문에서 근거를 확인한 요소가 없어요";
      $("#cmpReason").textContent = cmp.summary || cmp.proximity.reason;
      const t = tempOf(cmp);
      const L = LEVEL[cmp.proximity.level];
      $("#cmpTemp").innerHTML = `${thermoSvg(cmp.proximity.level, t, 36)}<div><div class="n" style="color:${L.ink}">${tempText(t)}</div><div class="caption">${L.word}</div></div>`;
      const counts = { all: rows.length, common: common.length, different: diff.length, unconfirmed: rows.length - confirmed.length };
      filt.innerHTML = [["all", "전체"], ["common", "공통"], ["different", "차이"], ["unconfirmed", "확인 필요"]]
        .map(([k, label]) => `<button type="button" data-rel="${k}" aria-pressed="${state.relFilter === k}">${label} ${counts[k]}</button>`).join("");
      const shown = rows.filter((r) => state.relFilter === "all" || r.relation === state.relFilter);
      rowsEl.innerHTML = shown.map((r) => {
        const R = RELATION[r.relation] || RELATION.unconfirmed;
        return `<div class="elem">
          <div class="elem-top"><span class="elem-name">${esc(r.element)}</span><span class="rel ${R.cls}">${R.label}</span></div>
          <div class="vs">
            <div><span class="who">내 기술</span><span class="what">${r.mine == null ? '<span class="caption">설명에 없어요</span>' : esc(r.mine)}</span></div>
            <div><span class="who">특허 원문</span><span class="what">${r.theirs == null ? '<span class="caption">확인되지 않았어요</span>' : esc(r.theirs)}</span></div>
          </div>
          <p class="elem-why">${esc(r.note)}</p>
          ${r.evidence ? `<p class="quote">${esc(r.evidence)}</p>` : ""}
        </div>`;
      }).join("") || '<p class="empty">이 조건에 맞는 요소가 없어요</p>';
      $("#cmpFoot").textContent = `청구항 ${cmp.claimsTotal}개 중 ${cmp.claimsReviewed}개와 초록을 확인했어요. 원문 인용이 확인된 내용만 공통·차이로 표시하고, 균등 범위나 침해 여부는 판단하지 않아요.`;
    }

    // 청구항
    const claims = (full && full.claims && full.claims.length ? full.claims : full && full.firstClaim ? [full.firstClaim] : []);
    $("#claimsLabel").textContent = claims.length ? `청구항 ${claims.length}건 보기` : "청구항 정보가 없어요";
    $("#claimsList").innerHTML = claims.map((x) => `<li>${esc(x)}</li>`).join("");
    const srcUrl = (full && full.sourceUrl) || (c && c.status === "ready" && c.data.sourceUrl);
    $("#srcLine").innerHTML = `${srcUrl ? `<a href="${esc(srcUrl)}" target="_blank" rel="noopener">원문 보기</a>` : "원문 링크 없음"}${full && full.fetchedAt ? ` · 수집 ${fmtDate(full.fetchedAt)}` : ""}`;

    // 관련 분쟁
    const extra = [title, (full && full.abstract) || hit.abstract || ""];
    if (c && c.status === "ready") extra.push(...c.data.rows.map((r) => r.element), ...c.data.proximity.commonElements);
    const related = api.cases(caseTexts(extra), 3);
    $("#cmpCases").innerHTML = related.length
      ? related.map(({ c: kase, hitKws }, i) => caseHTML(kase, hitKws, i === 0)).join("")
      : '<div class="card"><p class="empty" style="padding:8px">이 기술 요소로 다툰 분쟁 사례가 아직 없어요</p></div>';
  }

  // 보관함, 상담용 요약
  $("#saveBtn").addEventListener("click", () => {
    try {
      const key = "telos.saved";
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      const item = { idea: state.idea, id: state.selected, at: new Date().toISOString() };
      if (!saved.some((s) => s.idea === item.idea && s.id === item.id)) saved.unshift(item);
      localStorage.setItem(key, JSON.stringify(saved.slice(0, 50)));
      toast("보관함에 저장했어요");
    } catch {
      toast("이 브라우저에서는 저장할 수 없어요");
    }
  });
  $("#summaryBtn").addEventListener("click", async () => {
    const id = state.selected;
    const hit = state.hits.find((h) => h.id === id) || {};
    const c = state.comps.get(id);
    const lines = [`[Telos 상담용 요약] ${new Date().toLocaleDateString("ko-KR")}`, `내 기술: ${state.idea}`, `비교 특허: ${hit.title || ""} (출원번호 ${appNo(id)})`];
    if (c && c.status === "ready") {
      lines.push(`근접도: ${LEVEL[c.data.proximity.level].short} ${tempText(tempOf(c.data))} · ${c.data.proximity.reason}`);
      c.data.rows.forEach((r) => lines.push(`- ${r.element} [${(RELATION[r.relation] || RELATION.unconfirmed).label}] 내 기술: ${r.mine ?? "설명 없음"} / 특허: ${r.theirs ?? "확인 안 됨"}${r.evidence ? ` / 인용: "${r.evidence}"` : ""}`));
    }
    lines.push("※ 기술 요소 비교 자료이며 법률 자문이 아닙니다.");
    try { await navigator.clipboard.writeText(lines.join("\n")); toast("요약을 복사했어요"); }
    catch { toast("복사하지 못했어요. 브라우저 권한을 확인해 주세요"); }
  });

  // ---------- AI 해설 (SSE) ----------
  $("#agentBtn").addEventListener("click", async () => {
    if (!state.idea) return;
    if (state.agentCtrl) state.agentCtrl.abort();
    const ctrl = new AbortController();
    state.agentCtrl = ctrl;
    const out = $("#agentText");
    const st = $("#agentStatus");
    const btn = $("#agentBtn");
    out.hidden = false;
    out.textContent = "";
    btn.textContent = "중지";
    btn.onclick = () => ctrl.abort();
    st.innerHTML = '<span class="spinner"></span>해설을 준비하고 있어요';
    try {
      await api.agent(state.idea, (ev) => {
        if (ev.type === "status") st.innerHTML = `<span class="spinner"></span>${esc(ev.message)}`;
        else if (ev.type === "tool") st.innerHTML = '<span class="spinner"></span>특허 원문을 확인하고 있어요';
        else if (ev.type === "text") out.textContent += ev.delta;
        else if (ev.type === "points_added") { mergePoints(ev.points || []); drawMap(); }
        else if (ev.type === "done") st.textContent = "해설을 다 받았어요";
        else if (ev.type === "error") { st.textContent = ""; out.insertAdjacentHTML("beforeend", `\n\n`); throw new ApiError(0, ev.message); }
      }, ctrl.signal);
    } catch (e) {
      st.innerHTML = isAbort(e) ? "해설을 멈췄어요" : `<span style="color:var(--red)">${esc(e.message)}</span>`;
    } finally {
      btn.textContent = "다시 받기";
      btn.onclick = null;
      state.agentCtrl = null;
    }
  });

  // ---------- 기술 지도 (canvas) ----------
  const canvas = $("#mapCanvas");
  const tip = $("#mapTip");
  let projected = [];
  const CPC_COLORS = ["#3182F6", "#FF8A3D", "#0B8A5A", "#9B5DE5", "#E42939", "#00A3BF", "#B58900", "#6B7684"];
  const cpcColor = (cpc) => {
    const key = String(cpc || "").slice(0, 4);
    let h = 0;
    for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return CPC_COLORS[h % CPC_COLORS.length];
  };
  $("#mapColor").addEventListener("click", (e) => {
    const b = e.target.closest("[data-color]");
    if (!b) return;
    state.mapColor = b.dataset.color;
    $$("#mapColor button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    drawMap();
  });
  function drawMap() {
    if (!canvas.isConnected || views.results.hidden) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 640;
    const h = Math.round(w * 420 / 640);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const pts = state.points;
    const hitIds = new Set(state.hits.map((x) => x.id));
    if (!pts.length) {
      ctx.fillStyle = "#8B95A1";
      ctx.font = "14px Pretendard, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("지도에 표시할 특허가 아직 없어요", w / 2, h / 2);
      projected = [];
      renderLegend();
      return;
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach((p) => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    const pad = 24;
    const sx = (w - pad * 2) / ((maxX - minX) || 1);
    const sy = (h - pad * 2) / ((maxY - minY) || 1);
    const s = Math.min(sx, sy);
    const ox = (w - (maxX - minX) * s) / 2;
    const oy = (h - (maxY - minY) * s) / 2;
    projected = pts.map((p) => ({ p, x: ox + (p.x - minX) * s, y: h - (oy + (p.y - minY) * s) }));
    const colorFor = (p) => {
      if (state.mapColor === "decision") return (DECISION[p.decision] || DECISION.UNKNOWN).color;
      if (state.mapColor === "cpc") return cpcColor(p.cpc);
      return "#C5CCD3";
    };
    // 바탕 점
    projected.forEach(({ p, x, y }) => {
      if (hitIds.has(p.id)) return;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = colorFor(p);
      ctx.globalAlpha = state.mapColor === "proximity" ? 1 : 0.55;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    // 찾은 특허
    projected.forEach(({ p, x, y }) => {
      if (!hitIds.has(p.id)) return;
      const lv = levelOf(p.id);
      let fill = "#FFFFFF";
      if (state.mapColor === "proximity") fill = LEVEL[lv] ? LEVEL[lv].color : "#FFFFFF";
      else fill = colorFor(p);
      ctx.beginPath();
      ctx.arc(x, y, p.id === state.selected ? 9 : 7, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#191F28";
      ctx.stroke();
    });
    renderLegend();
  }
  function renderLegend() {
    const lg = $("#mapLegend");
    if (state.mapColor === "decision") {
      lg.innerHTML = Object.values(DECISION).map((d) => `<span><i class="sw" style="background:${d.color}"></i>${d.label}</span>`).join("") + '<span><i class="sw" style="background:#fff;box-shadow:inset 0 0 0 2px #191F28"></i>테두리: 찾은 특허</span>';
    } else if (state.mapColor === "cpc") {
      const seen = new Map();
      state.points.forEach((p) => { const k = String(p.cpc || "").slice(0, 4); if (k && !seen.has(k) && seen.size < 6) seen.set(k, cpcColor(p.cpc)); });
      lg.innerHTML = [...seen.entries()].map(([k, c]) => `<span><i class="sw" style="background:${c}"></i>${esc(k)}</span>`).join("");
    } else {
      lg.innerHTML = LEVEL_ORDER.map((k) => `<span><i class="sw" style="background:${LEVEL[k].color}"></i>${LEVEL[k].short}</span>`).join("") +
        '<span><i class="sw" style="background:#fff;box-shadow:inset 0 0 0 2px #191F28"></i>비교 전</span><span><i class="sw" style="background:#C5CCD3"></i>주변 특허</span>';
    }
  }
  function nearest(ev) {
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    let best = null;
    // 손가락으로 누를 때는 잡는 범위를 넓힌다.
    const radius = window.matchMedia("(pointer: coarse)").matches ? 22 : 12;
    let bd = radius * radius;
    projected.forEach((q) => { const d = (q.x - x) ** 2 + (q.y - y) ** 2; if (d < bd) { bd = d; best = q; } });
    return best;
  }
  canvas.addEventListener("mousemove", (ev) => {
    const q = nearest(ev);
    if (!q) { tip.hidden = true; return; }
    const d = DECISION[q.p.decision] || DECISION.UNKNOWN;
    tip.hidden = false;
    tip.style.left = `${q.x}px`;
    tip.style.top = `${q.y}px`;
    tip.textContent = `${q.p.title} · ${d.label}`;
  });
  canvas.addEventListener("mouseleave", () => { tip.hidden = true; });
  canvas.addEventListener("click", (ev) => { const q = nearest(ev); if (q && state.idea) openCompare(q.p.id); });
  window.addEventListener("resize", () => { if (state.view === "results") drawMap(); });

  // ---------- 시작 ----------
  updateCount();
  loadMap().then(() => {
    if (location.hash.startsWith("#demo")) {
      idea.value = EXAMPLE;
      updateCount();
      runSearch(EXAMPLE);
    }
  });
})();
