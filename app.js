// 나두 학습 — 잠금 해제 → 홈(검색·이어서 보기·지식 수준·과목 목차) · 교재 · 용어집 · 문제(객관식) · 듣기(음성) · 대표님 전용(학습 기록).
// 내용은 data.enc.json(공유용) · data.admin.enc.json(전용)에만 암호문으로 있다. 저장 키는 모두 "ns_" 앞머리(같은 주소의 다른 앱과 섞이지 않게).
// 외부 서버로 보내는 요청은 없다(같은 주소의 파일만 받는다).
(() => {
  const NS = "ns_", APP = "나두 학습";
  const K = {key: NS + "key", theme: NS + "theme", inst: NS + "inst_dismiss", akey: NS + "admin_key", qlog: NS + "quiz_log",
             qdraft: NS + "quiz_draft", last: NS + "last", rate: NS + "aud_rate", pos: NS + "aud_pos_", upd: NS + "upd"};
  const $ = s => document.querySelector(s);
  const app = $("#app");
  let D = null, A = null, IDX = [], BIP = null, CT = "", ACT = "";
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const fetchEnc = async () => (await fetch("data.enc.json?t=" + Date.now(), {cache: "no-store"})).json();
  const fetchAdm = async () => { const r = await fetch("data.admin.enc.json?t=" + Date.now(), {cache: "no-store"}); return r.ok ? r.json() : null; };

  // ---- 화면 모드: 자동(폰 설정) → 라이트 → 다크 · 기기에 기억
  const TH = ["auto", "light", "dark"], THL = {auto: "◐ 자동", light: "☀ 라이트", dark: "☾ 다크"};
  const getTh = () => ls.get(K.theme, "auto");
  function setTh(t) {
    t === "auto" ? ls.del(K.theme) : ls.set(K.theme, t);
    t === "auto" ? document.documentElement.removeAttribute("data-theme") : document.documentElement.setAttribute("data-theme", t);
    document.querySelectorAll(".tbtn").forEach(b => { b.textContent = THL[t]; b.setAttribute("aria-label", "화면 모드: " + THL[t].slice(2)); });
    const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", dark ? "#10151d" : "#f7f9f8");
  }
  const tbtn = () => `<button class="tbtn" type="button" data-th aria-label="화면 모드">${THL[getTh()]}</button>`;
  document.addEventListener("click", e => { if (e.target.closest("#updtop")) applyUpd(); });
  document.addEventListener("click", e => { if (e.target.closest("[data-th]")) { const c = getTh(); setTh(TH[(TH.indexOf(c) + 1) % 3]); } });

  // ---- 설치 팝업: 맨 위 한쪽에 작게 · 닫으면 14일간 안 뜸 · 설치된 앱 안에서는 안 뜸
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const dismissed = () => Date.now() < +ls.get(K.inst, 0);
  function showInstall() {
    if (!BIP || standalone() || dismissed() || document.getElementById("inst")) return;
    const el = document.createElement("div"); el.id = "inst"; el.className = "instpop"; el.setAttribute("role", "dialog");
    el.innerHTML = `<span>📲 앱으로 설치할까요?</span><button type="button" class="go">설치</button><button type="button" class="no" aria-label="닫기">×</button>`;
    document.body.appendChild(el);
    el.querySelector(".go").onclick = async () => { const b = BIP; hideInstall(); if (!b) return; b.prompt(); try { await b.userChoice; } catch (e) {} BIP = null; };
    el.querySelector(".no").onclick = () => { ls.set(K.inst, Date.now() + 14 * 864e5); hideInstall(); };
  }
  const hideInstall = () => { const el = document.getElementById("inst"); if (el) el.remove(); };
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); BIP = e; if (window.__appReady) showInstall(); });
  window.addEventListener("appinstalled", () => { BIP = null; hideInstall(); });

  // ---- 암호
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const ub64 = a => btoa(String.fromCharCode(...new Uint8Array(a)));
  async function deriveRaw(pw, enc) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
    return crypto.subtle.deriveBits({name: "PBKDF2", hash: "SHA-256", salt: b64(enc.salt), iterations: enc.iter}, base, 256);
  }
  async function decrypt(raw, enc) {
    const k = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    const pt = await crypto.subtle.decrypt({name: "AES-GCM", iv: b64(enc.iv)}, k, b64(enc.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  async function boot() {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
    let enc;
    try { enc = await fetchEnc(); }
    catch (e) { app.innerHTML = '<div class="boot">자료를 불러오지 못했습니다. 연결을 확인해 주세요.</div>'; return; }
    const saved = ls.get(K.key, "");
    if (saved) {
      const [salt, k] = saved.split(".");
      if (salt === enc.salt) { try { D = await decrypt(b64(k), enc); CT = enc.ct; await loadAdmin(); return start(); } catch (e) {} }
      ls.del(K.key);  // 비밀번호가 바뀌면 저장 열쇠 무효
    }
    lock(enc);
  }
  function lock(enc) {
    app.innerHTML = `<div class="lock"><form id="lf">
      <img src="icon-192.png" alt=""><h1>${APP}</h1><p>비밀번호를 한 번 입력하면 이 기기가 기억합니다.</p>
      <input id="pw" type="password" autocomplete="current-password" placeholder="비밀번호" aria-label="비밀번호">
      <div class="err" id="er"></div><button>열기</button></form>${tbtn()}</div>`;
    $("#lf").onsubmit = async ev => {
      ev.preventDefault(); $("#er").textContent = "여는 중…";
      try {
        const raw = await deriveRaw($("#pw").value, enc);
        D = await decrypt(raw, enc); CT = enc.ct;
        ls.set(K.key, enc.salt + "." + ub64(raw)); await loadAdmin(); start();
      } catch (e) { $("#er").textContent = "비밀번호가 맞지 않습니다."; }
    };
    $("#pw").focus();
  }

  // ---- 대표님 전용 묶음(학습 기록) — 전용 비밀번호로 따로 잠겨 있다
  async function loadAdmin() {
    const saved = ls.get(K.akey, ""); if (!saved) return;
    let enc; try { enc = await fetchAdm(); } catch (e) { return; }
    if (!enc) return;
    const [salt, k] = saved.split(".");
    if (salt !== enc.salt) { ls.del(K.akey); return; }
    try { A = await decrypt(b64(k), enc); ACT = enc.ct; Object.assign(D.pages, A.pages); } catch (e) { ls.del(K.akey); A = null; }
  }
  const keyRaw = () => { const v = ls.get(K.key, ""); return v ? b64(v.split(".")[1]) : null; };   // 공유용 열쇠(음성도 이것으로 푼다)

  // ------------------------------------------------------------ 검색
  const norm = s => (s || "").toLowerCase().replace(/[·\-‐–—_/()\[\]「」"'`]/g, " ").replace(/\s+/g, " ").trim();
  const escH = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  const T = id => D.topics.find(t => t.id === id);
  const subjName = id => (D.subjects.find(s => s.id === id) || {}).name || id;
  function buildIndex() {
    IDX = [];
    for (const [pid, pg] of Object.entries(D.pages))
      for (const s of pg.secs) IDX.push({pid, sid: s.id, arc: !!pg.archive, pt: pg.title, st: s.title, raw: s.title + " " + s.text, n: norm(s.title + " " + s.text)});
    for (const t of D.topics) if (!t.has_note)
      IDX.push({pid: "", sid: "", arc: false, pt: subjName(t.subj) + " · " + t.part.replace(/^(\d)\s*/, "$1부 "), st: `${t.code} ${t.title} (예정)`, raw: t.title + " " + t.point, n: norm(t.title + " " + t.point)});
  }
  function search(q) {
    const terms = norm(q).split(" ").filter(Boolean);
    if (!terms.length) return [];
    const qn = terms.join(" ");
    const sc = e => (norm(e.st).startsWith(qn) ? 4 : 0) + (norm(e.st).includes(qn) ? 2 : 0) + (e.pid === "glossary" ? 1 : 0) + (e.arc ? -3 : 0);
    return IDX.filter(e => terms.every(t => e.n.includes(t))).sort((a, b) => sc(b) - sc(a)).slice(0, 40);
  }
  function snippet(raw, q) {
    const t = raw.replace(/\s+/g, " ");
    const ws = norm(q).split(" ").filter(Boolean);
    let i = t.toLowerCase().indexOf(ws[0]); if (i < 0) i = 0;
    const s = Math.max(0, i - 30);
    let h = escH(t.slice(s, s + 110));
    for (const w of ws) h = h.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), m => `<span class="hl">${m}</span>`);
    return (s > 0 ? "… " : "") + h + " …";
  }

  // ------------------------------------------------------------ 공통 틀
  const nav = on => {
    const items = [["home", "#/", "⌂", "홈"], ["glossary", "#/p/glossary", "가", "용어집"], ["quiz", "#/quiz", "✎", "문제"]];
    if (A) items.push(["archive", "#/archive", "▤", "기록"]);
    items.push(["settings", "#/settings", "⚙", "설정"]);
    return `<nav class="nav" aria-label="주요 메뉴" style="grid-template-columns:repeat(${items.length},1fr)">${items.map(([k, h, i, t]) => `<a href="${h}" class="${k === on ? "on" : ""}"><i>${i}</i>${t}</a>`).join("")}</nav>`;
  };
  const testBar = () => D.test ? `<div class="testbar">시험 빌드 — 시험 비밀번호로 만든 판(배포되지 않음)</div>` : "";
  const bar = (title, back) => testBar() + `<header class="top"><div class="in">${back ? `<a class="back" href="${back}" aria-label="뒤로">‹</a><div class="t">${escH(title)}</div>` : `<div class="brand">${APP}</div>`}</div></header>`;

  // ---- 확인 날짜: 폰에서 여는 날 기준으로 오래됐는지(빌드 날짜 기준이 아님)
  const DAY = 864e5;
  const ageDays = d => d ? Math.floor((Date.now() - Date.parse(d + "T00:00:00")) / DAY) : null;
  const stale = t => t && t.checked && ageDays(t.checked) > (D.stale_days || 90);

  // ------------------------------------------------------------ 지식 수준(폰 기록만) — 문항 숙달 = 최근 3회 가중(3:2:1) 정답률
  const qlog = () => { try { return JSON.parse(ls.get(K.qlog, "[]")).filter(r => r && r.v === 1); } catch (e) { return []; } };
  const saveLog = L => ls.set(K.qlog, JSON.stringify(L.slice(-3000)));
  const im = rs => { if (!rs.length) return 0; const last = rs.slice(-3).reverse(), w = [3, 2, 1].slice(0, last.length); return last.reduce((a, x, i) => a + x.s * w[i], 0) / w.reduce((a, b) => a + b, 0); };
  function mastery() {
    const by = {}; for (const r of qlog()) (by[r.q] = by[r.q] || []).push(r);
    let asked = 0, all = 0;
    const topics = D.bank.map(t => {
      const items = t.items.map(i => { const rs = (by[i.id] || []).sort((a, b) => a.t - b.t); return {i, m: im(rs), n: rs.length}; });
      const ak = items.filter(x => x.n); asked += ak.length; all += items.length;
      return {id: t.id, code: t.code, subj: t.subj, title: t.title, items, asked: ak.length, know: ak.length ? ak.reduce((a, x) => a + x.m, 0) / ak.length : null};
    });
    const kt = topics.filter(t => t.know != null);
    return {topics, know: kt.length ? kt.reduce((a, t) => a + t.know, 0) / kt.length : null, asked, all};
  }
  const pct = x => Math.round((x || 0) * 100);
  function rateCard() {
    const m = mastery();
    if (!m.all) return "";
    const rows = m.topics.map(t => `<div class="rrow"><span class="t">${escH(t.code)} ${escH(t.title)}</span><span class="v">${t.know == null ? "—" : pct(t.know) + "%"}</span><div class="track"><i style="width:${pct(t.know)}%"></i></div><span class="muted small">푼 문항 ${t.asked}/${t.items.length}</span></div>`).join("");
    return `<details class="card rate"><summary><div class="rrow top"><span class="t">지식 수준</span><span class="v big">${m.know == null ? "—" : pct(m.know) + "%"}</span><div class="track"><i style="width:${pct(m.know)}%"></i></div><span class="muted small">${m.know == null ? "문제를 풀면 여기에 나타납니다" : "푼 문항만 반영"} · 푼 문항 ${m.asked}/${m.all} · 누르면 주제별</span></div></summary>${rows}<a class="go" href="#/quiz">문제 풀기 ›</a></details>`;
  }

  // ------------------------------------------------------------ 홈
  function contCard() {
    const last = T(ls.get(K.last, "")), first = D.topics.find(t => t.has_note);
    const t = last && last.has_note ? last : first;
    if (!t) return `<div class="card cont"><div class="eyebrow">이어서 보기</div><p class="muted">아직 쓴 교재가 없습니다.</p></div>`;
    return `<a class="card cont" href="#/p/${t.id}"><div class="eyebrow">${last && last.has_note ? "이어서 보기" : "처음 시작"}</div><h2>${escH(t.code)} ${escH(t.title)}</h2>${t.summary ? `<p class="muted small">${escH(t.summary)}</p>` : ""}</a>`;
  }
  function home() {
    const subs = D.subjects.map(s => ({...s, parts: []}));
    for (const t of D.topics) {
      const s = subs.find(x => x.id === t.subj);
      let p = s.parts.find(x => x.name === t.part); if (!p) s.parts.push(p = {name: t.part, items: []}); p.items.push(t);
    }
    const partsToc = parts => parts.map((p, i) => {
      const open = p.items.some(t => t.has_note) || i === 0 ? " open" : "";
      return `<details class="part"${open}><summary>${escH(p.name.replace(/^(\d)\s*/, "$1부 "))}<span class="pc">${p.items.filter(t => t.has_note).length}/${p.items.length}</span></summary>${p.items.map(t => {
        const body = t.has_note
          ? `<a class="sum" href="#/p/${t.id}">${t.summary ? `<p>${escH(t.summary)}</p>` : ""}${t.keys.length ? `<ul>${t.keys.map(h => `<li>${escH(h)}</li>`).join("")}</ul>` : ""}<p class="more">교재 열기 ›</p></a>`
          : `<div class="sum"><p>${escH(t.point)}</p><p class="more">예정</p></div>`;
        return `<details class="topic${t.has_note ? "" : " wait"}"><summary><span class="rk rk-${t.has_note ? "on" : "off"}">${escH(t.code)}</span><span class="tt"><span class="tx">${escH(t.title)}${stale(t) ? ' <span class="b b-warn">확인 오래됨</span>' : ""}</span></span></summary>${body}</details>`;
      }).join("")}</details>`;
    }).join("");
    const subHead = s => {
      const all = s.parts.flatMap(p => p.items), done = all.filter(t => t.has_note).length;
      return `<span class="sj-n">과목</span><span class="sj-t">${escH(s.name)}</span><span class="sj-c">${done} / ${all.length}주제</span>`;
    };
    const toc = subs.length === 1
      ? `<div class="subj one" data-subj="${subs[0].id}"><div class="sj-h">${subHead(subs[0])}</div>${subs[0].desc ? `<p class="sj-d">${escH(subs[0].desc)}</p>` : ""}${partsToc(subs[0].parts)}</div>`
      : subs.map(s => `<details class="subj" data-subj="${s.id}"><summary class="sj-h">${subHead(s)}</summary>${s.desc ? `<p class="sj-d">${escH(s.desc)}</p>` : ""}${partsToc(s.parts)}</details>`).join("");
    app.innerHTML = bar() + `<div class="wrap">${updTop()}
      <div class="hello">한 주제씩,<br>아는 것을 쌓아갑니다.</div>
      <div class="search"><input id="q" type="search" placeholder="용어·주제 검색 (예: 토큰)" aria-label="검색" enterkeyhint="search"><button class="x" id="qx" aria-label="지우기" hidden>×</button></div>
      <div id="res"></div><div id="main">
      ${contCard()}
      ${rateCard()}
      <h2 class="h-sec">과목</h2>${toc}
      <div class="muted small meta-line">용어 ${D.stats.terms}개 · 교재 ${D.stats.notes}/${D.stats.topics}주제 · 문항 ${D.stats.items}개 · 정리 ${escH(D.built)}</div>
      </div></div>` + nav("home");
    const q = $("#q"), qx = $("#qx");
    const run = () => {
      const v = q.value.trim(); qx.hidden = !v; $("#main").hidden = !!v;
      try { sessionStorage.setItem(NS + "q", v); } catch (e) {}
      if (!v) { $("#res").innerHTML = ""; return; }
      const hs = search(v);
      $("#res").innerHTML = `<div class="card res">${hs.length ? hs.map(h => `<a class="hit" ${h.pid ? `href="#/p/${h.pid}/${h.sid}"` : ""}><div class="w">${h.arc ? '<span class="arc">기록 · </span>' : ""}${escH(h.pt)} › ${escH(h.st.replace(/\s*\(.*$/, ""))}</div><div class="s">${snippet(h.raw, v)}</div></a>`).join("") : `<div class="empty">찾는 내용이 없습니다.</div>`}</div>`;
    };
    q.oninput = run; qx.onclick = () => { q.value = ""; run(); q.focus(); };
    try { const s = sessionStorage.getItem(NS + "q"); if (s) { q.value = s; run(); } } catch (e) {}
  }

  // ------------------------------------------------------------ 교재·용어집·기록
  function page(pid, sid) {
    const pg = D.pages[pid];
    if (!pg || (pg.archive && !A)) { location.hash = "#/"; return; }
    const t = T(pid);
    if (t) ls.set(K.last, pid);
    const chips = pid !== "glossary" ? pg.secs.filter(s => s.level === 2).map(s => `<a href="#/p/${pid}/${s.id}">${escH(s.title.replace(/\s*\(.*$/, ""))}</a>`).join("") : "";
    let head = "";
    if (t && t.checked) {
      const age = ageDays(t.checked);
      head = stale(t)
        ? `<div class="stale"><b>확인한 지 오래됨</b> — 마지막 확인 ${escH(t.checked)}(${age}일 전). 도구 기능·이름·가격은 그사이 바뀌었을 수 있습니다.</div>`
        : `<div class="muted small checked">마지막 확인 ${escH(t.checked)}</div>`;
    }
    const au = t && D.audio && D.audio[pid];
    const audH = au ? `<div class="card aud"><div><b>🎧 듣기</b> <span class="muted small">두 진행자 대화 · 약 ${Math.round(au.dur / 60)}분 · 화면을 꺼도 이어집니다</span></div>
      <button type="button" class="big-btn" id="aplay">${AUD.tid === pid && !AUD.el.paused ? "❚❚ 일시정지" : "▶ 듣기"}</button>
      <div class="aud-r"><button type="button" class="ghost" data-sk="-10">« 10초</button><input type="range" id="aseek" min="0" max="${au.dur}" value="0" aria-label="재생 위치"><button type="button" class="ghost" data-sk="10">10초 »</button></div>
      <div class="aud-r"><span class="muted small" id="atime">0:00 / ${fmtT(au.dur)}</span><select id="arate" aria-label="속도">${[0.8, 1, 1.25, 1.5].map(r => `<option value="${r}"${(+ls.get(K.rate, "1")) === r ? " selected" : ""}>${r}배</option>`).join("")}</select></div></div>` : "";
    const hasQ = t && D.bank.some(b => b.id === pid);
    const after = (hasQ ? `<a class="big-btn link" href="#/quiz/${pid}">이 주제 문제 풀기 (객관식 ${D.bank.find(b => b.id === pid).items.length}문항)</a>` : "")
      + (A && t && D.pages["rec-" + pid] ? `<a class="recnote" href="#/p/rec-${pid}">이 주제를 공부한 과정은 <b>기록</b>에 있습니다 ›</a>` : "");
    const on = pid === "glossary" ? "glossary" : pg.archive ? "archive" : "home";
    app.innerHTML = bar(pg.title, pg.archive ? "#/archive" : "#/") + `<div class="wrap">${head}${chips ? `<div class="chips">${chips}</div>` : ""}${audH}<article class="doc">${pg.html}</article>${after}</div>` + nav(on);
    if (au) audBind(pid, pg.title, au);
    if (sid) {
      const el = document.getElementById(sid);
      if (el) { const box = el.closest("section.cs,tr") || el; box.scrollIntoView({block: "start"}); window.scrollBy(0, -64); box.classList.add("flash"); }
    } else window.scrollTo(0, 0);
  }
  function archive() {
    const recs = Object.entries(D.pages).filter(([k, v]) => v.archive).map(([k, v]) => `<a class="item" href="#/p/${k}"><span class="ic">기</span><span>${escH(v.title)}<small>조사 과정 · 질문과 의견</small></span></a>`).join("");
    app.innerHTML = bar("기록", "#/") + `<div class="wrap"><p class="muted small" style="margin:4px 2px 12px">주제를 공부한 과정입니다(대표님 전용). 복습은 홈의 교재로 하세요.</p>
      <div class="card" style="padding:0">${recs || '<div class="empty">아직 없습니다.</div>'}</div></div>` + nav("archive");
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------ 문제 풀이(객관식) — 고르면 바로 맞음/틀림 · 기록은 이 기기에만
  let QZ = null;
  const ITEMS = () => { const m = {}; for (const t of D.bank) for (const i of t.items) m[i.id] = Object.assign({}, i, {tid: t.id, ttl: t.code + " " + t.title}); return m; };
  function pickSet(sel) {   // 약한 문항 먼저(숙달 낮음·안 푼 것 가중) · 5문항
    const pool = []; for (const t of mastery().topics) if (sel === "all" || sel === t.id) pool.push(...t.items);
    const w = x => (1 - x.m) * 2 + (x.n ? 0 : 0.5) + 0.2, out = [];
    while (out.length < 5 && pool.length) {
      let r = Math.random() * pool.reduce((a, x) => a + w(x), 0), k = 0;
      for (; k < pool.length - 1; k++) { r -= w(pool[k]); if (r <= 0) break; }
      out.push(pool.splice(k, 1)[0].i.id);
    }
    return out;
  }
  const saveDraft = () => { if (QZ && QZ.qs.length) ls.set(K.qdraft, JSON.stringify(Object.assign({}, QZ, {at: Date.now()}))); else ls.del(K.qdraft); };
  function loadDraft() {
    try { const d = JSON.parse(ls.get(K.qdraft, "null")), M = ITEMS(); if (!d || Date.now() - d.at > 3 * DAY) return null; d.qs = d.qs.filter(q => M[q]); return d.qs.length ? d : null; } catch (e) { return null; }
  }
  const newSet = sel => ({sel, qs: pickSet(sel), pick: {}});
  function quiz(selArg) {
    if (!D.bank.length) { app.innerHTML = bar("문제", "#/") + `<div class="wrap"><div class="card muted">아직 문항이 없습니다.</div></div>` + nav("quiz"); return; }
    if (selArg && (!QZ || QZ.sel !== selArg)) QZ = newSet(selArg);
    if (!QZ) QZ = loadDraft() || null;
    const sel = (QZ && QZ.sel) || "all", M = ITEMS();
    const chips = [["all", "전체"], ...D.bank.map(t => [t.id, t.code + " " + t.title])].map(([k, l]) => `<button type="button" class="segb${sel === k ? " on" : ""}" data-qsel="${k}">${escH(l)}</button>`).join("");
    let body = "";
    if (QZ && QZ.qs.length) {
      body = QZ.qs.map((qid, n) => {
        const it = M[qid], c = QZ.pick[n], done = c != null;
        const opts = [...it.opts, "모름"].map((o, j) => {
          const no = j + 1, cls = done ? (no === it.ans ? " ok" : (c === no ? " bad" : "")) : "";
          return `<label class="opt${cls}"><input type="radio" name="q${n}" value="${no}"${c === no ? " checked" : ""}${done ? " disabled" : ""}><span>${j < 4 ? no + ". " : ""}${escH(o)}</span></label>`;
        }).join("");
        const res = done ? `<div class="ex"><b class="${c === it.ans ? "okt" : "badt"}">${c === it.ans ? "맞음" : c === 5 ? "모름" : "틀림"}</b> · 정답은 ${it.ans}번<div class="concept">${escH(it.ex)}</div><a class="basis" href="#/p/${it.tid}/${it.bsid}">근거: 교재 「${escH(it.basis)}」 ›</a></div>` : "";
        return `<div class="card qz" data-q="${n}"><div class="qn">${n + 1}. ${escH(it.q)} <span class="lvb">${escH(it.kind)}</span></div><div class="muted small">${escH(it.ttl)}</div>${opts}${res}</div>`;
      }).join("");
      const ans = QZ.qs.filter((_, n) => QZ.pick[n] != null).length;
      if (ans === QZ.qs.length) {
        const ok = QZ.qs.filter((q, n) => QZ.pick[n] === M[q].ans).length;
        body += `<div class="card done"><b>${QZ.qs.length}문항 중 ${ok}문항 맞음</b><div class="muted small">기록은 이 기기에만 남고 지식 수준에 반영됩니다.</div></div><button type="button" class="big-btn" id="qnew">다시 5문항</button>`;
      }
    } else body = `<button type="button" class="big-btn" id="qnew">5문항 시작</button>`;
    const m = mastery();
    app.innerHTML = bar("문제", "#/") + `<div class="wrap">
      <div class="muted small" style="margin:2px 2px 8px">지식 수준 ${m.know == null ? "—" : pct(m.know) + "%"} · 푼 문항 ${m.asked}/${m.all} · 약한 문항이 먼저 나옵니다</div>
      <div class="seg wrapseg">${chips}</div>${body}</div>` + nav("quiz");
    saveDraft();
    document.querySelectorAll("[data-qsel]").forEach(b => b.onclick = () => { QZ = newSet(b.dataset.qsel); quiz(); window.scrollTo(0, 0); });
    const nw = $("#qnew"); if (nw) nw.onclick = () => { QZ = newSet(sel); quiz(); window.scrollTo(0, 0); };
    document.querySelectorAll(".qz input[type=radio]").forEach(r => r.onchange = () => {
      const n = +r.name.slice(1), c = +r.value, it = M[QZ.qs[n]];
      if (QZ.pick[n] != null) return;
      QZ.pick[n] = c;
      const L = qlog(); L.push({v: 1, q: it.id, t: Date.now(), c, s: c === it.ans ? 1 : 0}); saveLog(L);
      const y = window.scrollY; quiz(); window.scrollTo(0, y);
    });
  }

  // ------------------------------------------------------------ 설정: 화면 보기 · 대표님 전용 열기 · 이 기기에서 잠그기
  function settings() {
    app.innerHTML = bar("설정", "#/") + `<div class="wrap">
      <div class="card set"><h2>화면 보기</h2><div class="seg">${TH.map(t => `<button type="button" class="segb${getTh() === t ? " on" : ""}" data-set-th="${t}">${THL[t]}</button>`).join("")}</div></div>
      <div class="card set"><h2>대표님 전용 (학습 기록)</h2>${A
        ? `<p class="muted small">열려 있습니다 — 아래 메뉴에 기록이 보입니다.</p><button type="button" class="ghost" id="aoff">전용 닫기</button>`
        : `<form id="af"><input id="apw" type="password" autocomplete="off" placeholder="전용 비밀번호" aria-label="전용 비밀번호"><div class="err" id="aer"></div><button>열기</button></form>`}</div>
      <div class="card set"><h2>문제 기록</h2><p class="muted small">푼 기록 ${qlog().length}건 · 이 기기에만 저장됩니다.</p><button type="button" class="ghost" id="qclr">문제 기록 지우기</button></div>
      <div class="card set"><button type="button" class="ghost" id="lo">이 기기에서 잠그기</button></div></div>` + nav("settings");
    document.querySelectorAll("[data-set-th]").forEach(b => b.onclick = () => { setTh(b.dataset.setTh); settings(); });
    const off = $("#aoff"); if (off) off.onclick = () => { ls.del(K.akey); location.reload(); };
    $("#qclr").onclick = () => { if (confirm("이 기기의 문제 기록을 지울까요? 지식 수준이 처음으로 돌아갑니다.")) { ls.del(K.qlog); ls.del(K.qdraft); QZ = null; settings(); } };
    $("#lo").onclick = () => { ls.del(K.key); ls.del(K.akey); location.hash = "#/"; location.reload(); };
    const af = $("#af");
    if (af) af.onsubmit = async ev => {
      ev.preventDefault(); $("#aer").textContent = "여는 중…";
      let enc; try { enc = await fetchAdm(); } catch (e) { enc = null; }
      if (!enc) { $("#aer").textContent = "전용 자료가 아직 준비되지 않았습니다."; return; }
      try {
        const raw = await deriveRaw($("#apw").value, enc);
        A = await decrypt(raw, enc); ACT = enc.ct; Object.assign(D.pages, A.pages);
        ls.set(K.akey, enc.salt + "." + ub64(raw)); buildIndex(); settings();
      } catch (e) { A = null; $("#aer").textContent = "전용 비밀번호가 맞지 않습니다."; }
    };
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------ 음성(공유용) — 공유용 열쇠로 암호화된 음성을 받아 이 기기 보관함에 두고, 풀어서 재생
  const AUD = {el: new Audio(), tid: "", url: ""};
  const fmtT = s => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  async function audLoad(tid, au) {
    let buf;
    try {
      const c = await caches.open("ns-audio"); let r = await c.match(au.f);
      if (!r) {
        r = await fetch(au.f, {cache: "no-store"}); if (!r.ok) throw new Error("HTTP " + r.status);
        for (const k of await c.keys()) if (new URL(k.url).pathname.includes("/aud/" + tid + "-")) await c.delete(k);  // 옛 판 정리
        await c.put(au.f, r.clone());
      }
      buf = new Uint8Array(await r.arrayBuffer());
    } catch (e) { const r = await fetch(au.f, {cache: "no-store"}); if (!r.ok) throw new Error("HTTP " + r.status); buf = new Uint8Array(await r.arrayBuffer()); }
    const k = await crypto.subtle.importKey("raw", keyRaw(), "AES-GCM", false, ["decrypt"]);
    const pt = await crypto.subtle.decrypt({name: "AES-GCM", iv: buf.slice(0, 12)}, k, buf.slice(12));
    return URL.createObjectURL(new Blob([pt], {type: "audio/mpeg"}));
  }
  function audBind(tid, title, au) {
    const el = AUD.el, pb = $("#aplay"), sk = $("#aseek"), tm = $("#atime"), rt = $("#arate"), pk = K.pos + tid;
    const sync = () => { if (AUD.tid !== tid) return; sk.value = Math.floor(el.currentTime); tm.textContent = `${fmtT(el.currentTime)} / ${fmtT(au.dur)}`; pb.textContent = el.paused ? "▶ 이어 듣기" : "❚❚ 일시정지"; };
    if (AUD.tid !== tid) { const p = +ls.get(pk, "0"); sk.value = p; tm.textContent = `${fmtT(p)} / ${fmtT(au.dur)}`; if (p > 5) pb.textContent = "▶ 이어 듣기"; } else sync();
    el.ontimeupdate = () => { sync(); if (AUD.tid && Math.floor(el.currentTime) % 5 === 0) ls.set(K.pos + AUD.tid, String(Math.floor(el.currentTime))); };
    el.onplay = el.onpause = sync;
    el.onended = () => { ls.set(K.pos + AUD.tid, "0"); sync(); };
    const go = async () => {
      if (AUD.tid !== tid) {
        pb.textContent = "받는 중…"; pb.disabled = true;
        try { if (AUD.url) URL.revokeObjectURL(AUD.url); AUD.url = await audLoad(tid, au); }
        catch (e) { pb.disabled = false; pb.textContent = "▶ 듣기"; toast("음성을 받지 못했습니다(" + e.message + ")"); return; }
        pb.disabled = false; AUD.tid = tid; el.src = AUD.url; el.currentTime = +ls.get(pk, "0");
      }
      el.playbackRate = +rt.value; await el.play().catch(() => {});
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({title, artist: APP, album: "두 진행자 대화"});
        navigator.mediaSession.setActionHandler("play", () => el.play());
        navigator.mediaSession.setActionHandler("pause", () => el.pause());
        navigator.mediaSession.setActionHandler("seekbackward", () => { el.currentTime = Math.max(0, el.currentTime - 10); });
        navigator.mediaSession.setActionHandler("seekforward", () => { el.currentTime = Math.min(el.duration || au.dur, el.currentTime + 10); });
      }
    };
    pb.onclick = () => { if (AUD.tid === tid && !el.paused) el.pause(); else go(); };
    document.querySelectorAll("[data-sk]").forEach(b => b.onclick = () => { if (AUD.tid === tid) el.currentTime = Math.max(0, Math.min(el.duration || au.dur, el.currentTime + (+b.dataset.sk))); });
    sk.oninput = () => { if (AUD.tid === tid) el.currentTime = +sk.value; else ls.set(pk, sk.value); tm.textContent = `${fmtT(+sk.value)} / ${fmtT(au.dur)}`; };
    rt.onchange = () => { ls.set(K.rate, rt.value); el.playbackRate = +rt.value; };
  }
  window.__audio = AUD;   // 점검용(재생 길이 확인)

  // ------------------------------------------------------------ 길 찾기 · 시작 · 새 정리 반영
  function route() {
    const h = location.hash.replace(/^#\/?/, "").split("/");
    if (h[0] === "p" && h[1]) page(decodeURIComponent(h[1]), h[2] && decodeURIComponent(h[2]));
    else if (h[0] === "archive") { if (A) archive(); else location.hash = "#/"; }
    else if (h[0] === "settings") settings();
    else if (h[0] === "quiz") quiz(h[1] && decodeURIComponent(h[1]));
    else { home(); window.scrollTo(0, 0); }
  }
  function start() {
    buildIndex();
    window.addEventListener("hashchange", route);
    route();
    const top = $("#top");
    window.addEventListener("scroll", () => { top.hidden = window.scrollY < 500; }, {passive: true});
    top.onclick = () => window.scrollTo({top: 0, behavior: "smooth"});
    try { if (sessionStorage.getItem(K.upd)) { sessionStorage.removeItem(K.upd); toast("새 정리가 반영됐습니다 · " + D.built); } } catch (e) {}
    window.__appReady = true;
    showInstall();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(true); });
    setInterval(() => { if (document.visibilityState === "visible") refresh(false); }, 10 * 60 * 1000);
  }
  async function refresh(resumed) {
    try {
      const enc = await fetchEnc();
      let changed = enc.ct && enc.ct !== CT;
      if (!changed && A) { try { const a = await fetchAdm(); changed = !!(a && a.ct !== ACT); } catch (e) {} }
      if (!changed) return;
      if (enc.salt !== (ls.get(K.key, "") || "").split(".")[0]) { location.reload(); return; }  // 비밀번호가 바뀜 → 잠금 화면
      const busy = /^#\/quiz/.test(location.hash) && QZ && QZ.qs.some((_, n) => QZ.pick[n] == null);
      if (resumed && !busy) { applyUpd(); return; }
      askUpd();
    } catch (e) {}
  }
  let UPD = false;
  function applyUpd() { try { sessionStorage.setItem(K.upd, "1"); } catch (e) {} saveDraft(); location.reload(); }
  function askUpd() {
    if (UPD || $("#updask")) return;
    const el = document.createElement("div"); el.id = "updask"; el.className = "updask"; el.setAttribute("role", "dialog");
    el.innerHTML = `<div class="box"><b>새 정리가 있습니다</b><p>지금 받으면 최신 내용으로 다시 열립니다. 푸는 문제는 그대로 보관됩니다.</p><div class="row"><button type="button" class="big-btn" data-u="now">지금 받기</button><button type="button" class="ghost" data-u="later">나중에</button></div></div>`;
    document.body.appendChild(el);
    el.querySelector('[data-u="now"]').onclick = applyUpd;
    el.querySelector('[data-u="later"]').onclick = () => { UPD = true; el.remove(); if (/^#\/?$/.test(location.hash) || !location.hash) home(); };
  }
  const updTop = () => UPD ? `<button type="button" class="updtop" id="updtop">⟳ 새 정리가 있습니다 · 눌러서 받기</button>` : "";
  function toast(t) {
    const el = document.createElement("div"); el.className = "toast"; el.textContent = t; document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
  setTh(getTh());
  boot();
})();
