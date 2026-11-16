// 나두 학습 — 잠금 해제 → 홈(맨 위 고정 검색창 · 과목 단추 → 부 → 주제) · 교재 · 용어집 · 문제(객관식) · 듣기(음성) · 대표님 전용(학습 기록).
// 내용은 data.enc.json(공유용) · data.admin.enc.json(전용)에만 암호문으로 있다. 저장 키는 모두 "ns_" 앞머리(같은 주소의 다른 앱과 섞이지 않게).
// 외부 서버로 보내는 요청은 없다(같은 주소의 파일만 받는다).
(() => {
  const NS = "ns_", APP = "나두 학습";
  const K = {key: NS + "key", theme: NS + "theme", inst: NS + "inst_home", akey: NS + "admin_key", qlog: NS + "quiz_log",
             qdraft: NS + "quiz_draft", last: NS + "last", rate: NS + "aud_rate", pos: NS + "aud_pos_", upd: NS + "upd"};
  const $ = s => document.querySelector(s);
  // ---- 아이콘 한 벌(2026-11-15 · 24px 틀 · 선 굵기 1.75 · 끝 둥글게 · 앱 안에 직접 넣음 — 외부 파일·글꼴 없음)
  const IC = {
    home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v10.5a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9"/>',
    book: '<path d="M5 19V5.5A2.5 2.5 0 0 1 7.5 3H19v14H7.5A2.5 2.5 0 0 0 5 19.5 1.5 1.5 0 0 0 6.5 21H19"/><path d="M9 7.5h6"/>',
    quiz: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9.5 4V3h5v1"/><path d="m9 13 2 2 4-4.5"/>',
    archive: '<rect x="3.5" y="4" width="17" height="4.5" rx="1.2"/><path d="M5.5 8.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8.5"/><path d="M10 12.5h4"/>',
    settings: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
    back: '<path d="m14.5 18-6-6 6-6"/>',
    next: '<path d="m9.5 18 6-6-6-6"/>',
    x: '<path d="M17.5 6.5l-11 11M6.5 6.5l11 11"/>',
    up: '<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>',
    play: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" fill="currentColor"/>',
    pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="3.5" height="14" rx="1" fill="currentColor"/>',
    rew: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 4v4.6h4.6"/>',
    fwd: '<path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.6"/><path d="M20 4v4.6h-4.6"/>',
    theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.6"/><path d="M20 4v4.6h-4.6"/>'
  };
  const ic = (n, z) => `<svg class="ic" viewBox="0 0 24 24" width="${z || 24}" height="${z || 24}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
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
  const TH = ["auto", "light", "dark"], THL = {auto: "자동", light: "라이트", dark: "다크"};
  const getTh = () => ls.get(K.theme, "auto");
  function setTh(t) {
    t === "auto" ? ls.del(K.theme) : ls.set(K.theme, t);
    t === "auto" ? document.documentElement.removeAttribute("data-theme") : document.documentElement.setAttribute("data-theme", t);
    document.querySelectorAll(".tbtn").forEach(b => { b.innerHTML = ic("theme", 18) + THL[t]; b.setAttribute("aria-label", "화면 모드: " + THL[t]); });
    const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", dark ? "#10151d" : "#f7f9f8");
  }
  const tbtn = () => `<button class="tbtn" type="button" data-th aria-label="화면 모드">${ic("theme", 18)}${THL[getTh()]}</button>`;
  document.addEventListener("click", e => { if (e.target.closest("#updtop")) applyUpd(); });
  document.addEventListener("click", e => { if (e.target.closest("[data-th]")) { const c = getTh(); setTh(TH[(TH.indexOf(c) + 1) % 3]); } });

  // ---- 폰에 설치하기: 홈 맨 위 카드 · 설치 전이면 처음부터 · ×로 닫거나 설치하면 이 폰에서 다시 안 뜸 · 설치된 앱 안에서는 안 뜸
  //   (2026-11-11 대표님 「처음 접속시에만 홈 화면 위에 폰에 설치하기 단추」 — 오른쪽 위 작은 팝업은 없앰)
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const instOff = () => standalone() || ls.get(K.inst, "") === "off";
  const instH = () => instOff() ? "" : `<div class="card inst" id="inst"><div class="inst-r"><button type="button" class="big-btn" id="instgo">폰에 설치하기</button><button type="button" class="ghost inst-x" id="instx" aria-label="설치 안내 닫기">${ic("x")}</button></div><div class="inst-g small" id="instg" hidden></div></div>`;
  function instGuide() {
    const ua = navigator.userAgent;
    if (/KAKAOTALK|NAVER\(|Instagram|FBAN|FBAV|Line\//i.test(ua)) return "앱 안 브라우저라 설치가 안 됩니다. 오른쪽 위 메뉴의 <b>다른 브라우저로 열기</b>(크롬·사파리) 뒤 다시 눌러 주세요.";
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "사파리 아래쪽 <b>공유 단추</b>(네모에 위쪽 화살표) → <b>홈 화면에 추가</b>";
    if (/SamsungBrowser/.test(ua)) return "아래쪽 <b>≡ 메뉴</b> → <b>현재 페이지 추가</b> → <b>홈 화면</b>";
    return "오른쪽 위 <b>⋮ 메뉴</b> → <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>";
  }
  const instClose = () => { ls.set(K.inst, "off"); const el = document.getElementById("inst"); if (el) el.remove(); };
  function instBind() {
    const go = $("#instgo"); if (!go) return;
    go.onclick = async () => {
      if (BIP) { const b = BIP; BIP = null; b.prompt(); try { const c = await b.userChoice; if (c && c.outcome === "accepted") instClose(); } catch (e) {} return; }
      const g = $("#instg"); g.innerHTML = instGuide(); g.hidden = false;
    };
    $("#instx").onclick = instClose;
  }
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); BIP = e; });
  window.addEventListener("appinstalled", () => { BIP = null; instClose(); });

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
  function search(q, pid) {   // pid 를 주면 그 교재 안에서만(대표님 지시 2026-11-13)
    const terms = norm(q).split(" ").filter(Boolean);
    if (!terms.length) return [];
    const qn = terms.join(" ");
    const sc = e => (norm(e.st).startsWith(qn) ? 4 : 0) + (norm(e.st).includes(qn) ? 2 : 0) + (e.pid === "glossary" ? 1 : 0) + (e.arc ? -3 : 0);
    return IDX.filter(e => (!pid || e.pid === pid) && terms.every(t => e.n.includes(t))).sort((a, b) => sc(b) - sc(a)).slice(0, pid ? 60 : 40);
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
    const items = [["home", "#/", "home", "홈"], ["glossary", "#/p/glossary", "book", "용어집"], ["quiz", "#/quiz", "quiz", "문제"]];
    if (A) items.push(["archive", "#/archive", "archive", "기록"]);
    items.push(["settings", "#/settings", "settings", "설정"]);
    return `<nav class="nav" aria-label="주요 메뉴" style="grid-template-columns:repeat(${items.length},1fr)">${items.map(([k, h, i, t]) => `<a href="${h}" class="${k === on ? "on" : ""}"${k === on ? ' aria-current="page"' : ""}>${ic(i)}<span>${t}</span></a>`).join("")}</nav>`;
  };
  const testBar = () => D.test ? `<div class="testbar">시험 빌드 — 시험 비밀번호로 만든 판(배포되지 않음)</div>` : "";
  const srchRow = ph => `<div class="in hs"><div class="search"><input id="q" type="search" placeholder="${ph}" aria-label="검색" enterkeyhint="search"><button type="button" class="x" id="qx" aria-label="지우기" hidden>${ic("x", 20)}</button></div></div>`;
  // 위 막대 — 홈과 교재 화면은 검색창이 늘 붙어 있음(ph = 교재 화면 검색창 안내 글)
  const bar = (title, back, ph) => testBar() + `<header class="top"><div class="in">${back ? `<a class="back" href="${back}" aria-label="뒤로">${ic("back", 26)}</a>` : ""}${title ? `<div class="t${back ? "" : " root"}">${escH(title)}</div>` : `<div class="brand">${APP}</div>`}</div>${!title ? srchRow("용어·주제 검색 (예: 토큰)") : ph ? srchRow(ph) : ""}</header>`;
  const goSec = sid => {   // 절로 이동 — 위 막대(검색창 포함) 높이만큼 내려서
    const el = sid && document.getElementById(sid); if (!el) return;
    const box = el.closest("section.cs,tr") || el, bar = ($(".top") || {}).offsetHeight || 64;
    window.scrollTo({top: Math.max(0, box.getBoundingClientRect().top + window.scrollY - bar - 8), behavior: "instant"});   // 부드러운 스크롤이 겹치면 도중에 멈춰서 바로 이동
    box.classList.add("flash");
  };

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
    const topics = D.bank.map(t => {
      const items = t.items.map(i => { const rs = (by[i.id] || []).sort((a, b) => a.t - b.t); return {i, m: im(rs), n: rs.length}; });
      return {id: t.id, code: t.code, subj: t.subj, title: t.title, items, asked: items.filter(x => x.n).length, sum: items.reduce((a, x) => a + x.m, 0)};
    });
    return {topics};
  }
  // 범위(과목·부·주제)의 지식 수준 = 그 범위 전체 문항의 숙달 평균 — 안 푼 문항은 0(대표님 결정 2026-11-16 「과목 전체 문항 기준」: 진도가 드러나게)
  const knowOf = ts => { let all = 0, sum = 0, asked = 0; for (const t of ts) { all += t.items.length; sum += t.sum; asked += t.asked; } return {know: all ? sum / all : 0, asked, all}; };
  const pct = x => Math.round((x || 0) * 100);
  const pctx = x => { const v = (x || 0) * 100; return v > 0 && v < 10 ? (Math.round(v * 10) / 10).toFixed(1) : String(Math.round(v)); };   // 지식 수준 글자 — 10% 아래는 소수 한 자리(몇 문항 맞혀도 0%로 보이지 않게)


  // ------------------------------------------------------------ 홈 — 과목 단추 → 부 → 주제(대표님 지시 2026-11-12: 첫 화면은 과목 단추만)
  const OPEN = new Set();   // 펼친 과목·부(이번 실행 동안만 기억 — 앱을 새로 열면 과목 단추만)
  let HOMEY = 0;   // 주제를 열 때의 홈 스크롤 위치 → 돌아오면 그 자리
  function home() {
    const subs = D.subjects.map(s => ({...s, parts: []}));
    for (const t of D.topics) {
      const s = subs.find(x => x.id === t.subj);
      let p = s.parts.find(x => x.name === t.part); if (!p) s.parts.push(p = {name: t.part, items: []}); p.items.push(t);
    }
    const op = k => OPEN.has(k) ? " open" : "";
    const topic = t => t.has_note
      ? `<a class="topic" href="#/p/${t.id}"><span class="rk rk-on">${escH(t.code)}</span><span class="tt"><span class="tx">${escH(t.title)}${stale(t) ? ' <span class="b b-warn">확인 오래됨</span>' : ""}</span></span></a>`
      : `<div class="topic wait"><span class="rk rk-off">${escH(t.code)}</span><span class="tt"><span class="tx">${escH(t.title)}</span><span class="wt">예정</span></span></div>`;
    const parts = s => s.parts.map(p => { const k = s.id + "|" + p.name;
      return `<details class="part" data-k="${escH(k)}"${op(k)}><summary>${escH(p.name.replace(/^(\d)\s*/, "$1부 "))}</summary>${p.items.map(topic).join("")}</details>`; }).join("");
    const toc = subs.map(s => `<details class="subj" data-subj="${s.id}" data-k="${escH(s.id)}"${op(s.id)}><summary class="sj-h"><span class="sj-t">${escH(s.name)}</span></summary><div class="sj-b">${parts(s)}</div></details>`).join("");
    app.innerHTML = bar() + `<div class="wrap">${updTop()}${instH()}<div id="res"></div><div class="home-toc">${toc}</div></div>` + nav("home");
    instBind(); homeSearch();
    app.querySelectorAll("details[data-k]").forEach(d => d.addEventListener("toggle", () => d.open ? OPEN.add(d.dataset.k) : OPEN.delete(d.dataset.k)));
    app.querySelectorAll("a.topic").forEach(a => a.addEventListener("click", () => { HOMEY = window.scrollY; }));
  }

  // ------------------------------------------------------------ 검색(홈 맨 위 고정 검색창)
  function homeSearch() {   // 홈 맨 위 고정 검색창(대표님 지시 2026-11-13) — 치면 목차 대신 결과
    const q = $("#q"), qx = $("#qx"), res = $("#res"), toc = app.querySelector(".home-toc");
    const run = () => {
      const v = q.value.trim(); qx.hidden = !v; toc.style.display = v ? "none" : "";
      try { sessionStorage.setItem(NS + "q", v); } catch (e) {}
      if (!v) { res.innerHTML = ""; return; }
      const hs = search(v);
      res.innerHTML = `<div class="card res">${hs.length ? hs.map(h => `<a class="hit" ${h.pid ? `href="#/p/${h.pid}/${h.sid}"` : ""}><div class="w">${h.arc ? '<span class="arc">기록 · </span>' : ""}${escH(h.pt)} › ${escH(h.st.replace(/\s*\(.*$/, ""))}</div><div class="s">${snippet(h.raw, v)}</div></a>`).join("") : `<div class="empty">찾는 내용이 없습니다.</div>`}</div>`;
      res.querySelectorAll("a.hit").forEach(a => a.addEventListener("click", () => { HOMEY = window.scrollY; }));
    };
    q.oninput = run; qx.onclick = () => { q.value = ""; run(); q.focus(); };
    q.addEventListener("keydown", e => { if (e.key === "Enter") q.blur(); });
    try { const v = sessionStorage.getItem(NS + "q"); if (v) { q.value = v; run(); } } catch (e) {}
  }

  function pageSearch(pid) {   // 교재 화면 검색창 — 지금 연 교재 안에서만 · 결과를 누르면 그 절로
    const q = $("#q"), qx = $("#qx"), res = $("#res"), bd = $("#pbody");
    const run = () => {
      const v = q.value.trim(); qx.hidden = !v; bd.style.display = v ? "none" : "";
      if (!v) { res.innerHTML = ""; return; }
      const hs = search(v, pid);
      res.innerHTML = `<div class="card res">${hs.length ? hs.map(h => `<a class="hit" href="#" data-sid="${h.sid}"><div class="w">${escH(h.st.replace(/\s*\(.*$/, ""))}</div><div class="s">${snippet(h.raw, v)}</div></a>`).join("") : `<div class="empty">${pid === "glossary" ? "용어집" : (D.pages[pid] || {}).archive ? "이 기록" : "이 교재"}에는 찾는 내용이 없습니다.</div>`}</div>`;
      res.querySelectorAll("a.hit").forEach(a => a.addEventListener("click", e => { e.preventDefault(); q.value = ""; run(); goSec(a.dataset.sid); }));
    };
    q.oninput = run; qx.onclick = () => { q.value = ""; run(); q.focus(); };
    q.addEventListener("keydown", e => { if (e.key === "Enter") q.blur(); });
  }

  // ------------------------------------------------------------ 교재·용어집·기록
  function page(pid, sid) {
    const pg = D.pages[pid];
    if (!pg || (pg.archive && !A)) { location.hash = "#/"; return; }
    const t = T(pid);
    if (t) ls.set(K.last, pid);
    // 학습에 쓰는 것만 남김(대표님 지시 2026-11-13): 절 바로가기 단추·「마지막 확인」 줄·듣기 머리 문구·본문 큰 제목(위 막대와 같은 말) 뺌 — 오래된 확인 경고는 남김
    const head = t && stale(t) ? `<div class="stale"><b>확인한 지 오래됨</b> — 마지막 확인 ${escH(t.checked)}(${ageDays(t.checked)}일 전). 도구 기능·이름·가격은 그사이 바뀌었을 수 있습니다.</div>` : "";
    const body = pg.html.replace(/<h1 id="([^"]+)">[\s\S]*?<\/h1>/, '<span id="$1"></span>');
    const au = t && D.audio && D.audio[pid];
    // 다 들은 뒤 = 「다시 듣기」 · 「다음」(대표님 2026-11-16) — 다음 = 같은 과목에서 다음 작성 주제, 없으면 「다시 듣기」만
    const nx = t && D.topics.slice(D.topics.indexOf(t) + 1).find(x => x.subj === t.subj && x.has_note);
    const audH = au ? `<div class="card aud">
      <button type="button" class="big-btn" id="aplay">${AUD.tid === pid && !AUD.el.paused ? ic("pause", 22) + "일시정지" : ic("play", 22) + "듣기"}</button>
      <div class="aend" id="aend" hidden><button type="button" class="${nx ? "ghost" : "big-btn"}" id="aagain">${ic("play", 22)}다시 듣기</button>${nx ? `<button type="button" class="big-btn" id="anext" data-nx="${nx.id}">다음${ic("next", 22)}</button>` : ""}</div>
      <div class="aud-r"><button type="button" class="ghost" data-sk="-10" aria-label="10초 뒤로">${ic("rew", 20)}10초</button><input type="range" id="aseek" min="0" max="${au.dur}" value="0" aria-label="재생 위치"><button type="button" class="ghost" data-sk="10" aria-label="10초 앞으로">10초${ic("fwd", 20)}</button></div>
      <div class="aud-r"><span class="muted small" id="atime">0:00 / ${fmtT(au.dur)}</span><select id="arate" aria-label="속도">${[0.8, 1, 1.25, 1.5].map(r => `<option value="${r}"${(+ls.get(K.rate, "1")) === r ? " selected" : ""}>${r}배</option>`).join("")}</select></div></div>` : "";
    const hasQ = t && D.bank.some(b => b.id === pid);
    const after = (hasQ ? `<a class="big-btn link" href="#/quiz/${pid}">이 주제 문제 풀기</a>` : "")
      + (A && t && D.pages["rec-" + pid] ? `<a class="recnote" href="#/p/rec-${pid}">이 주제를 공부한 과정은 <b>기록</b>에 있습니다 ›</a>` : "");
    const on = pid === "glossary" ? "glossary" : pg.archive ? "archive" : "home";
    app.innerHTML = bar(pg.title, pg.archive ? "#/archive" : BACK, pid === "glossary" ? "용어집에서 검색" : pg.archive ? "이 기록에서 검색" : "이 교재에서 검색") + `<div class="wrap"><div id="res"></div><div id="pbody">${head}${audH}<article class="doc">${body}</article>${after}</div></div>` + nav(on);
    pageSearch(pid);
    if (au) audBind(pid, pg.title, au);
    if (au && AUD.next === pid) $("#aplay").click();   // 앞 주제에서 「다음」을 눌러 온 것 → 바로 재생
    AUD.next = "";
    if (sid) goSec(sid); else window.scrollTo(0, 0);
  }
  function archive() {
    const recs = Object.entries(D.pages).filter(([k, v]) => v.archive).map(([k, v]) => `<a class="item" href="#/p/${k}"><span class="ic">기</span><span>${escH(v.title)}<small>조사 과정 · 질문과 의견</small></span></a>`).join("");
    app.innerHTML = bar("기록") + `<div class="wrap"><p class="muted small" style="margin:4px 2px 12px">주제를 공부한 과정입니다(대표님 전용). 복습은 홈의 교재로 하세요.</p>
      <div class="card" style="padding:0">${recs || '<div class="empty">아직 없습니다.</div>'}</div></div>` + nav("archive");
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------ 문제 풀이(객관식) — ① 고르기 → ② 문제만(한 화면에 한 문제) → ③ 결과(정답·풀이 함께) · 기록은 이 기기에만
  //   대표님 지시 2026-11-15: 「문제로 들어가면 우선 선택하고, 선택이 끝나면 문제들만 보여지게 해. 그래서 다 풀고 나면 결과에 대해서 정답과 풀이가 함께 보여지게」
  //   범위 = 전체 5 · 전체 20(「전체 범위에서 무작위로 해서 20문항 정도씩」) · 부 5 · 주제 5 · 기록 형식(quiz_log v:1)은 그대로(지난 기록·지식 수준 이어짐)
  let QZ = null;
  const QOPEN = new Set();   // 고르기 화면에서 펼친 부(이번 실행 동안만)
  const ITEMS = () => { const m = {}; for (const t of D.bank) for (const i of t.items) m[i.id] = Object.assign({}, i, {tid: t.id, ttl: t.code + " " + t.title}); return m; };
  //   과목별(대표님 지시 2026-11-16 「과목별로 되어 있지 않고 … 바이브코딩 중심」 → 결정 「과목 단추 먼저」): 범위 = 과목 전체(s:과목) · 부(p:과목-번호) · 주제
  const QPARTS = () => {
    const ps = [];
    for (const t of D.topics) {
      if (!D.bank.some(b => b.id === t.id)) continue;
      const k = "p:" + t.subj + "-" + t.pno; let p = ps.find(x => x.k === k);
      if (!p) ps.push(p = {k, subj: t.subj, name: t.part.replace(/^(\d)\s*/, "$1부 "), tids: []});
      p.tids.push(t.id);
    }
    return ps;
  };
  const QSUBJ = () => { const ps = QPARTS(); return D.subjects.map(s => ({k: "s:" + s.id, name: s.name, parts: ps.filter(p => p.subj === s.id), tids: D.bank.filter(b => b.subj === s.id).map(b => b.id)})).filter(s => s.tids.length); };
  const sjName = id => (D.subjects.find(s => s.id === id) || {}).name || "";
  const selTids = sel => sel === "all" ? D.bank.map(b => b.id) : sel.startsWith("s:") ? D.bank.filter(b => "s:" + b.subj === sel).map(b => b.id) : sel.startsWith("p:") ? ((QPARTS().find(p => p.k === sel) || {}).tids || []) : [sel];
  const selName = (sel, n) => {   // 범위 이름에 과목 이름(「1부」가 어느 과목인지 보이게)
    if (sel === "all") return `전체에서 ${n}문항`;   // 지난 판 임시 저장(과목을 나누기 전)
    if (sel.startsWith("s:")) return `${sjName(sel.slice(2))} 전체에서 ${n}문항`;
    if (sel.startsWith("p:")) { const p = QPARTS().find(p => p.k === sel); return p ? sjName(p.subj) + " " + p.name : "부"; }
    const t = T(sel); return t ? sjName(t.subj) + " " + t.code + " " + t.title : sel;
  };
  const shuf = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // 매번 다르게(2026-11-15 대표님 「5개 문항씩 나오더라도 매번 같은 문제가 나오지 않도록」) — 고르는 차례:
  //   ① 24시간 안에 안 푼 문항 → ② 24시간 안에 푼 문항 → ③ 바로 앞 세트의 문항(모자랄 때만) · 같은 차례 안에서는 약한 문항·안 푼 문항 가중
  //   전체·부 = 한 세트 안에서 주제가 겹치지 않게 · 주제 하나 = 개념 2 · 가르기 2 · 상황 1
  const QMIX = ["개념", "개념", "가르기", "가르기", "상황"];
  function pickSet(sel, n, prev) {
    const tids = new Set(selTids(sel)), now = Date.now(), last = {}, pv = new Set(prev || []);
    for (const r of qlog()) last[r.q] = Math.max(last[r.q] || 0, r.t);
    const pool = []; for (const t of mastery().topics) if (tids.has(t.id)) for (const x of t.items) pool.push(Object.assign({tid: t.id}, x));
    const tier = x => pv.has(x.i.id) ? 2 : (!last[x.i.id] || now - last[x.i.id] > DAY) ? 0 : 1;
    const w = x => (1 - x.m) * 2 + (x.n ? 0 : 0.5) + 0.2;
    const draw = cand => {
      const t = Math.min(...cand.map(tier)), c = cand.filter(x => tier(x) === t);
      let r = Math.random() * c.reduce((a, x) => a + w(x), 0), k = 0;
      for (; k < c.length - 1; k++) { r -= w(c[k]); if (r <= 0) break; }
      return c[k];
    };
    const out = [], used = new Set(), one = tids.size === 1, mix = shuf(QMIX.slice());
    while (out.length < n && pool.length) {
      let cand;
      if (one) { const kd = mix[out.length]; cand = pool.filter(x => x.i.kind === kd); if (!cand.length) cand = pool; }
      else { cand = pool.filter(x => !used.has(x.tid)); if (!cand.length) { used.clear(); cand = pool; } }
      const x = draw(cand); pool.splice(pool.indexOf(x), 1); used.add(x.tid); out.push(x.i.id);
    }
    return shuf(out);
  }
  function newSet(sel, n, prev) {   // 보기 순서도 매번 섞음(「모름」은 늘 맨 아래)
    const M = ITEMS(), qs = pickSet(sel, n, prev);
    return {v: 2, sel, n, qs, perm: qs.map(q => shuf(M[q].opts.map((_, j) => j + 1))), pick: {}, cur: 0, done: false, only: false, lg: []};
  }
  const saveDraft = () => { if (QZ && QZ.qs.length) ls.set(K.qdraft, JSON.stringify(Object.assign({}, QZ, {at: Date.now()}))); else ls.del(K.qdraft); };
  function loadDraft() {
    try {
      const d = JSON.parse(ls.get(K.qdraft, "null")), M = ITEMS();
      if (!d || Date.now() - d.at > 3 * DAY || !Array.isArray(d.qs) || !d.qs.length || d.qs.some(q => !M[q])) return null;
      if (d.v !== 2) {   // 지난 판(한 화면 5문항 · 고르는 즉시 기록)을 이어받음 — 이미 남긴 기록은 두 번 남기지 않음
        const old = d.pick || {};
        Object.assign(d, {v: 2, n: d.qs.length, perm: d.qs.map(q => M[q].opts.map((_, j) => j + 1)), cur: 0, only: false, lg: Object.keys(old).map(Number)});
        d.done = d.qs.every((_, i) => old[i] != null);
      }
      return d;
    } catch (e) { return null; }
  }
  const qAnswered = () => QZ.qs.filter((_, i) => QZ.pick[i] != null).length;
  function startQuiz(sel, n, replace) { QZ = newSet(sel, n, QZ && QZ.sel === sel ? QZ.qs : []); saveDraft(); if (replace) location.replace("#/quiz/go"); else location.hash = "#/quiz/go"; }
  const rateRow = k => `<div class="rrow"><span class="t">지식 수준</span><span class="v big">${k.asked ? pctx(k.know) + "%" : ""}</span>${k.asked
    ? `<div class="track"><i style="width:${(k.know * 100).toFixed(2)}%"></i></div><span class="muted small">푼 문항 ${k.asked} / ${k.all}</span>`
    : `<span class="muted small">아직 푼 문제가 없습니다</span>`}</div>`;
  const noBank = () => { app.innerHTML = bar("문제") + `<div class="wrap"><div class="card muted">아직 문항이 없습니다.</div></div>` + nav("quiz"); };
  function quizPick() {   // ① 고르기
    if (!D.bank.length) return noBank();
    if (!QZ) QZ = loadDraft();
    const m = mastery(), byT = {}; for (const t of m.topics) byT[t.id] = t;
    const kOf = ids => knowOf(ids.map(id => byT[id]).filter(Boolean));
    const pv = ids => { const k = kOf(ids); return k.asked ? pctx(k.know) + "%" : "—"; };
    const go = (sel, n, label, val) => `<button type="button" class="lrow" data-go="${escH(sel)}|${n}"><span class="lt">${label}</span>${val != null ? `<span class="lval">${val}</span>` : ""}${ic("next", 20)}</button>`;
    const resume = QZ && !QZ.done ? `<a class="card resume" href="#/quiz/go"><span class="lt"><b>풀던 문제 이어서</b><small>${escH(selName(QZ.sel, QZ.n))} · ${qAnswered()} / ${QZ.qs.length}</small></span>${ic("next", 20)}</a>` : "";
    const part = p => `<details class="card lcard qpart" data-k="${p.k}"${QOPEN.has(p.k) ? " open" : ""}><summary class="lrow"><span class="lt">${escH(p.name)}</span><span class="lval">${pv(p.tids)}</span></summary>${go(p.k, 5, "이 부에서 5문항")}${p.tids.map(id => {
      const t = T(id); return go(id, 5, `<span class="rk rk-on">${escH(t.code)}</span><span class="tx">${escH(t.title)}</span>`, pv([id])); }).join("")}</details>`;
    // 과목 카드(지식 수준 = 과목마다 · 문제 화면 맨 위 대표님 지시 2026-11-12) → 누르면 그 과목의 전체 5 · 20문항과 부 목록
    const subj = s => `<details class="qsubj" data-k="${s.k}"${QOPEN.has(s.k) ? " open" : ""}><summary class="card rate"><div class="qsh"><span class="sj-t">${escH(s.name)}</span></div>${rateRow(kOf(s.tids))}</summary><div class="qsb"><div class="card lcard">${go(s.k, 5, "이 과목 전체에서 5문항")}${go(s.k, 20, "이 과목 전체에서 20문항")}</div>${s.parts.map(part).join("")}</div></details>`;
    app.innerHTML = bar("문제") + `<div class="wrap">${resume}${QSUBJ().map(subj).join("")}</div>` + nav("quiz");
    app.querySelectorAll("details[data-k]").forEach(d => d.addEventListener("toggle", () => d.open ? QOPEN.add(d.dataset.k) : QOPEN.delete(d.dataset.k)));
    app.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { const [s, n] = b.dataset.go.split("|"); startQuiz(s, +n); });
    window.scrollTo(0, 0);
  }
  function quizRun() {   // ② 문제만 — 한 화면에 한 문제 · 풀이 중에는 맞음/틀림을 보이지 않음 · 아래 메뉴 숨김
    if (!D.bank.length) return noBank();
    if (!QZ) QZ = loadDraft();
    if (!QZ) { location.replace("#/quiz"); return; }
    if (QZ.done) return quizResult();
    const M = ITEMS(), i = Math.max(0, Math.min(QZ.cur || 0, QZ.qs.length - 1)), it = M[QZ.qs[i]], c = QZ.pick[i], last = i === QZ.qs.length - 1;
    const opts = [...QZ.perm[i], 5].map((no, j) => `<button type="button" class="opt${c === no ? " sel" : ""}${no === 5 ? " dk" : ""}" data-c="${no}" aria-pressed="${c === no}">${no === 5 ? "" : `<span class="no">${j + 1}</span>`}<span>${escH(no === 5 ? "모름" : it.opts[no - 1])}</span></button>`).join("");
    app.innerHTML = bar(selName(QZ.sel, QZ.n), "#/quiz") + `<div class="wrap qrun">
      <div class="qprog"><span>${i + 1} / ${QZ.qs.length}</span><div class="track"><i style="width:${(i + 1) / QZ.qs.length * 100}%"></i></div></div>
      <div class="card qcard"><div class="qmeta">${escH(it.kind)}${QZ.qs.length && QZ.sel === it.tid ? "" : " · " + escH(it.ttl)}</div><h2 class="qq">${escH(it.q)}</h2><div class="opts">${opts}</div></div>
      <div class="qnav"><button type="button" class="ghost" id="qprev"${i ? "" : " disabled"}>이전</button><button type="button" class="big-btn" id="qnext"${c != null ? "" : " disabled"}>${last ? "결과 보기" : "다음 문제"}</button></div></div>`;
    QZ.cur = i; saveDraft();
    app.querySelectorAll(".opt").forEach(b => b.onclick = () => { QZ.pick[i] = +b.dataset.c; saveDraft(); quizRun(); });
    $("#qprev").onclick = () => { QZ.cur = i - 1; quizRun(); window.scrollTo(0, 0); };
    $("#qnext").onclick = () => {
      if (QZ.pick[i] == null) return;
      if (!last) { QZ.cur = i + 1; quizRun(); window.scrollTo(0, 0); return; }
      const L = qlog(), t = Date.now();
      QZ.qs.forEach((q, k) => { if (QZ.lg.includes(k) || QZ.pick[k] == null) return; const ch = QZ.pick[k]; L.push({v: 1, q, t, c: ch, s: ch === M[q].ans ? 1 : 0}); QZ.lg.push(k); });
      saveLog(L); QZ.done = true; QZ.only = false; saveDraft(); quizResult(); window.scrollTo(0, 0);
    };
  }
  function quizResult() {   // ③ 결과 — 점수 + 문항마다 내 답·정답·풀이·근거
    const M = ITEMS(), rs = QZ.qs.map((q, k) => ({k, it: M[q], c: QZ.pick[k]})), ok = rs.filter(r => r.c === r.it.ans).length, bad = rs.length - ok;
    const card = r => {
      const st = r.c === r.it.ans ? "ok" : r.c === 5 ? "dk" : "bad";
      return `<div class="card qres ${st}"><div class="qh"><span class="qno">${r.k + 1}</span><b class="${st === "ok" ? "okt" : "badt"}">${st === "ok" ? "맞음" : st === "dk" ? "모름" : "틀림"}</b>${QZ.sel === r.it.tid ? "" : `<span class="muted small">${escH(r.it.ttl)}</span>`}</div>
        <div class="qq s">${escH(r.it.q)}</div>${st === "ok" ? "" : `<div class="ans mine"><span>내 답</span><span>${escH(r.c === 5 || r.c == null ? "모름" : r.it.opts[r.c - 1])}</span></div>`}<div class="ans right"><span>정답</span><span>${escH(r.it.opts[r.it.ans - 1])}</span></div>
        <div class="ex">${escH(r.it.ex)}</div><a class="basis" href="#/p/${r.it.tid}/${r.it.bsid}">근거: 교재 「${escH(r.it.basis)}」${ic("next", 18)}</a></div>`;
    };
    const list = rs.filter(r => !QZ.only || r.c !== r.it.ans);
    app.innerHTML = bar("결과", "#/quiz") + `<div class="wrap">
      <div class="card score"><div class="sc"><b>${ok}</b><span>/ ${rs.length}</span></div><div class="muted">${escH(selName(QZ.sel, QZ.n))}</div><div class="track"><i style="width:${ok / rs.length * 100}%"></i></div></div>
      ${bad ? `<div class="seg tabs"><button type="button" class="segb${QZ.only ? "" : " on"}" data-only="0">전체 ${rs.length}</button><button type="button" class="segb${QZ.only ? " on" : ""}" data-only="1">틀린 문제 ${bad}</button></div>` : ""}
      ${list.map(card).join("")}<button type="button" class="big-btn" id="qagain">같은 범위 다시</button><a class="ghost wide" href="#/quiz">다른 범위 고르기</a></div>` + nav("quiz");
    app.querySelectorAll("[data-only]").forEach(b => b.onclick = () => { QZ.only = b.dataset.only === "1"; saveDraft(); quizResult(); });
    $("#qagain").onclick = () => { QZ = newSet(QZ.sel, QZ.n, QZ.qs); saveDraft(); quizRun(); window.scrollTo(0, 0); };
  }

  // ------------------------------------------------------------ 설정(목록형): 화면 보기 · 대표님 전용 열기 · 문제 기록 · 이 기기에서 잠그기
  function settings() {
    const row = (l, v) => `<div class="lrow static"><span class="lt">${l}</span>${v}</div>`;
    app.innerHTML = bar("설정") + `<div class="wrap">
      <h3 class="sec">화면</h3><div class="card lcard">${row("화면 보기", `<div class="seg sm">${TH.map(t => `<button type="button" class="segb${getTh() === t ? " on" : ""}" data-set-th="${t}">${THL[t]}</button>`).join("")}</div>`)}</div>
      <h3 class="sec">대표님 전용 (학습 기록)</h3><div class="card lcard">${A
        ? row("전용", `<span class="lval">열림</span>`) + `<button type="button" class="lrow" id="aoff"><span class="lt">전용 닫기</span></button>`
        : `<form id="af" class="lpad"><input id="apw" type="password" autocomplete="off" placeholder="전용 비밀번호" aria-label="전용 비밀번호"><div class="err" id="aer"></div><button>열기</button></form>`}</div>
      <h3 class="sec">문제 기록</h3><div class="card lcard">${row("푼 기록", `<span class="lval">${qlog().length}건</span>`)}<button type="button" class="lrow warn" id="qclr"><span class="lt">문제 기록 지우기</span></button></div>
      <p class="muted small note">문제 기록은 이 기기에만 저장됩니다.</p>
      <div class="card lcard"><button type="button" class="lrow warn" id="lo"><span class="lt">이 기기에서 잠그기</span></button></div></div>` + nav("settings");
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
  const AUD = {el: new Audio(), tid: "", url: "", next: ""};
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
    const el = AUD.el, pb = $("#aplay"), sk = $("#aseek"), tm = $("#atime"), rt = $("#arate"), ae = $("#aend"), pk = K.pos + tid;
    const sync = () => { if (AUD.tid !== tid) return; sk.value = Math.floor(el.currentTime); tm.textContent = `${fmtT(el.currentTime)} / ${fmtT(au.dur)}`; pb.innerHTML = el.paused ? ic("play", 22) + "이어 듣기" : ic("pause", 22) + "일시정지";
      const end = el.ended; pb.hidden = end; ae.hidden = !end; };   // 끝까지 들었으면 「이어 듣기」 대신 「다시 듣기」 · 「다음」
    if (AUD.tid !== tid) { const p = +ls.get(pk, "0"); sk.value = p; tm.textContent = `${fmtT(p)} / ${fmtT(au.dur)}`; if (p > 5) pb.innerHTML = ic("play", 22) + "이어 듣기"; } else sync();
    el.ontimeupdate = () => { sync(); if (AUD.tid && Math.floor(el.currentTime) % 5 === 0) ls.set(K.pos + AUD.tid, String(Math.floor(el.currentTime))); };
    el.onplay = el.onpause = sync;
    el.onended = () => { ls.set(K.pos + AUD.tid, "0"); sync(); };
    const go = async () => {
      if (AUD.tid !== tid) {
        pb.textContent = "받는 중…"; pb.disabled = true;
        try { if (AUD.url) URL.revokeObjectURL(AUD.url); AUD.url = await audLoad(tid, au); }
        catch (e) { pb.disabled = false; pb.innerHTML = ic("play", 22) + "듣기"; toast("음성을 받지 못했습니다(" + e.message + ")"); return; }
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
    $("#aagain").onclick = () => { if (AUD.tid === tid) el.currentTime = 0; go(); };
    const an = $("#anext"); if (an) an.onclick = () => { const n = an.dataset.nx; AUD.next = D.audio && D.audio[n] ? n : ""; location.hash = "#/p/" + n; };
    document.querySelectorAll("[data-sk]").forEach(b => b.onclick = () => { if (AUD.tid === tid) el.currentTime = Math.max(0, Math.min(el.duration || au.dur, el.currentTime + (+b.dataset.sk))); });
    sk.oninput = () => { if (AUD.tid === tid) el.currentTime = +sk.value; else ls.set(pk, sk.value); tm.textContent = `${fmtT(+sk.value)} / ${fmtT(au.dur)}`; };
    rt.onchange = () => { ls.set(K.rate, rt.value); el.playbackRate = +rt.value; };
  }
  // 멈춤 — 주제 화면을 떠나거나 앱이 닫힐 때(2026-11-11 대표님): 들은 위치 저장 → 재생기 비움 → 폰 알림창 재생 조절 지움
  // 화면 끄기·홈으로 나가기(가려짐)는 멈추지 않는다(대표님 결정 「계속 듣기」)
  function audStop() {
    const el = AUD.el;
    if (!AUD.tid) return;
    if (!el.ended) ls.set(K.pos + AUD.tid, String(Math.floor(el.currentTime)));
    AUD.tid = ""; el.pause(); el.removeAttribute("src"); el.load();
    if (AUD.url) { URL.revokeObjectURL(AUD.url); AUD.url = ""; }
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = "none";
      for (const a of ["play", "pause", "seekbackward", "seekforward"]) try { navigator.mediaSession.setActionHandler(a, null); } catch (e) {}
    }
  }
  window.addEventListener("pagehide", audStop);
  document.addEventListener("freeze", audStop);
  window.__audio = AUD;   // 점검용(재생 길이 확인)

  // ------------------------------------------------------------ 길 찾기 · 시작 · 새 정리 반영
  let BACK = "#/";   // 교재의 뒤로 = 홈(검색 결과에서 왔으면 검색어가 남아 결과가 다시 보임)
  function route() {
    const h = location.hash.replace(/^#\/?/, "").split("/");
    if (AUD.tid && !(h[0] === "p" && h[1] && decodeURIComponent(h[1]) === AUD.tid)) audStop();   // 듣던 주제 화면이 아니면 멈춤
    if (h[0] === "p" && h[1]) page(decodeURIComponent(h[1]), h[2] && decodeURIComponent(h[2]));
    else if (h[0] === "archive") { if (A) archive(); else location.hash = "#/"; }
    else if (h[0] === "search") location.replace("#/");   // 옛 검색 화면 주소 → 홈(검색창이 홈 맨 위로 옮겨 감)
    else if (h[0] === "settings") settings();
    else if (h[0] === "quiz") {
      const a = h[1] && decodeURIComponent(h[1]);
      if (!a) quizPick(); else if (a === "go") quizRun();
      else if (D.bank.some(b => b.id === a) || a === "all" || a.startsWith("s:") || a.startsWith("p:")) startQuiz(a, +(h[2] || 5) === 20 ? 20 : 5, true);
      else location.replace("#/quiz");
    }
    else { home(); window.scrollTo(0, HOMEY); HOMEY = 0; }
    if (h[0] !== "p") BACK = "#/";
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
      const busy = /^#\/quiz\/go/.test(location.hash) && QZ && !QZ.done;
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
  const updTop = () => UPD ? `<button type="button" class="updtop" id="updtop">${ic("refresh", 18)}새 정리가 있습니다 · 눌러서 받기</button>` : "";
  function toast(t) {
    const el = document.createElement("div"); el.className = "toast"; el.textContent = t; document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
  setTh(getTh());
  boot();
})();
