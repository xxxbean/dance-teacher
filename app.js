/* ===== 中职舞蹈教资 · 学习工作台 · 交互与渲染 ===== */
(function () {
  "use strict";

  var KEY = "zw_dance_workbench_v1";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };

  /* ---------------- 状态 ---------------- */
  var S = {
    targetDate: DATA.meta.targetDate,
    targetName: DATA.meta.targetName,
    tasks: DATA.defaultTasks.map(function () { return false; }),
    units: {},           // 已掌握的知识单元
    review: [],          // 间隔复习队列
    answers: {},         // 题库作答
    wrong: {},
    active: {},          // 打卡活跃度
    focus: {},           // 每日专注分钟
    lastAct: 0,          // 最近一次操作时间戳（驱动贴纸小人状态）
    notes: "",
    self: [3, 3, 3, 3, 3, 3, 3, 3],
    scriptDraft: "",
    planDraft: ""
  };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      Object.keys(o).forEach(function (k) { if (k in S) S[k] = o[k]; });
    } catch (e) { console.warn("读取本地数据失败", e); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { console.warn("保存失败（可能是浏览器限制）", e); }
  }

  /* ---------------- 工具 ---------------- */
  function todayKey(d) {
    var t = d || new Date();
    return t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate());
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function parseDay(s) {
    var p = String(s).split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(d, n) {
    var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x;
  }
  function daysBetween(a, b) {
    var ms = parseDay(b).getTime() - parseDay(a).getTime();
    return Math.round(ms / 86400000);
  }
  function touch(points) {
    var k = todayKey();
    if (points) S.active[k] = (S.active[k] || 0) + points;
    S.lastAct = Date.now();
    if (typeof paintMascots === "function") paintMascots();
  }

  /* ---------------- 贴纸小人（随学习/未学习时间变化） ---------------- */
  var MO = {
    study: { img: "assets/study.webp", name: "学习中", line: "在呢，陪你把这页学完。", sym: "✦", sym2: "✎" },
    effort: { img: "assets/effort.webp", name: "努力中", line: "写满这一页，再休息 5 分钟。", sym: "💧", sym2: "💧" },
    sprint: { img: "assets/sprint.webp", name: "奋斗中", line: "计时器在跑，这一遍别停。", sym: "🔥", sym2: "" },
    slack: { img: "assets/slack.webp", name: "摸鱼中", line: "鱼还没摸热，回来吧。", sym: "🐟", sym2: "" },
    lazy: { img: "assets/lazy.webp", name: "偷懒中", line: "睡 5 分钟就起，别睡到明天。", sym: "💤", sym2: "💤" },
    phone: { img: "assets/phone.webp", name: "偷玩手机", line: "手机放下，先做 3 道题。", sym: "📱", sym2: "" }
  };
  function focusToday() { return Math.round(S.focus[todayKey()] || 0); }
  function focusTotal() { return Math.round(Object.keys(S.focus).reduce(function (a, k) { return a + S.focus[k]; }, 0)); }
  function mascotKey() {
    if (T.run) return "sprint";
    if (!S.lastAct) return "study";
    var idle = (Date.now() - S.lastAct) / 60000;
    if (idle < 3) return focusToday() >= 50 ? "effort" : "study";
    if (idle < 20) return "slack";
    if (idle < 240) return "lazy";
    return "phone";
  }
  function moImg(key) {
    var d = MO[key];
    return '<div class="mo-img"><span class="mo-sym sym1">' + d.sym + "</span>" +
      (d.sym2 ? '<span class="mo-sym sym2">' + d.sym2 + "</span>" : "") +
      '<img src="' + d.img + '" alt="' + d.name + '"></div>';
  }
  function slotHero(key) { return '<div class="mo mo--' + key + '">' + moImg(key) + "</div>"; }
  function slotTrial(key) {
    var d = MO[key];
    return '<div class="mo mo--' + key + '"><div class="bubble">' + d.line + "</div>" +
      moImg(key) + '<span class="mo-time">今日专注 ' + focusToday() + " 分钟</span></div>";
  }
  function slotDock(key) {
    var d = MO[key];
    return '<div class="mo mo--' + key + '"><div class="bubble">' + d.line +
      '<span class="go" id="dockGo">去学一会儿 →</span></div>' + moImg(key) +
      '<span class="mo-time">今日专注 ' + focusToday() + " 分钟</span></div>";
  }
  var lastMo = "";
  function paintMascots() {
    if (typeof T === "undefined" || !MO) return;
    var key = mascotKey();
    var html = { hero: slotHero(key), trial: slotTrial(key), dock: slotDock(key) };
    $$(".mo-slot").forEach(function (el) {
      var kind = el.dataset.mo;
      el.className = "mo-slot slot-" + kind + " mo-host";
      var sig = key + "|" + focusToday();
      if (el.dataset.sig !== sig) {
        el.innerHTML = html[kind] || html.hero;
        el.dataset.sig = sig;
      }
    });
    var st = $("#moStatus");
    if (st) st.innerHTML = "今日专注 <b>" + focusToday() + " 分钟</b> · 连续 <b>" + streak() +
      " 天</b> · 现在：<b>" + MO[key].name + "</b>";
    document.body.classList.toggle("mo-hide", current === "trial");
    var dock = $("#dock");
    if (dock && key !== lastMo) {
      dock.classList.add("show");
      clearTimeout(dock._t);
      dock._t = setTimeout(function () { dock.classList.remove("show"); }, 4200);
    }
    lastMo = key;
  }
  function masteryUnits() {
    var out = [];
    DATA.km1.modules.forEach(function (m, i) { out.push({ k: "k1-" + i, n: m.t, g: "科目一" }); });
    DATA.km2.modules.forEach(function (m, i) { out.push({ k: "k2-" + i, n: m.t, g: "科目二" }); });
    DATA.interview.structure.forEach(function (m, i) { out.push({ k: "iv-" + i, n: m.t, g: "面试结构化" }); });
    DATA.dance.sections.forEach(function (m, i) { out.push({ k: "ds-" + i, n: m.t, g: "舞蹈专业" }); });
    return out;
  }
  var UNITS = masteryUnits();
  var TOTAL_Q = DATA.quiz.length;

  function streak() {
    var n = 0, d = new Date();
    if (!S.active[todayKey(d)]) d = addDays(d, -1);
    while (S.active[todayKey(d)]) { n++; d = addDays(d, -1); }
    return n;
  }
  function overallPct() {
    var done = UNITS.filter(function (u) { return S.units[u.k]; }).length;
    return Math.round(done / UNITS.length * 100);
  }
  function quizStats() {
    var ids = Object.keys(S.answers), right = 0;
    ids.forEach(function (id) {
      var q = DATA.quiz.filter(function (x) { return x.id === id; })[0];
      if (q && S.answers[id] === q.a) right++;
    });
    return { done: ids.length, right: right, rate: ids.length ? Math.round(right / ids.length * 100) : 0 };
  }
  function reviewDue() {
    var t = todayKey();
    return S.review.filter(function (r) { return r.due <= t; });
  }
  function reviewNext() {
    var t = todayKey();
    return S.review.filter(function (r) { return r.due > t; })
      .sort(function (a, b) { return a.due < b.due ? -1 : 1; }).slice(0, 4);
  }

  /* ---------------- 路由 ---------------- */
  var ROUTES = [
    { id: "dash", no: "01", name: "总 览" },
    { id: "plan", no: "02", name: "学习计划" },
    { group: "笔试" },
    { id: "km1", no: "03", name: "科目一 · 综合素质" },
    { id: "km2", no: "04", name: "科目二 · 教育知识与能力" },
    { group: "面试" },
    { id: "interview", no: "05", name: "流程与结构化" },
    { id: "trial", no: "06", name: "试讲 · 舞蹈专业" },
    { group: "专业与演练" },
    { id: "dance", no: "07", name: "舞蹈专业库" },
    { id: "quiz", no: "08", name: "题库自测" },
    { id: "res", no: "09", name: "资料与视频" },
    { id: "note", no: "10", name: "笔记与设置" }
  ];

  var current = "dash";
  function go(id) {
    current = id;
    $$(".nav-item").forEach(function (b) { b.classList.toggle("on", b.dataset.id === id); });
    try { history.replaceState(null, "", "#" + id); } catch (e) { }
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- 通用组件 ---------------- */
  function kcard(o) {
    var open = !!S.units[o.key] || o.idx === "01";
    var body = "";
    if (o.rows) {
      body = '<div class="kv">' + o.rows.map(function (r) {
        return "<b>" + esc(r[0]) + "</b><span>" + r[1] + "</span>";
      }).join("") + "</div>";
    }
    if (o.pts) {
      body = "<ul>" + o.pts.map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ul>";
    }
    if (o.use) body += '<div class="quote"><b>答题/使用要点：</b>' + o.use + "</div>";
    return '<details class="kcard"' + (open ? " open" : "") + ' data-key="' + o.key + '">' +
      "<summary><span class=\"idx\">" + (o.idx || "") + "</span><span class=\"t\">" + o.t + "</span>" +
      (o.tag ? '<span class="badge">' + o.tag + "</span>" : "") +
      '<span class="dot">›</span></summary>' +
      '<div class="bd">' + body +
      '<div class="mt-s"><button class="btn ghost sm act-master" data-key="' + o.key + '">' +
      (S.units[o.key] ? "✓ 已掌握（点击取消）" : "标记为已掌握") + "</button></div></div></details>";
  }

  function barRow(name, val, max, label, color) {
    var w = Math.max(2, Math.min(100, val / max * 100));
    return '<div class="mrow"><span class="nm">' + name + '</span><div class="tr"><i style="width:' + w +
      "%;background:" + (color || "#c96b78") + '"></i></div><span class="vl">' + label + "</span></div>";
  }

  function sectionTitle(t, s) {
    return '<div class="topbar"><div><div class="crumb">' + s + '</div></div></div>';
  }

  /* ---------------- 视图：总览 ---------------- */
  function viewDash() {
    var left = daysBetween(todayKey(), S.targetDate);
    var pct = overallPct();
    var qs = quizStats();
    var st = streak();
    var taskDone = S.tasks.filter(Boolean).length;
    var due = reviewDue();

    var kpis = [
      ["知识单元掌握度", pct, "%", "已掌握 " + UNITS.filter(function (u) { return S.units[u.k]; }).length + " / " + UNITS.length + " 个"],
      ["题库完成", qs.done, "/" + TOTAL_Q, "正确率 " + qs.rate + "%"],
      ["今日任务", taskDone, "/" + S.tasks.length, taskDone === S.tasks.length ? "今日已清空 🎉" : "还差 " + (S.tasks.length - taskDone) + " 项"],
      ["连续打卡", st, "天", "累计活跃 " + Object.keys(S.active).length + " 天"],
      ["今日专注", focusToday(), "分钟", "累计 " + focusTotal() + " 分钟 · 目标 60′"]
    ];

    var kpiHtml = kpis.map(function (k, i) {
      var p = 0;
      if (i === 0) p = pct;
      if (i === 1) p = Math.round(qs.done / TOTAL_Q * 100);
      if (i === 2) p = Math.round(taskDone / S.tasks.length * 100);
      if (i === 3) p = Math.min(100, st * 10);
      if (i === 4) p = Math.min(100, focusToday() / 60 * 100);
      return '<div class="kpi"><div class="lbl">' + k[0] + '</div><div class="val">' + k[1] +
        '<small>' + k[2] + '</small></div><div class="bar"><i style="width:' + p + '%"></i></div>' +
        '<div class="note" style="margin-top:7px">' + k[3] + "</div></div>";
    }).join("");

    var taskHtml = DATA.defaultTasks.map(function (t, i) {
      return '<div class="task' + (S.tasks[i] ? " done" : "") + '"><input type="checkbox" data-task="' + i + '"' +
        (S.tasks[i] ? " checked" : "") + '><div class="tx">' + t[0] + "<small>" + t[1] + "</small></div></div>";
    }).join("");

    return '<div class="hero"><div class="row"><div class="hero-text">' +
      '<div class="kicker">贵州 · 中职专业课 · 舞蹈表演 D750202</div>' +
      "<h3>把「考证」拆成每天能做完的事</h3>" +
      "<p>两科笔试 + 一场 20 分钟面试。这里把考情、知识卡、题库、试讲计时器放在同一个工作台里，你只需要每天打开、按顺序做。</p>" +
      '<div class="pills"><span class="pill solid">笔试：综合素质 + 教育知识与能力</span>' +
      '<span class="pill">面试：结构化 5′ + 试讲 10′ + 答辩 5′</span>' +
      '<span class="pill">中职专业课不考科目三</span></div>' +
      '<div class="mo-status" id="moStatus"></div></div>' +
      '<div class="hero-side"><div class="count"><div class="n">' + (left >= 0 ? left : "—") + "<small>天</small></div>" +
      '<div class="lbl">距 ' + S.targetName + '</div><div class="date">' + S.targetDate +
      '</div></div><div class="mo-slot slot-hero" data-mo="hero"></div></div></div></div>' +

      '<div class="grid g5 mt">' + kpiHtml + "</div>" +

      '<div class="grid g23 mt">' +
      // 今日任务
      '<div class="card"><div class="card-h"><h3>今日清单</h3><span class="tag">勾选即保存 · 自动计入打卡</span></div>' +
      taskHtml +
      '<div class="mt-s note">勾满 3 项才算「今天没白过」。剩下的时间宁可去练一个动作，不要再刷一页资料。</div></div>' +

      // 复习队列
      '<div class="card"><div class="card-h"><h3>今日复习队列</h3><span class="tag">间隔重复</span></div>' +
      (due.length
        ? due.map(function (r, i) {
          return '<div class="task"><div class="tx">' + esc(r.n) + "<small>到期 " + r.due + " · 第 " + (r.step + 1) + " 次复习</small></div>" +
            '<button class="btn ghost sm act-review" data-i="' + S.review.indexOf(r) + '">完成</button></div>';
        }).join("")
        : '<div class="note" style="padding:6px 0">今天没有到期项。把新的知识卡「标记为已掌握」后，它会自动在 1、3、7、15、30 天后回来找你。</div>' +
          (reviewNext().length ? '<div class="mt-s">' + reviewNext().map(function (r) {
            return '<div class="task"><div class="tx" style="color:#7d7568">' + esc(r.n) + "<small>下次 " + r.due + "</small></div></div>";
          }).join("") + "</div>" : "")) +
      '<div class="okbox mt">复习一次的正确做法：先合上屏幕，把要点讲出来（讲给空气也行），再看卡片对答案。</div></div>' +
      "</div>" +

      '<div class="grid g23 mt">' +
      // 雷达
      '<div class="card"><div class="card-h"><h3>面试能力自评</h3><span class="tag">每次模拟后重打一次分</span></div>' +
      '<div class="radar-wrap"><div id="radarBox">' + radarSvg() + "</div>" +
      '<div class="sliders">' + DATA.trial.rubric.map(function (r, i) {
        return '<div class="slider"><span class="nm">' + r[0] + '</span><input type="range" min="1" max="5" step="1" data-self="' + i +
          '" value="' + S.self[i] + '"><span class="v">' + S.self[i] + "</span></div>";
      }).join("") + "</div></div>" +
      '<div class="note mt-s">1 分＝完全没底，5 分＝能稳定做到。低于 3 分的项，就是你下一次模拟要重点录下来看的地方。</div></div>' +

      // 热力图
      '<div class="card"><div class="card-h"><h3>打卡热力</h3><span class="tag">最近 8 周</span></div>' +
      heatmap() +
      '<div class="heat-legend">少 <span class="cell" style="width:12px;height:12px;background:#f4e5d5"></span>' +
      '<span class="cell" style="width:12px;height:12px;background:#fadbd8"></span>' +
      '<span class="cell" style="width:12px;height:12px;background:#f0b7b9"></span>' +
      '<span class="cell" style="width:12px;height:12px;background:#dd8e95"></span>' +
      '<span class="cell" style="width:12px;height:12px;background:#c96b78"></span> 多</div>' +
      '<div class="quote mt">不要追求「每天 4 小时」，追求「每天不断」。断一天，第二天要花两天补回来。</div></div>' +
      "</div>" +

      '<div class="grid g3 mt">' +
      '<div class="card flat"><div class="card-h"><h3>本周主攻</h3></div><div class="note">' +
      "第 1—4 周：两科通框架，不背细节。<br>第 5—8 周：真题＋试讲篇目。<br>第 9—10 周：全真模拟、定型。</div>" +
      '<div class="mt-s"><button class="btn ghost sm go-plan">打开学习计划</button></div></div>' +
      '<div class="card flat"><div class="card-h"><h3>最容易丢分的三件事</h3></div>' +
      '<div class="note">① 试讲把「讲课」说成「说课」；<br>② 10 分钟里没有一次完整示范；<br>③ 面试超时，没时间收尾。</div></div>' +
      '<div class="card flat"><div class="card-h"><h3>本地提醒</h3></div>' +
      '<div class="note">贵州中职类别只在「花溪大学城二考区」开考；贵阳二考区与贵定考区不设中职。报名时先看考区，再看考点。</div></div>' +
      "</div>" +

      '<div class="foot"><span>数据保存在本机浏览器（localStorage），换电脑请用「笔记与设置」导出 JSON。</span>' +
      '<span>内容依据官方公告与教学标准整理，考试时间以准考证为准。</span></div>';
  }

  /* ---------------- 雷达图 ---------------- */
  function radarSvg() {
    var labels = DATA.trial.rubric.map(function (r) { return r[0]; });
    var short = { "职业认知": "认知", "心理素质": "心理", "仪表仪态": "仪态", "言语表达": "言语", "思维品质": "思维", "教学设计": "设计", "教学实施": "实施", "教学评价": "评价" };
    var cx = 130, cy = 126, R = 84, n = labels.length;
    function pt(i, r) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }
    var rings = "";
    [0.25, 0.5, 0.75, 1].forEach(function (k) {
      var pts = [];
      for (var i = 0; i < n; i++) { var p = pt(i, R * k); pts.push(p[0].toFixed(1) + "," + p[1].toFixed(1)); }
      rings += '<polygon points="' + pts.join(" ") + '" fill="none" stroke="#eddcc9" stroke-width="1"/>';
    });
    var axes = "", labs = "";
    for (var i = 0; i < n; i++) {
      var e = pt(i, R), l = pt(i, R + 17);
      axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) + '" stroke="#eddcc9"/>';
      var anchor = Math.abs(l[0] - cx) < 6 ? "middle" : (l[0] > cx ? "left" : "right");
      labs += '<text x="' + l[0].toFixed(1) + '" y="' + (l[1] + 4).toFixed(1) + '" font-size="10" fill="#8c7c72" text-anchor="' + anchor + '">' + (short[labels[i]] || labels[i]) + "</text>";
    }
    var pts2 = [];
    for (var j = 0; j < n; j++) {
      var p2 = pt(j, R * Math.max(0.15, S.self[j] / 5));
      pts2.push(p2[0].toFixed(1) + "," + p2[1].toFixed(1));
    }
    return '<svg viewBox="0 0 260 250" width="260" height="250">' + rings + axes + labs +
      '<polygon points="' + pts2.join(" ") + '" fill="rgba(201,107,120,.20)" stroke="#c96b78" stroke-width="1.6"/>' +
      pts2.map(function (p) { var c = p.split(","); return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="2.4" fill="#c96b78"/>'; }).join("") +
      "</svg>";
  }

  /* ---------------- 热力图 ---------------- */
  function heatmap() {
    var cols = 8, rows = 7, today = new Date();
    var start = addDays(today, -(cols * rows - 1));
    var weekStart = start.getDay();
    var html = "";
    for (var c = 0; c < cols; c++) {
      html += '<div class="col">';
      for (var r = 0; r < rows; r++) {
        var idx = c * rows + r;
        var d = addDays(start, idx);
        var key = todayKey(d);
        var p = S.active[key] || 0;
        var lvl = p === 0 ? 0 : p < 3 ? 1 : p < 6 ? 2 : p < 12 ? 3 : 4;
        html += '<div class="cell' + (lvl ? " l" + lvl : "") + '" title="' + key + " · " + p + ' 点活跃度"></div>';
      }
      html += "</div>";
    }
    return '<div class="heat">' + html + "</div>";
  }

  /* ---------------- 视图：计划 ---------------- */
  function viewPlan() {
    var stages = DATA.plan.stages.map(function (s) {
      return '<div class="card mt"><div class="card-h"><h3>' + s.name + '</h3>' +
        '<span class="tag">' + s.span + " · 占 " + s.pct + "% 精力</span></div>" +
        '<div class="bar ' + (s.color === "#2f5d50" ? "green" : s.color === "#b8894a" ? "gold" : "") + '" style="margin-bottom:12px">' +
        '<i style="width:' + s.pct + "%;background:" + s.color + '"></i></div>' +
        '<div class="note" style="margin-bottom:10px">阶段目标：' + s.goal + "</div>" +
        '<table><thead><tr><th style="width:70px">周次</th><th>任务</th><th style="width:210px">完成标志</th></tr></thead><tbody>' +
        s.weeks.map(function (w) {
          return "<tr><td><b>" + w[0] + "</b></td><td>" + w[1] + "</td><td class=\"note\">" + w[2] + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }).join("");

    var daily = '<table><thead><tr><th class="nowrap" style="width:112px">时间</th><th style="width:64px">块</th><th>做什么</th></tr></thead><tbody>' +
      DATA.plan.daily.map(function (r) {
        return "<tr><td class=\"num nowrap\" style=\"font-size:12px\">" + r[0] + "</td><td><span class=\"badge red\">" + r[1] +
          "</span></td><td>" + r[2] + "</td></tr>";
      }).join("") + "</tbody></table>";

    return '<div class="grid g23">' +
      '<div class="card"><div class="card-h"><h3>10 周路线（甘特）</h3><span class="tag">按周滚动，不必提前焦虑</span></div>' +
      gantt() +
      '<div class="note mt-s">灰色刻度＝10 周。前紧后松：真正的分差在第 5—8 周产生，第 9—10 周只做手感和定型。</div></div>' +
      '<div class="card"><div class="card-h"><h3>每天的时间盒</h3></div>' + daily +
      '<div class="okbox mt">在职/在校都适用：把「背」放早上（记忆最干净），把「练」放晚上（有场地、有时间录像）。</div></div>' +
      "</div>" + stages +
      '<div class="card mt"><div class="card-h"><h3>贵州考情速查</h3><span class="tag">以官方公告为准</span></div>' +
      '<table><tbody>' + DATA.guizhou.rows.map(function (r) {
        return '<tr><td style="width:96px" class="note"><b>' + r[0] + "</b></td><td>" + r[1] + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function gantt() {
    var total = 70;
    var rows = DATA.plan.gantt.map(function (g) {
      var l = g[1] / total * 100, w = Math.max(2, g[2] / total * 100);
      return '<div class="g-row"><span class="note">' + g[0] + '</span><div class="g-track">' +
        '<div class="g-bar" style="left:' + l + "%;width:" + w + "%;background:" + g[3] + '">' +
        (g[2] >= 14 ? "　" : "") + "</div></div></div>";
    }).join("");
    var ticks = "";
    for (var i = 0; i <= 10; i++) ticks += "<span>" + (i === 0 ? "第1周" : i === 10 ? "第10周" : "") + "</span>";
    return '<div class="gantt"><div class="gantt-inner">' + rows +
      '<div class="g-axis"><span></span><div class="ticks">' + ticks + "</div></div></div></div>";
  }

  /* ---------------- 视图：科目一 ---------------- */
  function viewKm1() {
    var maxW = 50;
    var bars = DATA.km1.weights.map(function (w) {
      var v = w[1] * 2 + w[2];
      return barRow(w[0], v, maxW, w[3] + "分");
    }).join("");

    var mods = DATA.km1.modules.map(function (m, i) {
      return kcard({ key: "k1-" + i, idx: "0" + (i + 1), t: m.t, tag: m.tag, pts: m.pts, use: m.use });
    }).join("");

    var tpl = DATA.km1.materialTemplate.map(function (t) {
      return '<div class="tl-item"><div class="time">' + t[0] + '</div><div class="bd"><span>' + t[1] + "</span></div></div>";
    }).join("");

    return '<div class="grid g23">' +
      '<div class="card"><div class="card-h"><h3>这张卷子怎么给分</h3><span class="tag">120 分钟 / 150 分</span></div>' +
      bars +
      '<div class="note mt-s">客观题 58 分（29 题）＋材料 42 分（3 题）＋写作 50 分。想合格，写作必须写到 38 分以上，材料题要踩满 2 题。</div></div>' +
      '<div class="card"><div class="card-h"><h3>投入优先级</h3></div>' +
      '<div class="note">' +
      "<b>第一优先</b>：职业理念、职业道德（各 14 分材料，套路固定，性价比最高）<br>" +
      "<b>第二优先</b>：写作（50 分，可准备模板）<br>" +
      "<b>第三优先</b>：法律法规（8 题客观，记得住就赚）<br>" +
      "<b>最低优先</b>：文化素养（9 题，范围无边界，每天 10 题即可）</div>" +
      '<div class="quote">舞蹈生的隐藏优势：艺术类文化素养题（书法、名曲、芭蕾、歌剧）本来就是你的领域，别丢这几分。</div></div>' +
      "</div>" +
      '<div class="mt">' + mods + "</div>" +
      '<div class="grid g2 mt">' +
      '<div class="card"><div class="card-h"><h3>材料分析题：三步模板</h3></div>' + tpl +
      '<div class="warn mt-s">三条分析必须「一人一段理论＋一句材料」。只写理论不引材料，最多给一半分。</div></div>' +
      '<div class="card"><div class="card-h"><h3>写作：五段式骨架</h3></div>' +
      '<table><tbody>' + DATA.km1.essay.rows.map(function (r) {
        return "<tr><td style=\"width:96px\"><b>" + r[0] + "</b></td><td>" + r[1] + "</td></tr>";
      }).join("") + "</tbody></table>" +
      '<div class="okbox mt-s">每周手写 1 篇，限时 50 分钟。手写和打字是两种能力。</div></div>' +
      "</div>";
  }

  /* ---------------- 视图：科目二 ---------------- */
  function viewKm2() {
    var types = DATA.km2.types.map(function (t) {
      return '<div class="kpi"><div class="lbl">' + t[0] + '</div><div class="val">' + t[1].replace("题", "") +
        '<small>题</small></div><div class="note">' + t[2] + "</div></div>";
    }).join("");

    var mods = DATA.km2.modules.map(function (m, i) {
      return kcard({ key: "k2-" + i, idx: "0" + (i + 1), t: m.t, tag: m.tag, pts: m.pts, use: m.use });
    }).join("");

    return '<div class="card"><div class="card-h"><h3>题型与分值</h3><span class="tag">' + DATA.km2.duration +
      " · " + DATA.km2.pass + '</span></div><div class="grid g4">' + types + "</div>" +
      '<div class="warn mt">辨析题 4 题 32 分，是「送分也是送命」的地方：判断错，整题基本没分。宁可写「这个说法是片面的」，再补正确表述。</div></div>' +
      '<div class="mt">' + mods + "</div>" +
      '<div class="grid g2 mt">' +
      '<div class="card"><div class="card-h"><h3>简答题必背池（15 条）</h3><span class="tag">先背这 15 条，覆盖八成</span></div>' +
      '<div class="note">' + DATA.km2.shortAnswerPool.map(function (s, i) {
        return "<div style=\"padding:3px 0\">" + (i + 1) + ". " + s + "</div>";
      }).join("") + "</div></div>" +
      '<div class="card"><div class="card-h"><h3>辨析题高频陷阱（8 条）</h3><span class="tag">先判断，再说理</span></div>' +
      '<div class="note">' + DATA.km2.judgePool.map(function (s) {
        return "<div style=\"padding:3px 0\">· " + s + "</div>";
      }).join("") + "</div></div></div>";
  }

  /* ---------------- 视图：面试流程 ---------------- */
  function viewInterview() {
    var flow = DATA.interview.flow.map(function (f) {
      return '<div class="tl-item"><div class="time">' + f[0] + '</div><div class="bd"><strong>' + f[1] +
        "</strong><span>" + f[2] + "</span></div></div>";
    }).join("");

    var blocks = DATA.interview.structure.map(function (b, i) {
      var qs = b.qs.map(function (q) {
        return '<div style="padding:7px 0;border-bottom:1px dashed var(--line2)"><b>' + q[0] + "</b>" +
          '<div class="note" style="margin-top:2px">' + q[1] + "</div></div>";
      }).join("");
      return '<details class="kcard"><summary><span class="idx">0' + (i + 1) + '</span><span class="t">' + b.t +
        '</span><span class="badge green">' + b.frame + '</span><span class="dot">›</span></summary>' +
        '<div class="bd">' + qs + "</div></details>";
    }).join("");

    return '<div class="grid g23">' +
      '<div class="card"><div class="card-h"><h3>20 分钟怎么走完</h3><span class="tag">贵州：备课 20′ + 面试 20′</span></div>' +
      flow + "</div>" +
      '<div class="card"><div class="card-h"><h3>结构化六类 + 框架</h3></div>' + blocks +
      '<div class="okbox mt-s">每题 60—90 秒。开头第一句必须是判断/态度，中间给 2—3 个做法，最后一句收束。</div></div>' +
      "</div>" +
      '<div class="grid g2 mt">' +
      '<div class="card"><div class="card-h"><h3>答辩高频 5 问</h3></div>' +
      '<table><tbody>' + DATA.interview.defend.map(function (d) {
        return "<tr><td style=\"width:190px\"><b>" + d[0] + "</b></td><td>" + d[1] + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<div class="card"><div class="card-h"><h3>礼仪与现场细节</h3></div>' +
      DATA.interview.etiq.map(function (e) {
        return '<div class="task"><div class="tx">' + e + "</div></div>";
      }).join("") +
      '<div class="warn mt-s">舞蹈考场通常空间大、回声重：进门先站定再开口，音量比平时大一档，否则考官听不清你的讲解。</div></div>' +
      "</div>";
  }

  /* ---------------- 视图：试讲 ---------------- */
  function viewTrial() {
    var budget = DATA.trial.budget.map(function (b) {
      return '<div class="tl-item"><div class="time">' + b[0] + '</div><div class="bd"><strong>' + b[1] +
        "</strong><span>" + b[2] + "</span></div></div>";
    }).join("");

    var script = DATA.trial.script.body.map(function (s) {
      return '<div style="padding:7px 0"><span class="badge">' + s[0] + "</span><div style=\"margin-top:4px\">" +
        s[1] + "</div></div>";
    }).join("");

    var topics = DATA.trial.topics.map(function (t, i) {
      return kcard({
        key: "tp-" + i, idx: (i + 1 < 10 ? "0" : "") + (i + 1), t: t.t, tag: t.cat,
        rows: [["教学重点", t.key], ["教学难点", t.hard], ["纠错话术", t.fix]]
      });
    }).join("");

    var rules = DATA.trial.rules.map(function (r) {
      return '<div class="task"><div class="tx">' + r + "</div></div>";
    }).join("");

    var outline = DATA.trial.outline.map(function (o) {
      return "<tr><td style=\"width:88px\"><b>" + o[0] + "</b></td><td>" + o[1] + "</td></tr>";
    }).join("");

    return '<div class="card"><div class="card-h"><h3>试讲计时器</h3><span class="tag">20′ 备课 + 20′ 面试</span></div>' +
      '<div class="timer-wrap"><div class="dial"><div id="dialSvg">' + dialSvg(1) + '</div><div class="center">' +
      '<div class="t" id="timerText">20:00</div><div class="s" id="timerPhase">备课</div></div></div>' +
      '<div class="timer-info"><div class="timer-steps" id="stepsBox">' +
      ['备课 20′', '结构化 5′', '试讲 10′', '答辩 5′'].map(function (n, i) {
        return '<div class="tstep' + (i === 0 ? " on" : "") + '"><span class="n">' + (i + 1) + "</span>" + n + "</div>";
      }).join("") +
      "</div>" +
      '<div class="mt-s" style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn sm" id="timerStart">开始</button>' +
      '<button class="btn ghost sm" id="timerNext">下一环节</button>' +
      '<button class="btn ghost sm" id="timerReset">重置</button></div>' +
      '<div class="tip" id="timerTip">第一个环节是备课 20 分钟：先写目标与重难点，再排环节，最后默讲导入。</div>' +
      "</div>" +
      '<div class="trial-mo"><div class="mo-slot slot-trial" data-mo="trial"></div></div>' +
      "</div></div>" +

      '<div class="grid g23 mt">' +
      '<div class="card"><div class="card-h"><h3>10 分钟时间预算</h3><span class="tag">超时＝没讲完</span></div>' +
      budget + "</div>" +
      '<div class="card"><div class="card-h"><h3>八条硬规则</h3><span class="tag">贴在手边</span></div>' + rules +
      '<div class="quote">背结构，不背台词。考场抽到「藏族踢踏」你却背了「横拧」，背稿就是灾难。</div></div>' +
      "</div>" +

      '<div class="card mt"><div class="card-h"><h3>完整逐字稿范例</h3><span class="tag">中国古典舞身韵「地面横拧」</span></div>' +
      '<div style="max-height:480px;overflow:auto;padding-right:6px">' + script + "</div></div>" +

      '<div class="card mt"><div class="card-h"><h3>22 个高频篇目：重点 / 难点 / 纠错话术</h3>' +
      '<span class="tag">点开即用，抽到哪类都能开口</span></div>' + topics + "</div>" +

      '<div class="grid g2 mt">' +
      '<div class="card"><div class="card-h"><h3>自备逐字稿 / 草稿区</h3><span class="tag">自动保存在本机</span></div>' +
      '<label class="f">用下面的骨架，把你自己的话填进去</label>' +
      '<textarea id="scriptDraft" placeholder="问候 → 组织教学 → 导入（示范＋两个问题）→ 热身 → 新授（要领＋三级分解）→ 练习纠错 → 组合 → 展示评价 → 小结作业">' +
      esc(S.scriptDraft) + "</textarea></div>" +
      '<div class="card"><div class="card-h"><h3>教案模板（背诵版）</h3></div>' +
      '<table><tbody>' + outline + "</tbody></table></div>" +
      "</div>";
  }

  function dialSvg(frac) {
    var C = 2 * Math.PI * 82;
    return '<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="82" fill="none" stroke="#f4e6d9" stroke-width="10"/>' +
      '<circle id="dialArc" cx="100" cy="100" r="82" fill="none" stroke="#c96b78" stroke-width="10" stroke-linecap="round" ' +
      'stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - frac)).toFixed(1) + '" transform="rotate(-90 100 100)"/></svg>';
  }

  /* ---------------- 计时器逻辑 ---------------- */
  var PHASES = [
    { n: "备课", m: 20, tip: "先写目标与重难点（10 分钟），再排教学环节与口令（8 分钟），最后默讲导入（2 分钟）。" },
    { n: "结构化", m: 5, tip: "两题共 5 分钟：每题先说态度，再说 2—3 个做法，最后一句收束。不要停顿超过 3 秒。" },
    { n: "试讲", m: 10, tip: "0—1.5′ 导入；1.5—2.5′ 复习与板书；2.5—6.5′ 新授分解；6.5—8.5′ 组合；8.5—9.5′ 展示评价；9.5—10′ 小结作业。" },
    { n: "答辩", m: 5, tip: "听完问题先停 1 秒再答；不会的坦诚说明，并给出补救思路，不要硬编。" }
  ];
  var T = { i: 0, left: PHASES[0].m * 60, run: false, t0: 0, raf: null };

  function timerPaint() {
    var p = PHASES[T.i];
    var total = p.m * 60;
    var txt = $("#timerText"), ph = $("#timerPhase");
    if (!txt) return;
    var sec = Math.max(0, Math.floor(T.left));
    txt.textContent = pad(Math.floor(sec / 60)) + ":" + pad(sec % 60);
    ph.textContent = p.n + " · 第 " + (T.i + 1) + "/4 环节";
    var arc = $("#dialArc");
    if (arc) arc.setAttribute("stroke-dashoffset", (2 * Math.PI * 82 * (1 - T.left / total)).toFixed(1));
    $$(".tstep").forEach(function (el, i) { el.classList.toggle("on", i === T.i); });
    var btn = $("#timerStart");
    if (btn) btn.textContent = T.run ? "暂停" : (T.left === total ? "开始" : "继续");
  }
  function tick() {
    if (!T.run) return;
    var now = Date.now();
    T.left -= (now - T.t0) / 1000;
    T.t0 = now;
    if (T.left <= 0) {
      T.left = 0; T.run = false; timerPaint();
      var tip = $("#timerTip");
      if (tip) tip.innerHTML = "<b style=\"color:#c96b78\">「" + PHASES[T.i].n + "」时间到。</b>按「下一环节」继续；若是在真考场，立刻收尾，不要恋战。";
      paintMascots();
      return;
    }
    timerPaint();
    T.raf = requestAnimationFrame(tick);
  }
  function bindTimer() {
    timerPaint();
    var start = $("#timerStart"), next = $("#timerNext"), reset = $("#timerReset");
    if (!start) return;
    start.onclick = function () {
      T.run = !T.run;
      if (T.run) { T.t0 = Date.now(); touch(0); tick(); } else { cancelAnimationFrame(T.raf); timerPaint(); }
      paintMascots();
    };
    next.onclick = function () {
      cancelAnimationFrame(T.raf); T.run = false;
      T.i = (T.i + 1) % PHASES.length;
      T.left = PHASES[T.i].m * 60;
      timerPaint();
      $("#timerTip").textContent = PHASES[T.i].tip;
      touch(2); save(); paintMascots();
    };
    reset.onclick = function () {
      cancelAnimationFrame(T.raf); T.run = false; T.i = 0; T.left = PHASES[0].m * 60;
      timerPaint(); $("#timerTip").textContent = PHASES[0].tip;
    };
  }

  /* ---------------- 视图：舞蹈专业库 ---------------- */
  function viewDance() {
    var cards = DATA.dance.sections.map(function (s, i) {
      return kcard({ key: "ds-" + i, idx: "0" + (i + 1), t: s.t, tag: s.tag, rows: s.rows });
    }).join("");
    return '<div class="okbox">这个库解决的是面试里最容易被追问的部分：<b>动作要领说不清、舞种风格分不开、专业认知答不上</b>。每张卡点开，用 90 秒讲一遍，讲不出来的就是你的缺口。</div>' +
      '<div class="mt">' + cards + "</div>" +
      '<div class="card mt"><div class="card-h"><h3>贵州本地加分素材</h3><span class="tag">答「课程资源开发」或「思政融入」时用</span></div>' +
      '<div class="note">丹寨苗族锦鸡舞、台江反排木鼓舞、侗族多耶——把本土舞蹈进课堂讲成「文化传承＋课程资源开发」，比空谈「热爱传统文化」有效得多。说清三件事：动作特征、文化背景、怎么变成一节课。</div></div>';
  }

  /* ---------------- 视图：题库 ---------------- */
  var qFilter = "全部";
  function viewQuiz() {
    var st = quizStats();
    var wrongN = Object.keys(S.wrong).length;
    var cats = ["全部", "科目一", "科目二", "舞蹈", "只看错题"];
    var chips = cats.map(function (c) {
      return '<button class="chip' + (qFilter === c ? " on" : "") + '" data-qf="' + c + '">' + c + "</button>";
    }).join("");

    var list = DATA.quiz.filter(function (q) {
      if (qFilter === "只看错题") return S.wrong[q.id];
      if (qFilter === "全部") return true;
      return q.cat === qFilter;
    });

    var qHtml = list.length ? list.map(function (q, i) {
      var ans = S.answers[q.id];
      var opts = q.o.map(function (o, oi) {
        var cls = "opt";
        if (ans !== undefined) {
          if (oi === q.a) cls += " ok";
          else if (oi === ans) cls += " no";
        }
        return '<div class="' + cls + '" data-q="' + q.id + '" data-o="' + oi + '"><span class="k">' +
          "ABCD"[oi] + "</span><span>" + o + "</span></div>";
      }).join("");
      var ex = (ans !== undefined)
        ? '<div class="explain"><div class="res ' + (ans === q.a ? "ok" : "no") + '">' +
        (ans === q.a ? "✓ 正确" : "✗ 错误 · 正确答案 " + "ABCD"[q.a]) + "</div>" +
        "<div style=\"margin-top:4px\">" + q.e + "</div></div>"
        : "";
      return '<div class="card mt"><div class="qbox"><div class="qmeta">' + q.cat + " · 第 " + (i + 1) + " 题</div>" +
        '<div class="qtext">' + q.q + "</div>" + opts + ex + "</div></div>";
    }).join("") : '<div class="card mt note">这个分类下还没有错题。先去刷题吧。</div>';

    return '<div class="grid g4">' +
      '<div class="kpi"><div class="lbl">已作答</div><div class="val">' + st.done + '<small>/' + TOTAL_Q + '</small></div></div>' +
      '<div class="kpi"><div class="lbl">正确率</div><div class="val">' + st.rate + '<small>%</small></div></div>' +
      '<div class="kpi"><div class="lbl">错题数</div><div class="val">' + wrongN + '<small>题</small></div></div>' +
      '<div class="kpi"><div class="lbl">题库总量</div><div class="val">' + TOTAL_Q + '<small>题</small></div></div>' +
      "</div>" +
      '<div class="card mt"><div class="card-h"><h3>题库</h3><span class="tag">单选 · 选完立即判分</span></div>' +
      '<div class="quiz-toolbar">' + chips + "</div>" +
      '<div class="note">共 ' + list.length + " 题。'只看错题' 用来二刷；做错的题会自动进错题本，答对后自动移出。</div>" +
      (qFilter === "只看错题" ? '<div class="mt-s"><button class="btn ghost sm" id="clearWrong">清空错题本</button></div>' : "") + "</div>" +
      qHtml;
  }

  /* ---------------- 视图：资料 ---------------- */
  function viewRes() {
    var off = DATA.resources.official.map(function (r, i) {
      return '<div class="res"><div class="ico">0' + (i + 1) + '</div><div class="bd"><a href="' + r[1] +
        '" target="_blank" rel="noopener">' + r[0] + "</a><p>" + r[2] + "</p></div><div class=\"src\">官方</div></div>";
    }).join("");

    var vids = DATA.resources.videos.map(function (r, i) {
      return '<div class="res"><div class="ico" style="background:#e4ecf3;color:#3c5a78">▶</div><div class="bd"><a href="' + r[1] +
        '" target="_blank" rel="noopener">' + r[0] + "</a><p>" + r[2] + "</p></div><div class=\"src\">抖音</div></div>";
    }).join("");

    var plat = DATA.resources.platforms.map(function (p) {
      return "<tr><td style=\"width:88px\"><b>" + p[0] + "</b></td><td>" + p[1] + "</td><td>" + p[2] +
        "</td><td class=\"note\">" + p[3] + "</td></tr>";
    }).join("");

    var pit = DATA.resources.pitfalls.map(function (p) {
      return '<div class="task"><div class="tx">' + p + "</div></div>";
    }).join("");

    return '<div class="grid g23">' +
      '<div class="card"><div class="card-h"><h3>官方入口（必看）</h3><span class="tag">报名、大纲、认定只看这里</span></div>' + off + "</div>" +
      '<div class="card"><div class="card-h"><h3>为什么不用「某一个 App」解决全部</h3></div>' +
      '<div class="note">主流平台强在笔试客观题与背记，弱在<b>中职舞蹈专业</b>和<b>试讲实操</b>——这两块恰恰是面试的决胜区。所以这个工作台的分工是：' +
      "<br><br><b>平台</b>：刷客观题、背简答、看免费课。<br><b>这里</b>：考情、专业库、逐字稿、计时器、自评、复习队列。</div>" +
      '<div class="quote">不要在 5 个 App 之间来回横跳。选定 2 个（一个刷题、一个背记）＋这个工作台，就够。</div></div>' +
      "</div>" +
      '<div class="card mt"><div class="card-h"><h3>主流备考平台的优点与不足</h3><span class="tag">按「怎么用」而不是「谁更好」来选</span></div>' +
      '<table><thead><tr><th>平台</th><th>优点</th><th>不足</th><th>怎么用</th></tr></thead><tbody>' + plat + "</tbody></table></div>" +
      '<div class="grid g23 mt">' +
      '<div class="card"><div class="card-h"><h3>视频：真实试讲与动作示范</h3><span class="tag">看结构、看语感，不背台词</span></div>' + vids +
      '<div class="warn mt-s">网络视频良莠不齐：只学「结构、口令、纠错方式」，动作要领必须回到专业教材核对。遇到说法冲突，以教材与教学标准为准。</div></div>' +
      '<div class="card"><div class="card-h"><h3>八个坑，别踩</h3></div>' + pit + "</div>" +
      "</div>";
  }

  /* ---------------- 视图：笔记与设置 ---------------- */
  function viewNote() {
    var left = daysBetween(todayKey(), S.targetDate);
    return '<div class="grid g23">' +
      '<div class="card"><div class="card-h"><h3>学习笔记</h3><span class="tag">自动保存到本机</span></div>' +
      '<textarea id="notes" style="min-height:320px" placeholder="记录：今天卡住的点、试讲录像里发现的问题、考官可能的追问……">' + esc(S.notes) + "</textarea>" +
      '<div class="note mt-s" id="noteSave">输入即保存。</div></div>' +
      '<div><div class="card"><div class="card-h"><h3>考试设置</h3></div>' +
      '<label class="f">目标名称</label><input type="text" id="targetName" value="' + esc(S.targetName) + '">' +
      '<label class="f">考试日期</label><input type="date" id="targetDate" value="' + S.targetDate + '">' +
      '<div class="note mt-s">当前：距目标 <b>' + left + "</b> 天。<br>笔试通常在 3 月中旬、面试在 5 月中旬；贵州 2026 年下半年面试为 12 月 5—6 日，可据此推算节奏。</div>" +
      '<button class="btn mt-s" id="saveTarget">保存设置</button></div>' +
      '<div class="card mt"><div class="card-h"><h3>数据</h3></div>' +
      '<div class="note">所有进度、错题、笔记都存在这台电脑的浏览器里，不会上传。</div>' +
      '<div class="mt-s" style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn ghost sm" id="exportData">导出备份 JSON</button>' +
      '<button class="btn ghost sm" id="importBtn">导入备份</button>' +
      '<input type="file" id="importFile" accept="application/json" style="display:none">' +
      '<button class="btn ghost sm" id="resetData" style="color:#a8322c;border-color:#e7c9c5">清空全部数据</button></div>' +
      '<div class="note mt-s" id="dataMsg"></div></div>' +
      '<div class="card mt"><div class="card-h"><h3>陪读小人状态</h3><span class="tag">按学习/未学习时间自动切换</span></div>' +
      '<table><tbody>' +
      '<tr><td class="nowrap"><b>学习中</b></td><td>3 分钟内有操作，今日专注不足 50 分钟</td></tr>' +
      '<tr><td class="nowrap"><b>努力中</b></td><td>3 分钟内有操作，今日专注已过 50 分钟</td></tr>' +
      '<tr><td class="nowrap"><b>奋斗中</b></td><td>试讲计时器正在跑（备课/结构化/试讲/答辩任一环节）</td></tr>' +
      '<tr><td class="nowrap"><b>摸鱼中</b></td><td>停手 3—20 分钟</td></tr>' +
      '<tr><td class="nowrap"><b>偷懒中</b></td><td>停手 20 分钟—4 小时</td></tr>' +
      '<tr><td class="nowrap"><b>偷玩手机</b></td><td>停手超过 4 小时（多半是隔天才回来）</td></tr>' +
      "</tbody></table>" +
      '<div class="note mt-s">专注分钟每 30 秒累计一次：只有页面在前台、且 6 分钟内有操作（或计时器在跑）才计入，所以数字不会因为你挂机而虚高。</div></div>' +
      '<div class="card mt flat"><div class="card-h"><h3>使用建议</h3></div>' +
      '<div class="note">① 每天先看「总览」，勾完 3 项任务再打开别的页面。<br>② 知识卡「标记已掌握」＝进入复习队列，别一次标 10 张。<br>③ 每周至少 2 次用计时器走完整流程并录像。<br>④ 面试前 3 天只做两件事：过逐字稿骨架、练体能。</div></div>' +
      "</div></div>" +
      '<div class="foot"><span>中职舞蹈教资 · 学习工作台 · 单机版，无需联网</span><span>内容整理：2026-11-26</span></div>';
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    var main = $("#appMain");
    if (!main) return;
    if (current !== "trial" && T.run) { T.run = false; if (T.raf) cancelAnimationFrame(T.raf); }
    var map = {
      dash: viewDash, plan: viewPlan, km1: viewKm1, km2: viewKm2,
      interview: viewInterview, trial: viewTrial, dance: viewDance,
      quiz: viewQuiz, res: viewRes, note: viewNote
    };
    main.innerHTML = (map[current] || viewDash)();
    if (current === "trial") bindTimer();
    bindView();
    paintMascots();
  }

  function bindView() {
    // 知识卡：标记掌握
    $$(".act-master").forEach(function (b) {
      b.onclick = function (ev) {
        ev.preventDefault();
        var k = b.dataset.key;
        if (S.units[k]) { delete S.units[k]; }
        else {
          S.units[k] = true;
          var u = UNITS.filter(function (x) { return x.k === k; })[0];
          if (u && !S.review.some(function (r) { return r.k === k; })) {
            S.review.push({ k: k, n: u.n, step: 0, due: todayKey(addDays(new Date(), 1)) });
          }
          touch(3);
        }
        save(); render();
      };
    });

    // 任务勾选
    $$("[data-task]").forEach(function (cb) {
      cb.onchange = function () {
        var i = +cb.dataset.task;
        S.tasks[i] = cb.checked;
        if (cb.checked) touch(1);
        save(); render();
      };
    });

    // 复习完成
    $$(".act-review").forEach(function (b) {
      b.onclick = function () {
        var i = +b.dataset.i;
        var r = S.review[i];
        if (!r) return;
        var steps = [1, 3, 7, 15, 30];
        r.step = Math.min(r.step + 1, steps.length - 1);
        r.due = todayKey(addDays(new Date(), steps[r.step]));
        touch(2); save(); render();
      };
    });

    // 自评滑杆
    $$("[data-self]").forEach(function (sl) {
      sl.oninput = function () {
        var i = +sl.dataset.self;
        S.self[i] = +sl.value;
        sl.parentNode.querySelector(".v").textContent = sl.value;
        var box = $("#radarBox");
        if (box) box.innerHTML = radarSvg();
        save();
      };
    });

    // 题库选项
    $$(".opt").forEach(function (o) {
      o.onclick = function () {
        var id = o.dataset.q, oi = +o.dataset.o;
        if (S.answers[id] !== undefined) return;
        var q = DATA.quiz.filter(function (x) { return x.id === id; })[0];
        S.answers[id] = oi;
        if (oi !== q.a) S.wrong[id] = true; else delete S.wrong[id];
        touch(1); save(); render();
      };
    });
    $$("[data-qf]").forEach(function (c) {
      c.onclick = function () { qFilter = c.dataset.qf; render(); };
    });
    var cw = $("#clearWrong");
    if (cw) {
      cw.onclick = function () {
        if (!confirm("清空错题本？（已作答记录保留，只清空错题标记）")) return;
        S.wrong = {};
        Object.keys(S.answers).forEach(function (id) {
          var q = DATA.quiz.filter(function (x) { return x.id === id; })[0];
          if (q && S.answers[id] !== q.a) S.wrong[id] = true;
        });
        save(); render();
      };
    }

    // 试讲草稿 / 笔记
    var sd = $("#scriptDraft");
    if (sd) {
      sd.oninput = function () { S.scriptDraft = sd.value; save(); };
    }
    var nt = $("#notes");
    if (nt) {
      nt.oninput = function () {
        S.notes = nt.value; save();
        var m = $("#noteSave"); if (m) m.textContent = "已保存 · " + new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      };
    }

    // 设置
    var st = $("#saveTarget");
    if (st) {
      st.onclick = function () {
        S.targetName = $("#targetName").value.trim() || DATA.meta.targetName;
        S.targetDate = $("#targetDate").value || S.targetDate;
        save(); render();
      };
    }
    var ex = $("#exportData");
    if (ex) {
      ex.onclick = function () {
        var blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "舞蹈教资学习数据_" + todayKey() + ".json";
        a.click(); URL.revokeObjectURL(a.href);
        $("#dataMsg").textContent = "已导出 JSON 备份。";
      };
    }
    var ib = $("#importBtn"), iff = $("#importFile");
    if (ib && iff) {
      ib.onclick = function () { iff.click(); };
      iff.onchange = function () {
        var f = iff.files[0]; if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          try {
            var o = JSON.parse(fr.result);
            Object.keys(o).forEach(function (k) { if (k in S) S[k] = o[k]; });
            save(); render();
          } catch (e) { alert("文件格式不对，无法导入。"); }
        };
        fr.readAsText(f);
      };
    }
    var rd = $("#resetData");
    if (rd) {
      rd.onclick = function () {
        if (!confirm("确定清空全部学习数据（进度、错题、笔记）？此操作不可恢复。")) return;
        localStorage.removeItem(KEY);
        location.reload();
      };
    }

    var gp = $(".go-plan");
    if (gp) gp.onclick = function () { go("plan"); };
  }

  /* ---------------- 初始化 ---------------- */
  function markAct() {
    var wasIdle = !S.lastAct || Date.now() - S.lastAct > 60000;
    S.lastAct = Date.now();
    if (wasIdle) paintMascots();
  }
  function heartbeat() {
    var now = Date.now();
    if (!document.hidden && (now - S.lastAct < 6 * 60000 || T.run)) {
      var k = todayKey();
      S.focus[k] = (S.focus[k] || 0) + 0.5;
      save();
    }
    paintMascots();
  }
  function init() {
    load();
    var h = (location.hash || "").replace("#", "");
    if (ROUTES.some(function (r) { return r.id === h; })) current = h;
    var nav = $("#nav");
    if (nav) {
      nav.innerHTML = ROUTES.map(function (r) {
        if (r.group) return '<div class="nav-group">' + r.group + "</div>";
        return '<button class="nav-item' + (r.id === current ? " on" : "") + '" data-id="' + r.id +
          '"><span class="no">' + r.no + "</span>" + r.name + "</button>";
      }).join("");
      $$(".nav-item", nav).forEach(function (b) { b.onclick = function () { go(b.dataset.id); }; });
    }

    var dock = $("#dock");
    if (dock) {
      dock.addEventListener("click", function (e) {
        if (e.target && e.target.id === "dockGo") { go("plan"); return; }
        dock.classList.toggle("show");
      });
    }
    document.addEventListener("pointerdown", markAct, true);
    document.addEventListener("keydown", markAct, true);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) markAct(); });

    render();
    setInterval(heartbeat, 30000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
