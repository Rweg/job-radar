(function () {
  "use strict";

  const STORAGE_KEY = "rwego-job-radar-state-v1";
  const state = {
    jobs: [],
    saved: new Set(),
    applicationState: {},
    notes: {},
    view: "priority",
    activeJob: null
  };

  const $ = (selector) => document.querySelector(selector);
  const escapeHTML = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function loadLocalState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      state.saved = new Set(raw.saved || []);
      state.applicationState = raw.applicationState || {};
      state.notes = raw.notes || {};
    } catch (error) {
      console.warn("Could not restore local job state", error);
    }
  }

  function saveLocalState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      saved: [...state.saved],
      applicationState: state.applicationState,
      notes: state.notes
    }));
  }

  function statusLabel(job) {
    if (job.status === "active") return "Active source check";
    if (job.status === "watch") return "Watchlist / verify";
    return "Closed in source check";
  }

  function eligibilityLabel(job) {
    if (job.eligibility === "likely") return "Likely practical from Rwanda";
    if (job.eligibility === "conditional") return "Work rights / sponsorship conditional";
    return "Eligibility needs verification";
  }

  function deadlineMeta(job) {
    if (!job.deadline || !/\d{4}/.test(job.deadline)) {
      return { label: job.deadline || "Rolling / no date published", className: "deadline-rolling" };
    }
    const date = new Date(job.deadline);
    if (Number.isNaN(date.getTime())) {
      return { label: job.deadline, className: "deadline-rolling" };
    }
    const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
    if (days < 0) return { label: `Closed ${job.deadline}`, className: "deadline-closed" };
    if (days <= 7) return { label: `Apply within ${days} day${days === 1 ? "" : "s"} · ${job.deadline}`, className: "deadline-urgent" };
    if (days <= 30) return { label: `Closing soon · ${job.deadline}`, className: "deadline-soon" };
    return { label: `Deadline · ${job.deadline}`, className: "deadline-open" };
  }

  function jobMatches(job) {
    const search = $("#search-input").value.trim().toLowerCase();
    const status = $("#status-filter").value;
    const location = $("#location-filter").value;
    const family = $("#family-filter").value;
    const eligibility = $("#eligibility-filter").value;
    const searchable = [job.title, job.company, job.location, job.whyFit, ...(job.skills || []), ...(job.families || [])].join(" ").toLowerCase();

    if (search && !searchable.includes(search)) return false;
    if (status !== "all" && job.status !== status) return false;
    if (location !== "all" && !(job.locationFilters || []).includes(location)) return false;
    if (family !== "all" && !(job.familyFilters || []).includes(family)) return false;
    if (eligibility !== "all" && job.eligibility !== eligibility) return false;

    if (state.view === "remote" && !(job.locationFilters || []).includes("remote")) return false;
    if (state.view === "rwanda" && !(job.locationFilters || []).includes("rwanda") && !(job.locationFilters || []).includes("africa")) return false;
    if (state.view === "conditional" && job.eligibility !== "conditional") return false;
    if (state.view === "saved" && !state.saved.has(job.id)) return false;
    if (state.view === "priority" && (job.status !== "active" || job.fitScore < 80)) return false;
    return true;
  }

  function jobCard(job) {
    const saved = state.saved.has(job.id);
    const deadline = deadlineMeta(job);
    const tags = (job.skills || []).slice(0, 4).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join("");
    return `<article class="job-card ${escapeHTML(job.status)}" data-job-id="${escapeHTML(job.id)}">
      <div class="job-card-main">
        <div class="job-topline">
          <div>
            <p class="job-company">${escapeHTML(job.company)}</p>
            <h3 class="job-title">${escapeHTML(job.title)}</h3>
            <p class="job-location">${escapeHTML(job.location)} · ${escapeHTML(job.workMode)}</p>
          </div>
          <div class="score"><strong>${escapeHTML(job.fitScore)}</strong><span>fit / 100</span></div>
        </div>
        <div class="status-row">
          <span class="status-badge status-${escapeHTML(job.status)}">${escapeHTML(statusLabel(job))}</span>
          <span class="eligibility-badge eligibility-${escapeHTML(job.eligibility)}">${escapeHTML(eligibilityLabel(job))}</span>
          <span class="deadline-badge ${deadline.className}">${escapeHTML(deadline.label)}</span>
        </div>
        <p class="job-fit">${escapeHTML(job.whyFit)}</p>
        <div class="tags">${tags}</div>
        <div class="job-footer">
          <div class="job-footer-left">
            <a href="${escapeHTML(job.applyUrl)}" target="_blank" rel="noopener noreferrer">Open application</a>
            <button class="text-button details-button" type="button" data-id="${escapeHTML(job.id)}">View preparation</button>
          </div>
          <div class="job-footer-right">
            <span class="muted">Verified ${escapeHTML(job.lastVerified)}</span>
            <button class="save-button ${saved ? "is-saved" : ""}" type="button" data-save-id="${escapeHTML(job.id)}">${saved ? "Saved" : "Save job"}</button>
          </div>
        </div>
      </div>
    </article>`;
  }

  function render() {
    const jobs = state.jobs.filter(jobMatches).sort((a, b) => b.fitScore - a.fitScore || a.title.localeCompare(b.title));
    $("#job-list").innerHTML = jobs.map(jobCard).join("");
    $("#result-count").textContent = `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"}`;
    $("#empty-state").hidden = jobs.length !== 0;
    $("#results-title").textContent = state.view === "priority" ? "Best current matches" : state.view === "saved" ? "Saved jobs" : "Filtered opportunities";
    $("#metric-open").textContent = state.jobs.filter((job) => job.status === "active").length;
    $("#metric-high-fit").textContent = state.jobs.filter((job) => job.status === "active" && job.fitScore >= 80).length;
    $("#metric-rwanda").textContent = state.jobs.filter((job) => job.status === "active" && ((job.locationFilters || []).includes("rwanda") || (job.locationFilters || []).includes("africa"))).length;
    $("#metric-saved").textContent = state.saved.size;
    $("#saved-count").textContent = state.saved.size;
    $("#priority-count").textContent = state.jobs.filter((job) => job.status === "active" && job.fitScore >= 80).length;
    $("#source-summary").textContent = `${state.jobs.length} curated records across ${new Set(state.jobs.map((job) => job.company)).size} employers and source families. Active records are checked against the listed source; unknowns remain visible as unknowns.`;
    bindCardEvents();
  }

  function bindCardEvents() {
    document.querySelectorAll("[data-save-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.saveId;
        if (state.saved.has(id)) state.saved.delete(id); else state.saved.add(id);
        saveLocalState();
        render();
      });
    });
    document.querySelectorAll(".details-button").forEach((button) => button.addEventListener("click", () => openDialog(button.dataset.id)));
  }

  function list(items) {
    return (items || []).map((item) => `<li>${escapeHTML(item)}</li>`).join("");
  }

  function openDialog(id) {
    const job = state.jobs.find((candidate) => candidate.id === id);
    if (!job) return;
    state.activeJob = job;
    $("#dialog-company").textContent = `${job.company} · ${job.status === "active" ? "current record" : "watchlist record"}`;
    $("#dialog-title").textContent = job.title;
    $("#dialog-location").textContent = `${job.location} · ${job.workMode}`;
    $("#dialog-body").innerHTML = `<section class="detail-section">
        <h3>Decision snapshot</h3>
        <div class="detail-row"><strong>Technical fit</strong><span>${escapeHTML(job.fitScore)}/100</span></div>
        <div class="detail-row"><strong>Eligibility</strong><span>${escapeHTML(eligibilityLabel(job))}</span></div>
        <div class="detail-row"><strong>Work-right note</strong><span>${escapeHTML(job.workRights)}</span></div>
        <div class="detail-row"><strong>Closing date</strong><span>${escapeHTML(job.deadline || "Rolling / not published")}</span></div>
        <div class="detail-row"><strong>Compensation</strong><span>${escapeHTML(job.compensation || "Not published")}</span></div>
      </section>
      <section class="detail-section"><h3>Why this matches you</h3><p>${escapeHTML(job.whyFit)}</p><div class="tags">${(job.skills || []).map((skill) => `<span class="tag">${escapeHTML(skill)}</span>`).join("")}</div></section>
      <section class="detail-section"><h3>Evidence to show</h3><ul>${list(job.evidence)}</ul></section>
      <section class="detail-section"><h3>Gaps to close or explain</h3><ul>${list(job.gaps)}</ul></section>
      <section class="detail-section"><h3>Preparation package</h3><div class="prep-grid">
        <div class="prep-box"><h4>Resume emphasis</h4><ul>${list(job.prep.resume)}</ul></div>
        <div class="prep-box"><h4>Proof to assemble</h4><ul>${list(job.prep.proof)}</ul></div>
        <div class="prep-box"><h4>Technical refresh</h4><ul>${list(job.prep.refresh)}</ul></div>
        <div class="prep-box"><h4>Interview themes</h4><ul>${list(job.prep.interview)}</ul></div>
      </div></section>
      <section class="detail-section"><h3>My next action</h3><ul>${list(job.prep.next)}</ul><label><span class="sr-only">Private notes</span><textarea class="notes-input" id="notes-${escapeHTML(job.id)}" placeholder="Private notes stored only in this browser">${escapeHTML(state.notes[job.id] || "")}</textarea></label><div class="dialog-actions"><a class="button" href="${escapeHTML(job.applyUrl)}" target="_blank" rel="noopener noreferrer">Open application</a><a class="button button-quiet" href="${escapeHTML(job.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source</a><button class="save-button ${state.saved.has(job.id) ? "is-saved" : ""}" type="button" id="dialog-save">${state.saved.has(job.id) ? "Saved" : "Save job"}</button></div><p class="source-line">Source: <a href="${escapeHTML(job.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(job.sourceLabel)}</a>. Last checked ${escapeHTML(job.lastVerified)}. ${escapeHTML(job.sourceNote || "")}</p></section>`;
    $("#job-dialog").showModal();
    $("#dialog-save").addEventListener("click", () => {
      if (state.saved.has(job.id)) state.saved.delete(job.id); else state.saved.add(job.id);
      saveLocalState();
      openDialog(job.id);
      render();
    });
    $("#notes-" + job.id).addEventListener("input", (event) => {
      state.notes[job.id] = event.target.value;
      saveLocalState();
    });
  }

  function exportSaved() {
    const rows = state.jobs.filter((job) => state.saved.has(job.id));
    const header = ["Company", "Title", "Location", "Fit score", "Eligibility", "Status", "Apply URL", "Source URL"];
    const csv = [header, ...rows.map((job) => [job.company, job.title, job.location, job.fitScore, job.eligibility, job.status, job.applyUrl, job.sourceUrl])]
      .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "rwego-saved-jobs.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function bindControls() {
    ["#search-input", "#status-filter", "#location-filter", "#family-filter", "#eligibility-filter"].forEach((selector) => $(selector).addEventListener("input", render));
    document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
      state.view = button.dataset.view;
      document.querySelectorAll("[data-view]").forEach((candidate) => candidate.classList.toggle("is-selected", candidate === button));
      if (state.view === "saved") $("#status-filter").value = "all";
      render();
    }));
    $("#export-button").addEventListener("click", exportSaved);
    $("#close-dialog").addEventListener("click", () => $("#job-dialog").close());
    $("#job-dialog").addEventListener("click", (event) => { if (event.target === $("#job-dialog")) $("#job-dialog").close(); });
  }

  async function init() {
    loadLocalState();
    bindControls();
    try {
      const response = await fetch("data/jobs.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const dataset = await response.json();
      state.jobs = dataset.jobs || [];
      $("#verified-date").textContent = dataset.verifiedAt || "latest source check";
      render();
    } catch (error) {
      $("#job-list").innerHTML = `<div class="empty-state"><h3>Could not load the job dataset.</h3><p>Check that the site is being served from the repository root and that <code>data/jobs.json</code> is available.</p></div>`;
      console.error(error);
    }
  }

  init();
}());
