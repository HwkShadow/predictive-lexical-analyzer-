/**
 * PLSB Interactive Presentation Dashboard — Client Application
 * Communicates with dashboard/server.py and renders interactive charts and inspectors.
 */

// Global State
const state = {
    datasets: [],
    selectedDataset: "tests/fixtures/stress_long_tokens.c",
    selectedBufferSize: 32,
    selectedBaselineCap: 16,
    selectedRule: "max",
    selectedAlpha: 0.20,
    activeChartTab: "reallocs",
    benchmarkResults: null,
    latestRunData: null,
    tokensBaseline: [],
    tokensPlsb: [],
    presentationMode: false,
    chartInstance: null
};

// DOM References
const elements = {
    selectDataset: document.getElementById("selectDataset"),
    selectBufferSize: document.getElementById("selectBufferSize"),
    selectBaselineCap: document.getElementById("selectBaselineCap"),
    selectRule: document.getElementById("selectRule"),
    sliderAlpha: document.getElementById("sliderAlpha"),
    valAlpha: document.getElementById("valAlpha"),
    datasetSizeBadge: document.getElementById("datasetSizeBadge"),
    datasetDesc: document.getElementById("datasetDesc"),
    terminalLog: document.getElementById("terminalLog"),
    statusBadge: document.getElementById("statusBadge"),
    oracleBadge: document.getElementById("oracleBadge"),
    btnRunSingle: document.getElementById("btnRunSingle"),
    btnRunQuickBench: document.getElementById("btnRunQuickBench"),
    btnRunFullBench: document.getElementById("btnRunFullBench"),
    btnPresentationMode: document.getElementById("btnPresentationMode"),
    btnExportJson: document.getElementById("btnExportJson"),
    btnExportCsv: document.getElementById("btnExportCsv"),
    btnViewSource: document.getElementById("btnViewSource"),
    btnCustomCode: document.getElementById("btnCustomCode"),
    btnRefreshResults: document.getElementById("btnRefreshResults"),
    tokenSearchInput: document.getElementById("tokenSearchInput"),
    tokenFilterClass: document.getElementById("tokenFilterClass"),
    tokensBaselineContainer: document.getElementById("tokensBaselineContainer"),
    tokensPlsbContainer: document.getElementById("tokensPlsbContainer"),
    markovGrid: document.getElementById("markovGrid"),
    mainChartCanvas: document.getElementById("mainChartCanvas"),
    sourceModal: document.getElementById("sourceModal"),
    sourceModalTitle: document.getElementById("sourceModalTitle"),
    sourceModalContent: document.getElementById("sourceModalContent"),
    btnCloseSourceModal: document.getElementById("btnCloseSourceModal"),
    customModal: document.getElementById("customModal"),
    customCodeTextarea: document.getElementById("customCodeTextarea"),
    btnCloseCustomModal: document.getElementById("btnCloseCustomModal"),
    btnCancelCustom: document.getElementById("btnCancelCustom"),
    btnSubmitCustom: document.getElementById("btnSubmitCustom"),
    resultsTableBody: document.getElementById("resultsTableBody"),
    estimatorTableBody: document.getElementById("estimatorTableBody")
};

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    initEventListeners();
    fetchDatasets();
    fetchLatestResults();
    renderMarkovGrid();
});

// Event Listeners
function initEventListeners() {
    // Inputs
    elements.selectDataset.addEventListener("change", (e) => {
        state.selectedDataset = e.target.value;
        updateDatasetInfo();
    });

    elements.selectBufferSize.addEventListener("change", (e) => {
        state.selectedBufferSize = parseInt(e.target.value, 10);
    });

    elements.selectBaselineCap.addEventListener("change", (e) => {
        state.selectedBaselineCap = parseInt(e.target.value, 10);
    });

    elements.selectRule.addEventListener("change", (e) => {
        state.selectedRule = e.target.value;
    });

    elements.sliderAlpha.addEventListener("input", (e) => {
        state.selectedAlpha = parseFloat(e.target.value);
        elements.valAlpha.textContent = state.selectedAlpha.toFixed(2);
    });

    // Action Buttons
    elements.btnRunSingle.addEventListener("click", runSingleAnalysis);
    elements.btnRunQuickBench.addEventListener("click", () => runBenchmark(true, false));
    elements.btnRunFullBench.addEventListener("click", () => runBenchmark(false, true));

    // Presentation Mode Toggle
    elements.btnPresentationMode.addEventListener("click", togglePresentationMode);

    // Export Buttons
    elements.btnExportJson.addEventListener("click", exportLatestJson);
    elements.btnExportCsv.addEventListener("click", exportLatestCsv);

    // Modals
    elements.btnViewSource.addEventListener("click", openSourceModal);
    elements.btnCloseSourceModal.addEventListener("click", () => elements.sourceModal.style.display = "none");
    elements.btnCustomCode.addEventListener("click", () => elements.customModal.style.display = "flex");
    elements.btnCloseCustomModal.addEventListener("click", () => elements.customModal.style.display = "none");
    elements.btnCancelCustom.addEventListener("click", () => elements.customModal.style.display = "none");
    elements.btnSubmitCustom.addEventListener("click", submitCustomCode);

    // Results Refresh
    elements.btnRefreshResults.addEventListener("click", fetchResultsList);

    // Token Filters
    elements.tokenSearchInput.addEventListener("input", renderTokenStreams);
    elements.tokenFilterClass.addEventListener("change", renderTokenStreams);

    // Chart Tabs
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            state.activeChartTab = e.target.dataset.chart;
            renderChart();
        });
    });
}

// Log to Terminal Window
function logTerminal(msg) {
    const time = new Date().toLocaleTimeString();
    elements.terminalLog.textContent += `\n[${time}] ${msg}`;
    elements.terminalLog.scrollTop = elements.terminalLog.scrollHeight;
}

// Presentation Mode Toggle
function togglePresentationMode() {
    state.presentationMode = !state.presentationMode;
    document.body.classList.toggle("presentation-mode", state.presentationMode);
    elements.btnPresentationMode.innerHTML = state.presentationMode 
        ? "<span>🖥 Exit Presentation</span>" 
        : "<span>📺 Presentation Mode</span>";
    if (state.chartInstance) {
        state.chartInstance.resize();
    }
}

// Fetch Datasets from Server
async function fetchDatasets() {
    try {
        const res = await fetch("/api/datasets");
        if (res.ok) {
            state.datasets = await res.json();
            updateDatasetInfo();
        }
    } catch (err) {
        console.warn("Using default dataset metadata", err);
    }
}

function updateDatasetInfo() {
    const d = state.datasets.find(item => item.path === state.selectedDataset);
    if (d) {
        elements.datasetSizeBadge.textContent = `${(d.size_bytes / 1024).toFixed(1)} KB`;
        elements.datasetDesc.textContent = d.description || "";
    }
}

// Open Source Modal
async function openSourceModal() {
    try {
        const res = await fetch(`/api/dataset?path=${encodeURIComponent(state.selectedDataset)}`);
        if (res.ok) {
            const data = await res.json();
            elements.sourceModalTitle.textContent = `Source Code: ${data.path} (${data.size_bytes} bytes)`;
            elements.sourceModalContent.textContent = data.content;
            elements.sourceModal.style.display = "flex";
        }
    } catch (err) {
        alert("Failed to load source file: " + err.message);
    }
}

// Submit Custom C Code
async function submitCustomCode() {
    const code = elements.customCodeTextarea.value;
    if (!code.trim()) return;
    try {
        const res = await fetch("/api/custom-dataset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: code })
        });
        if (res.ok) {
            const data = await res.json();
            elements.customModal.style.display = "none";
            logTerminal(`Custom code saved to ${data.path} (${data.size_bytes} bytes).`);
            state.selectedDataset = data.path;
            runSingleAnalysis();
        }
    } catch (err) {
        alert("Failed to submit custom code: " + err.message);
    }
}

// Run Single Comparison Analysis
async function runSingleAnalysis() {
    setStatus("Running C Analysis...", "amber");
    logTerminal(`Executing plsb_lexer --mode compare --buffer-size ${state.selectedBufferSize} --rule ${state.selectedRule}...`);

    try {
        const res = await fetch("/api/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                dataset: state.selectedDataset,
                buffer_size: state.selectedBufferSize,
                baseline_cap: state.selectedBaselineCap,
                rule: state.selectedRule,
                alpha: state.selectedAlpha,
                mode: "compare"
            })
        });

        const data = await res.json();
        if (data.error || !data.success) {
            const errMsg = data.error || data.stderr || (data.returncode !== undefined ? `Exit code ${data.returncode}` : "Execution failed");
            logTerminal(`ERROR: ${errMsg}`);
            setStatus("Analysis Failed", "rose");
            elements.oracleBadge.className = "badge badge-rose";
            elements.oracleBadge.textContent = "✗ Analysis Failed";
            state.latestRunData = null;
            state.tokensBaseline = [];
            state.tokensPlsb = [];
            resetComparisonMetrics();
            renderTokenStreams();
            return;
        }

        state.latestRunData = data;
        state.tokensBaseline = data.tokens_baseline || [];
        state.tokensPlsb = data.tokens_plsb || [];

        logTerminal(`C Engine Execution Succeeded (Exit 0). Equivalence verified.`);
        setStatus("Analysis Complete", "green");
        elements.oracleBadge.className = "badge badge-green";
        elements.oracleBadge.textContent = "✓ Equivalence Oracle 100% Passed";

        updateComparisonMetrics(data.report);
        renderTokenStreams();
    } catch (err) {
        logTerminal(`Connection error: ${err.message}`);
        setStatus("Connection Error", "rose");
        elements.oracleBadge.className = "badge badge-rose";
        elements.oracleBadge.textContent = "✗ Connection Error";
        state.latestRunData = null;
        state.tokensBaseline = [];
        state.tokensPlsb = [];
        resetComparisonMetrics();
        renderTokenStreams();
    }
}

function resetComparisonMetrics() {
    const fields = [
        "tblTokBase", "tblTokPlsb",
        "tblSpillBase", "tblSpillPlsb",
        "tblReallocBase", "tblReallocPlsb",
        "tblCopyBase", "tblCopyPlsb",
        "tblPeakBase", "tblPeakPlsb",
        "tblOverPlsb",
        "tblTimeBase", "tblTimePlsb",
        "tblTpBase", "tblTpPlsb"
    ];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = "N/A";
    });
    if (elements.kpiReallocSaved) elements.kpiReallocSaved.textContent = "N/A";
    if (elements.kpiCopySaved) elements.kpiCopySaved.textContent = "N/A";
    if (elements.kpiHitRate) elements.kpiHitRate.textContent = "N/A";
    const deltaR = document.getElementById("deltaReallocBadge");
    if (deltaR) { deltaR.textContent = "N/A"; deltaR.className = "badge badge-blue"; }
    const deltaC = document.getElementById("deltaCopyBadge");
    if (deltaC) { deltaC.textContent = "N/A"; deltaC.className = "badge badge-blue"; }
    const kpiR = document.getElementById("kpiReallocDelta");
    if (kpiR) kpiR.textContent = "N/A";
    const kpiC = document.getElementById("kpiCopyDelta");
    if (kpiC) kpiC.textContent = "N/A";
    if (elements.estimatorTableBody) {
        elements.estimatorTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-secondary);">No active analysis data</td></tr>';
    }
}

// Run Benchmark (Quick / Full)
async function runBenchmark(quick = true, full = false) {
    const label = full ? "Full Matrix (All Datasets & Sizes)" : `Quick Matrix (${state.selectedDataset})`;
    setStatus(`Executing Benchmark: ${label}...`, "amber");
    logTerminal(`Launching benchmark_runner.exe (${label})...`);

    try {
        const res = await fetch("/api/benchmark", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                dataset: full ? null : state.selectedDataset,
                all_datasets: full,
                quick: quick,
                full: full,
                iterations: quick ? 3 : 5
            })
        });

        const data = await res.json();
        if (!data.success || data.error) {
            const errDetail = data.error || data.stderr || (data.returncode !== undefined ? `Exit code ${data.returncode}` : "Execution failed");
            logTerminal(`[BENCHMARK ERROR] ${errDetail}`);
            setStatus("Benchmark Failed", "rose");
            alert(`Benchmark execution failed:\n\n${errDetail}`);
            return;
        }

        logTerminal(`Benchmark run complete (Exit 0). Received fresh experiment matrix.`);
        setStatus("Benchmark Completed", "green");

        if (data.data) {
            state.benchmarkResults = data.data;
            renderChart();
            fetchResultsList();
        }
    } catch (err) {
        logTerminal(`Benchmark error: ${err.message}`);
        setStatus("Benchmark Error", "rose");
    }
}

// Fetch Latest Saved Benchmark Results
async function fetchLatestResults() {
    try {
        const res = await fetch("/api/results/latest");
        if (res.ok) {
            state.benchmarkResults = await res.json();
            renderChart();
            fetchResultsList();
        }
    } catch (err) {
        console.warn("No previous results found", err);
    }
}

// Fetch Artifacts List
async function fetchResultsList() {
    try {
        const res = await fetch("/api/results");
        if (res.ok) {
            const files = await res.json();
            renderResultsTable(files);
        }
    } catch (err) {
        console.warn("Could not fetch results list", err);
    }
}

function renderResultsTable(files) {
    elements.resultsTableBody.innerHTML = "";
    files.forEach(f => {
        const tr = document.createElement("tr");
        const dateStr = new Date(f.mtime * 1000).toLocaleString();
        tr.innerHTML = `
            <td><strong>${f.name}</strong></td>
            <td>${f.type.toUpperCase()}</td>
            <td>${(f.size_bytes / 1024).toFixed(1)} KB</td>
            <td>${dateStr}</td>
            <td>
                <a href="/api/results/file?name=${encodeURIComponent(f.name)}" target="_blank" class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; text-decoration: none;">View / Download</a>
            </td>
        `;
        elements.resultsTableBody.appendChild(tr);
    });
}

function setStatus(text, color) {
    elements.statusBadge.className = `badge badge-${color}`;
    elements.statusBadge.textContent = text;
}

// Update Comparison Metrics in Table and KPIs
function updateComparisonMetrics(report) {
    if (!report) return;

    const base = report.baseline || {};
    const plsb = report.plsb || {};
    const cmp = report.comparison || {};

    // Elements
    document.getElementById("tblTokBase").textContent = base.total_tokens !== undefined ? base.total_tokens : "N/A";
    document.getElementById("tblTokPlsb").textContent = plsb.total_tokens !== undefined ? plsb.total_tokens : "N/A";

    document.getElementById("tblSpillBase").textContent = base.lexeme_spill_events !== undefined ? base.lexeme_spill_events : "N/A";
    document.getElementById("tblSpillPlsb").textContent = plsb.lexeme_spill_events !== undefined ? plsb.lexeme_spill_events : "N/A";

    document.getElementById("tblAllocBase").textContent = base.spill_allocations !== undefined ? base.spill_allocations : "N/A";
    document.getElementById("tblAllocPlsb").textContent = plsb.spill_allocations !== undefined ? plsb.spill_allocations : "N/A";

    const rBase = base.spill_reallocations;
    const rPlsb = plsb.spill_reallocations;
    document.getElementById("tblReallocBase").textContent = rBase !== undefined ? rBase : "N/A";
    document.getElementById("tblReallocPlsb").textContent = rPlsb !== undefined ? rPlsb : "N/A";
    elements.kpiReallocs.textContent = rPlsb !== undefined ? rPlsb : "N/A";
    
    if (rBase !== undefined && rPlsb !== undefined && rBase > 0) {
        const rDeltaPct = ((rBase - rPlsb) / rBase * 100);
        const rSign = rDeltaPct >= 0 ? "↓" : "↑";
        const rClass = rDeltaPct >= 0 ? "badge badge-green" : "badge badge-rose";
        const deltaText = `${rSign} ${Math.abs(rDeltaPct).toFixed(1)}%`;
        document.getElementById("deltaReallocBadge").textContent = deltaText;
        document.getElementById("deltaReallocBadge").className = rClass;
        document.getElementById("kpiReallocDelta").textContent = `${deltaText} vs Baseline (${rBase})`;
    } else {
        document.getElementById("deltaReallocBadge").textContent = "N/A";
        document.getElementById("deltaReallocBadge").className = "badge badge-blue";
        document.getElementById("kpiReallocDelta").textContent = "N/A";
    }

    const cBase = base.growth_copy_bytes;
    const cPlsb = plsb.growth_copy_bytes;
    document.getElementById("tblCopyBase").textContent = cBase !== undefined ? `${cBase} bytes` : "N/A";
    document.getElementById("tblCopyPlsb").textContent = cPlsb !== undefined ? `${cPlsb} bytes` : "N/A";
    elements.kpiCopyBytes.textContent = cPlsb !== undefined ? `${cPlsb} B` : "N/A";
    
    if (cBase !== undefined && cPlsb !== undefined && cBase > 0) {
        const cDeltaPct = ((cBase - cPlsb) / cBase * 100);
        const cSign = cDeltaPct >= 0 ? "↓" : "↑";
        const cClass = cDeltaPct >= 0 ? "badge badge-green" : "badge badge-rose";
        const deltaText = `${cSign} ${Math.abs(cDeltaPct).toFixed(1)}%`;
        document.getElementById("deltaCopyBadge").textContent = deltaText;
        document.getElementById("deltaCopyBadge").className = cClass;
        document.getElementById("kpiCopyDelta").textContent = `${deltaText} vs Baseline (${cBase} B)`;
    } else {
        document.getElementById("deltaCopyBadge").textContent = "N/A";
        document.getElementById("deltaCopyBadge").className = "badge badge-blue";
        document.getElementById("kpiCopyDelta").textContent = "N/A";
    }

    const pBase = base.peak_spill_capacity;
    const pPlsb = plsb.peak_spill_capacity;
    document.getElementById("tblPeakBase").textContent = pBase !== undefined ? `${pBase} bytes` : "N/A";
    document.getElementById("tblPeakPlsb").textContent = pPlsb !== undefined ? `${pPlsb} bytes` : "N/A";

    const oPlsb = plsb.over_reservation_bytes;
    document.getElementById("tblOverPlsb").textContent = oPlsb !== undefined ? `${oPlsb} bytes` : "N/A";

    const tBase = base.wall_time_seconds !== undefined ? ((base.wall_time_seconds) * 1000).toFixed(3) + " ms" : "N/A";
    const tPlsb = plsb.wall_time_seconds !== undefined ? ((plsb.wall_time_seconds) * 1000).toFixed(3) + " ms" : "N/A";
    document.getElementById("tblTimeBase").textContent = tBase;
    document.getElementById("tblTimePlsb").textContent = tPlsb;

    const tpBase = base.tokens_per_second !== undefined ? (base.tokens_per_second / 1000).toFixed(1) + " kTok/s" : "N/A";
    const tpPlsb = plsb.tokens_per_second !== undefined ? (plsb.tokens_per_second / 1000).toFixed(1) + " kTok/s" : "N/A";
    document.getElementById("tblTpBase").textContent = tpBase;
    document.getElementById("tblTpPlsb").textContent = tpPlsb;

    // Hit Rate KPI
    const hits = plsb.prediction_hits;
    const misses = plsb.prediction_misses;
    if (hits !== undefined && misses !== undefined && (hits + misses) > 0) {
        const hitPct = (hits / (hits + misses) * 100).toFixed(1);
        elements.kpiHitRate.textContent = `${hitPct}%`;
    } else {
        elements.kpiHitRate.textContent = "N/A";
    }

    // Update Token Class Estimator Table
    if (plsb.class_distributions) {
        updateEstimatorTable(plsb.class_distributions);
    } else {
        elements.estimatorTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-secondary);">No per-class distribution data in single comparison output</td></tr>';
    }
}

function updateEstimatorTable(classes) {
    elements.estimatorTableBody.innerHTML = "";
    for (const [clsName, c] of Object.entries(classes)) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${clsName}</strong></td>
            <td>${c.count || 0}</td>
            <td>${c.min_len || 0}</td>
            <td><strong style="color: var(--accent-blue);">${c.p75_len || 0}</strong></td>
            <td>${(c.ewma_len || 0).toFixed(1)}</td>
            <td>${c.max_len || 0}</td>
        `;
        elements.estimatorTableBody.appendChild(tr);
    }
}

// Render Token Stream Inspector
function renderTokenStreams() {
    const search = elements.tokenSearchInput.value.toLowerCase().trim();
    const filterClass = elements.tokenFilterClass.value;

    function filterTok(t) {
        if (search && !t.lexeme.toLowerCase().includes(search) && !t.type.toLowerCase().includes(search)) {
            return false;
        }
        if (filterClass !== "all") {
            if (filterClass === "IDENTIFIER" && t.type !== "IDENTIFIER") return false;
            if (filterClass === "COMMENT" && t.type !== "COMMENT") return false;
            if (filterClass === "STRING" && t.type !== "STRING_LITERAL") return false;
            if (filterClass === "NUMBER" && !t.type.includes("LITERAL")) return false;
            if (filterClass === "OPERATOR" && !t.type.startsWith("OP_")) return false;
        }
        return true;
    }

    renderTokenList(elements.tokensBaselineContainer, state.tokensBaseline.filter(filterTok));
    renderTokenList(elements.tokensPlsbContainer, state.tokensPlsb.filter(filterTok));
}

function renderTokenList(container, tokens) {
    if (!tokens || tokens.length === 0) {
        container.innerHTML = `<div style="color: var(--text-muted); padding: 1rem; text-align: center;">No matching tokens found.</div>`;
        return;
    }

    container.innerHTML = "";
    tokens.slice(0, 150).forEach(tok => {
        const row = document.createElement("div");
        row.className = `token-row ${tok.spilled ? "spilled" : ""}`;
        
        let typeClass = "type-punct";
        if (tok.type.startsWith("KW_")) typeClass = "type-kw";
        else if (tok.type === "IDENTIFIER") typeClass = "type-id";
        else if (tok.type.includes("INT") || tok.type.includes("FLOAT")) typeClass = "type-num";
        else if (tok.type.includes("STRING") || tok.type.includes("CHAR")) typeClass = "type-str";
        else if (tok.type.includes("COMMENT")) typeClass = "type-com";
        else if (tok.type.startsWith("OP_")) typeClass = "type-op";

        row.innerHTML = `
            <span class="token-loc">${tok.line}:${tok.col}</span>
            <span class="token-type-pill ${typeClass}">${tok.type}</span>
            <span class="token-lexeme" title="${escapeHtml(tok.lexeme)}">'${escapeHtml(tok.lexeme)}'</span>
            ${tok.spilled ? '<span class="badge badge-amber" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">SPILLED</span>' : ''}
            <span style="font-size: 0.7rem; color: var(--text-muted);">${tok.length}B</span>
        `;
        container.appendChild(row);
    });

    if (tokens.length > 150) {
        const note = document.createElement("div");
        note.style.textAlign = "center";
        note.style.color = "var(--text-muted)";
        note.style.fontSize = "0.75rem";
        note.style.padding = "0.5rem";
        note.textContent = `Showing 150 of ${tokens.length} tokens. Use search/filter to inspect more.`;
        container.appendChild(note);
    }
}

function escapeHtml(str) {
    return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Render Markov Transition Heatmap
function renderMarkovGrid() {
    const classes = ["KW", "ID", "INT", "FLT", "STR", "CHR", "COM", "OP", "PUN"];
    const matrix = [
        [0.05, 0.65, 0.02, 0.01, 0.05, 0.01, 0.01, 0.10, 0.10],
        [0.02, 0.05, 0.05, 0.01, 0.02, 0.01, 0.04, 0.45, 0.35],
        [0.01, 0.02, 0.01, 0.00, 0.01, 0.00, 0.05, 0.50, 0.40],
        [0.01, 0.02, 0.01, 0.00, 0.01, 0.00, 0.05, 0.50, 0.40],
        [0.01, 0.02, 0.01, 0.00, 0.02, 0.00, 0.04, 0.20, 0.70],
        [0.01, 0.02, 0.01, 0.00, 0.01, 0.00, 0.04, 0.20, 0.71],
        [0.20, 0.35, 0.05, 0.01, 0.05, 0.01, 0.05, 0.15, 0.13],
        [0.10, 0.45, 0.25, 0.05, 0.10, 0.02, 0.01, 0.01, 0.01],
        [0.25, 0.40, 0.10, 0.02, 0.10, 0.01, 0.02, 0.05, 0.05]
    ];

    elements.markovGrid.innerHTML = "";
    
    // Top-left corner
    const corner = document.createElement("div");
    corner.className = "markov-cell markov-header";
    corner.textContent = "C(t-1)\\C(t)";
    elements.markovGrid.appendChild(corner);

    // Header Row
    classes.forEach(c => {
        const h = document.createElement("div");
        h.className = "markov-cell markov-header";
        h.textContent = c;
        elements.markovGrid.appendChild(h);
    });

    // Rows
    for (let r = 0; r < classes.length; ++r) {
        const rowH = document.createElement("div");
        rowH.className = "markov-cell markov-header";
        rowH.textContent = classes[r];
        elements.markovGrid.appendChild(rowH);

        for (let c = 0; c < classes.length; ++c) {
            const prob = matrix[r][c];
            const cell = document.createElement("div");
            cell.className = "markov-cell";
            const alpha = Math.min(1, prob * 1.8);
            cell.style.backgroundColor = `rgba(56, 189, 248, ${alpha})`;
            cell.style.color = (alpha > 0.4) ? "#0f172a" : "#f8fafc";
            cell.textContent = prob.toFixed(2);
            cell.title = `P(${classes[c]} | ${classes[r]}) = ${(prob * 100).toFixed(1)}%`;
            elements.markovGrid.appendChild(cell);
        }
    }
}

// Interactive Chart.js Visualizer
function renderChart() {
    if (!window.Chart) {
        console.warn("Chart.js library not loaded yet.");
        return;
    }

    if (state.chartInstance) {
        state.chartInstance.destroy();
    }

    const ctx = elements.mainChartCanvas.getContext("2d");
    const results = (state.benchmarkResults && state.benchmarkResults.results) ? state.benchmarkResults.results : [];

    if (state.activeChartTab === "reallocs") {
        renderReallocsChart(ctx, results);
    } else if (state.activeChartTab === "copybytes") {
        renderCopyBytesChart(ctx, results);
    } else if (state.activeChartTab === "throughput") {
        renderThroughputChart(ctx, results);
    } else if (state.activeChartTab === "tokenlens") {
        renderTokenLengthsChart(ctx);
    }
}

function renderReallocsChart(ctx, results) {
    const targetDs = state.selectedDataset.split("/").pop();
    const bufferSizes = [16, 32, 64, 256, 1024, 4096, 16384];

    if (!results || results.length === 0) {
        state.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels: ['No Benchmark Data Loaded'], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'No Benchmark Results Available — Run Benchmark First', color: '#94a3b8' }
                }
            }
        });
        return;
    }

    function getMetric(policyId, bSize) {
        const match = results.find(r => r.dataset.includes(targetDs) && 
                                        r.buffer_size_bytes === bSize && 
                                        r.policy_id === policyId &&
                                        r.success);
        return match ? match.reallocations.mean : null;
    }

    state.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: bufferSizes.map(b => `${b} B`),
            datasets: [
                {
                    label: 'Baseline (16B Init)',
                    data: bufferSizes.map(b => getMetric("base16", b)),
                    backgroundColor: 'rgba(244, 63, 94, 0.75)',
                    borderColor: '#f43f5e',
                    borderWidth: 1
                },
                {
                    label: 'Baseline (32B Init)',
                    data: bufferSizes.map(b => getMetric("base32", b)),
                    backgroundColor: 'rgba(251, 191, 36, 0.75)',
                    borderColor: '#fbbf24',
                    borderWidth: 1
                },
                {
                    label: 'PLSB (Max P75+EWMA)',
                    data: bufferSizes.map(b => getMetric("max", b)),
                    backgroundColor: 'rgba(56, 189, 248, 0.85)',
                    borderColor: '#38bdf8',
                    borderWidth: 1
                },
                {
                    label: 'PLSB (Markov-Conditioned)',
                    data: bufferSizes.map(b => getMetric("markov", b)),
                    backgroundColor: 'rgba(52, 211, 153, 0.85)',
                    borderColor: '#34d399',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Spill Buffer Reallocations by Buffer Size — Measured Data (${targetDs})`,
                    color: '#f8fafc',
                    font: { size: 14, weight: 'bold' }
                },
                legend: { labels: { color: '#94a3b8' } }
            },
            scales: {
                x: {
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' },
                    title: { display: true, text: 'Input Buffer Size (B)', color: '#94a3b8' }
                },
                y: {
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' },
                    title: { display: true, text: 'Mean Reallocations', color: '#94a3b8' }
                }
            }
        }
    });
}

function renderCopyBytesChart(ctx, results) {
    const bufferSizes = [16, 32, 64, 256, 1024, 4096, 16384];
    const targetDs = state.selectedDataset.split("/").pop();

    if (!results || results.length === 0) {
        state.chartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: ['No Benchmark Data Loaded'], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'No Benchmark Results Available — Run Benchmark First', color: '#94a3b8' }
                }
            }
        });
        return;
    }

    function getCopy(policyId, bSize) {
        const match = results.find(r => r.dataset.includes(targetDs) && 
                                        r.buffer_size_bytes === bSize && 
                                        r.policy_id === policyId &&
                                        r.success);
        return match ? match.copy_bytes.mean : null;
    }

    state.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: bufferSizes.map(b => `${b} B`),
            datasets: [
                {
                    label: 'Baseline (16B Init) Copy Bytes',
                    data: bufferSizes.map(b => getCopy("base16", b)),
                    borderColor: '#f43f5e',
                    backgroundColor: 'rgba(244, 63, 94, 0.2)',
                    tension: 0.2,
                    fill: true
                },
                {
                    label: 'PLSB (Max P75+EWMA) Copy Bytes',
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.2)',
                    tension: 0.2,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Cumulative Growth-Copy Overhead (Bytes Moved in Memory) — Measured Data (${targetDs})`,
                    color: '#f8fafc',
                    font: { size: 14, weight: 'bold' }
                },
                legend: { labels: { color: '#94a3b8' } }
            },
            scales: {
                x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' }, title: { display: true, text: 'Copy Bytes (B)', color: '#94a3b8' } }
            }
        }
    });
}

function renderThroughputChart(ctx, results) {
    const targetDs = state.selectedDataset.split("/").pop();
    const targetBuf = state.selectedBufferSize;

    const policies = [
        { id: "base16", name: "Baseline 16B", color: 'rgba(244, 63, 94, 0.7)' },
        { id: "base32", name: "Baseline 32B", color: 'rgba(251, 191, 36, 0.7)' },
        { id: "p75",    name: "PLSB P75",     color: 'rgba(192, 132, 252, 0.7)' },
        { id: "ewma",   name: "PLSB EWMA",    color: 'rgba(56, 189, 248, 0.7)' },
        { id: "max",    name: "PLSB Max",     color: 'rgba(52, 211, 153, 0.85)' },
        { id: "markov", name: "PLSB Markov",  color: 'rgba(16, 185, 129, 0.85)' }
    ];

    const labels = [];
    const throughputs = [];
    const bgColors = [];

    if (results && results.length > 0) {
        policies.forEach(p => {
            const match = results.find(r => r.dataset.includes(targetDs) &&
                                            r.buffer_size_bytes === targetBuf &&
                                            r.policy_id === p.id &&
                                            r.success);
            if (match && match.throughput_ktok_s) {
                labels.push(p.name);
                throughputs.push(match.throughput_ktok_s.mean);
                bgColors.push(p.color);
            }
        });
    }

    if (labels.length === 0) {
        state.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels: [`No data for ${targetDs} at B=${targetBuf}B`], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: `Token Throughput — No Measured Data for B=${targetBuf}B`, color: '#94a3b8' }
                }
            }
        });
        return;
    }

    state.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Token Throughput (kTokens / second)',
                data: throughputs,
                backgroundColor: bgColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Token Throughput Comparison (kTokens / sec) — Measured at B=${targetBuf}B (${targetDs})`,
                    color: '#f8fafc',
                    font: { size: 14, weight: 'bold' }
                },
                legend: { display: false }
            },
            scales: {
                x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' }, title: { display: true, text: 'kTokens / sec', color: '#94a3b8' } }
            }
        }
    });
}

function renderTokenLengthsChart(ctx) {
    const distributions = state.latestRunData?.report?.plsb?.class_distributions;

    if (!distributions || Object.keys(distributions).length === 0) {
        state.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels: ['No Single Comparison Run Loaded'], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Token Class Length Profile — Run Single Comparison First to Populate Distributions', color: '#94a3b8' }
                }
            }
        });
        return;
    }

    const classes = Object.keys(distributions);
    const meanVals = classes.map(c => distributions[c].ewma_len || 0);
    const p75Vals = classes.map(c => distributions[c].p75_len || 0);
    const maxVals = classes.map(c => distributions[c].max_len || 0);

    state.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: classes,
            datasets: [
                {
                    label: 'EWMA Mean Length',
                    data: meanVals,
                    backgroundColor: 'rgba(56, 189, 248, 0.6)'
                },
                {
                    label: 'P75 Estimate',
                    data: p75Vals,
                    backgroundColor: 'rgba(52, 211, 153, 0.8)'
                },
                {
                    label: 'Max Observed Length',
                    data: maxVals,
                    backgroundColor: 'rgba(251, 191, 36, 0.8)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Token Class Length Profile (Bytes) — Measured Online Invariants',
                    color: '#f8fafc',
                    font: { size: 14, weight: 'bold' }
                },
                legend: { labels: { color: '#94a3b8' } }
            },
            scales: {
                x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' }, title: { display: true, text: 'Bytes', color: '#94a3b8' } }
            }
    });
}

// Export Latest Results to JSON/CSV
function exportLatestJson() {
    window.open("/api/results/latest", "_blank");
}

function exportLatestCsv() {
    window.open("/api/results/file?name=benchmark_summary.csv", "_blank");
}
