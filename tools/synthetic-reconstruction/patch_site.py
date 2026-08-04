from __future__ import annotations

import argparse
from pathlib import Path


JS_MARKER = "// synthetic-reconstruction-tab-v1"
CSS_MARKER = "/* synthetic-reconstruction-tab-v1 */"


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-root", required=True, type=Path)
    return parser.parse_args()


def main() -> int:
    site = parse_args().site_root.resolve()
    app_path = site / "app.js"
    styles_path = site / "styles.css"

    app = app_path.read_text(encoding="utf-8-sig")
    styles = styles_path.read_text(encoding="utf-8-sig")

    if JS_MARKER not in app:
        app += r'''

// synthetic-reconstruction-tab-v1

function initializeSyntheticReconstructionTab(attempt = 0) {
    if (document.getElementById("synthetic-reconstruction-panel")) {
        return;
    }

    const workspace = document.querySelector(
        "#full-recording .lab-workspace"
    );
    const tabList = workspace?.querySelector(".lab-tab-list");

    if (!workspace || !tabList) {
        if (attempt < 50) {
            window.setTimeout(
                () => initializeSyntheticReconstructionTab(attempt + 1),
                100
            );
        }
        return;
    }

    const tabButton = document.createElement("button");
    tabButton.className =
        "lab-tab-button synthetic-reconstruction-tab-button";
    tabButton.type = "button";
    tabButton.setAttribute("role", "tab");
    tabButton.setAttribute(
        "aria-controls",
        "synthetic-reconstruction-panel"
    );
    tabButton.setAttribute("aria-selected", "false");
    tabButton.textContent = "Synthetic reconstruction";

    const panel = document.createElement("div");
    panel.id = "synthetic-reconstruction-panel";
    panel.className =
        "lab-tab-panel synthetic-reconstruction-lab-panel";
    panel.setAttribute("role", "tabpanel");
    panel.hidden = true;

    panel.innerHTML = `
        <section class="forensic-panel synthetic-reconstruction-card">
            <div class="forensic-panel-heading">
                <div>
                    <p class="eyebrow">Model-generated interpretation</p>
                    <h3>Synthetic reconstruction — not evidence</h3>
                </div>
                <output
                    id="synthetic-reconstruction-state"
                    class="processing-state"
                >
                    Looking for result package
                </output>
            </div>

            <div class="notice synthetic-reconstruction-warning">
                Recognition models are being asked to supply plausible complete
                wording for ambiguous speech. Generated words may be wrong or
                absent from the source. They are not restored audio, verified
                quotations, or forensic conclusions.
            </div>

            <div class="synthetic-request-grid">
                <label>
                    Start
                    <input
                        id="synthetic-request-start"
                        type="number"
                        min="0"
                        step="0.01"
                        value="0"
                    >
                </label>

                <label>
                    End
                    <input
                        id="synthetic-request-end"
                        type="number"
                        min="0.05"
                        step="0.01"
                        value="18"
                    >
                </label>

                <label>
                    Context padding
                    <input
                        id="synthetic-request-padding"
                        type="number"
                        min="0"
                        max="10"
                        step="0.25"
                        value="2"
                    >
                </label>

                <button id="synthetic-use-selection" type="button">
                    Use waveform selection
                </button>

                <button id="synthetic-first-18" type="button">
                    Use first 18 seconds
                </button>
            </div>

            <div class="synthetic-request-actions">
                <button id="synthetic-copy-command" type="button">
                    Copy full local-analysis command
                </button>

                <button id="synthetic-copy-quick-command" type="button">
                    Copy quick-test command
                </button>

                <button id="synthetic-download-request" type="button">
                    Download request JSON
                </button>

                <button id="synthetic-reload-results" type="button">
                    Reload generated results
                </button>
            </div>

            <p
                id="synthetic-command-status"
                class="muted compact-note"
            >
                GitHub Pages cannot run the local models. Copy a command,
                run it in PowerShell, then reload this tab.
            </p>

            <div
                id="synthetic-result-status"
                class="synthetic-result-status"
            >
                No result package has been loaded.
            </div>

            <div
                id="synthetic-audio-comparisons"
                class="synthetic-audio-comparisons"
                hidden
            ></div>

            <div
                id="synthetic-candidates"
                class="synthetic-candidates"
            ></div>

            <details
                id="synthetic-provenance"
                class="synthetic-provenance"
                hidden
            >
                <summary>
                    Models, decoding passes, hashes, and complete provenance
                </summary>
                <pre id="synthetic-provenance-json"></pre>
            </details>
        </section>
    `;

    workspace.append(panel);
    tabList.append(tabButton);

    const state = document.getElementById(
        "synthetic-reconstruction-state"
    );
    const requestStart = document.getElementById(
        "synthetic-request-start"
    );
    const requestEnd = document.getElementById(
        "synthetic-request-end"
    );
    const requestPadding = document.getElementById(
        "synthetic-request-padding"
    );
    const useSelection = document.getElementById(
        "synthetic-use-selection"
    );
    const first18 = document.getElementById(
        "synthetic-first-18"
    );
    const copyCommand = document.getElementById(
        "synthetic-copy-command"
    );
    const copyQuickCommand = document.getElementById(
        "synthetic-copy-quick-command"
    );
    const downloadRequest = document.getElementById(
        "synthetic-download-request"
    );
    const reloadResults = document.getElementById(
        "synthetic-reload-results"
    );
    const commandStatus = document.getElementById(
        "synthetic-command-status"
    );
    const resultStatus = document.getElementById(
        "synthetic-result-status"
    );
    const audioComparisons = document.getElementById(
        "synthetic-audio-comparisons"
    );
    const candidatesContainer = document.getElementById(
        "synthetic-candidates"
    );
    const provenance = document.getElementById(
        "synthetic-provenance"
    );
    const provenanceJson = document.getElementById(
        "synthetic-provenance-json"
    );

    let packageData = null;

    function showTab() {
        workspace
            .querySelectorAll(".lab-tab-panel")
            .forEach((otherPanel) => {
                otherPanel.hidden = true;
            });

        tabList
            .querySelectorAll(".lab-tab-button")
            .forEach((otherButton) => {
                otherButton.classList.remove("active");
                otherButton.setAttribute("aria-selected", "false");
            });

        panel.hidden = false;
        tabButton.classList.add("active");
        tabButton.setAttribute("aria-selected", "true");
    }

    tabButton.addEventListener("click", showTab);

    function requestValues() {
        let start = Number(requestStart.value);
        let end = Number(requestEnd.value);
        let padding = Number(requestPadding.value);

        start = Number.isFinite(start) ? Math.max(0, start) : 0;
        end = Number.isFinite(end)
            ? Math.max(start + 0.05, end)
            : start + 18;
        padding = Number.isFinite(padding)
            ? Math.min(Math.max(padding, 0), 10)
            : 2;

        requestStart.value = start.toFixed(2);
        requestEnd.value = end.toFixed(2);
        requestPadding.value = padding.toFixed(2);

        return { start, end, padding };
    }

    function runnerPath() {
        return (
            "C:\\dev\\Nolan_Wells\\" +
            "nolan-wells-call-audio-analysis-site\\" +
            "tools\\synthetic-reconstruction\\" +
            "RUN-SYNTHETIC-RECONSTRUCTION.ps1"
        );
    }

    function buildCommand(quick) {
        const request = requestValues();
        return (
            `& "${runnerPath()}" ` +
            `-Start ${request.start.toFixed(2)} ` +
            `-End ${request.end.toFixed(2)} ` +
            `-ContextPadding ${request.padding.toFixed(2)}` +
            `${quick ? " -Quick" : ""} ` +
            "-SkipModelFileHashes -Preview"
        );
    }

    async function copyText(text, confirmation) {
        try {
            await navigator.clipboard.writeText(text);
        }
        catch {
            const area = document.createElement("textarea");
            area.value = text;
            document.body.append(area);
            area.select();
            document.execCommand("copy");
            area.remove();
        }

        commandStatus.textContent = confirmation;
    }

    useSelection.addEventListener("click", () => {
        if (!activeRegion) {
            commandStatus.textContent =
                "Create a waveform selection first.";
            return;
        }

        requestStart.value = activeRegion.start.toFixed(2);
        requestEnd.value = activeRegion.end.toFixed(2);
        commandStatus.textContent =
            "Waveform boundaries copied into the request.";
    });

    first18.addEventListener("click", () => {
        requestStart.value = "0.00";
        requestEnd.value = "18.00";
        createSelection(0, 18, true);
        commandStatus.textContent =
            "The first 18 seconds are selected.";
    });

    copyCommand.addEventListener("click", () => {
        copyText(
            buildCommand(false),
            "Full local-analysis command copied."
        );
    });

    copyQuickCommand.addEventListener("click", () => {
        copyText(
            buildCommand(true),
            "Quick-test command copied."
        );
    });

    downloadRequest.addEventListener("click", () => {
        const request = requestValues();
        const content = {
            schema: "synthetic_reconstruction_request_v1",
            start: request.start,
            end: request.end,
            context_padding: request.padding,
            channel: 2,
            status: "Request only; no recognition has been performed."
        };

        const blob = new Blob(
            [JSON.stringify(content, null, 2) + "\n"],
            { type: "application/json" }
        );
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download =
            `synthetic-reconstruction-request-` +
            `${request.start.toFixed(2)}-` +
            `${request.end.toFixed(2)}.json`;
        link.click();

        window.setTimeout(() => {
            URL.revokeObjectURL(link.href);
        }, 1000);
    });

    function element(tag, options = {}) {
        const result = document.createElement(tag);

        if (options.className) {
            result.className = options.className;
        }
        if (options.text !== undefined) {
            result.textContent = String(options.text);
        }
        if (options.type) {
            result.type = options.type;
        }

        return result;
    }

    function speakCandidate(candidate) {
        if (!("speechSynthesis" in window)) {
            commandStatus.textContent =
                "This browser does not provide speech synthesis.";
            return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(
            `Synthetic alternative ${candidate.alternative_id}. ` +
            candidate.text
        );
        utterance.rate = 0.88;
        utterance.pitch = 1;
        utterance.volume = 0.95;

        const englishVoice = window.speechSynthesis
            .getVoices()
            .find((voice) => /^en[-_]/i.test(voice.lang));

        if (englishVoice) {
            utterance.voice = englishVoice;
        }

        window.speechSynthesis.speak(utterance);
    }

    function renderAudio(data) {
        audioComparisons.textContent = "";

        Object.entries(data.variants).forEach(
            ([variantName, variant]) => {
                const card = element("div", {
                    className: "synthetic-audio-card"
                });
                const heading = element("strong", {
                    text: variantName.replaceAll("_", " ")
                });
                const description = element("span", {
                    text: variant.description
                });
                const audio = document.createElement("audio");

                audio.controls = true;
                audio.preload = "metadata";
                audio.src = `./${variant.public_audio_path}`;

                card.append(heading, description, audio);
                audioComparisons.append(card);
            }
        );

        audioComparisons.hidden = false;
    }

    function renderCandidate(candidate) {
        const card = element("article", {
            className: "synthetic-candidate-card"
        });

        const header = element("div", {
            className: "synthetic-candidate-header"
        });
        header.append(
            element("span", {
                className: "synthetic-candidate-rank",
                text: `Alternative ${candidate.alternative_id}`
            }),
            element("span", {
                className: "synthetic-support-label",
                text: candidate.support_label
            })
        );

        const text = element("p", {
            className: "synthetic-candidate-text",
            text: candidate.text
        });

        const stats = element("div", {
            className: "synthetic-candidate-stats"
        });

        [
            ["Outputs", candidate.supporting_outputs],
            ["Raw acoustic", candidate.raw_acoustic_output_count],
            [
                "Acoustic / contextual",
                `${candidate.acoustic_output_count} / ` +
                `${candidate.contextual_output_count}`
            ],
            ["Models", candidate.supporting_models.join(", ")],
            ["Variants", candidate.supporting_variants.join(", ")],
            [
                "Best avg log score",
                candidate.best_avg_logprob.toFixed(3)
            ]
        ].forEach(([label, value]) => {
            const item = element("div");
            item.append(
                element("strong", { text: label }),
                element("span", { text: value })
            );
            stats.append(item);
        });

        const actions = element("div", {
            className: "synthetic-candidate-actions"
        });
        const speak = element("button", {
            type: "button",
            text: "Speak synthetic alternative"
        });
        const stop = element("button", {
            type: "button",
            text: "Stop synthetic speech"
        });
        const openRaw = element("button", {
            type: "button",
            text: "Open source selection"
        });

        speak.addEventListener("click", () => {
            speakCandidate(candidate);
        });

        stop.addEventListener("click", () => {
            window.speechSynthesis?.cancel();
        });

        openRaw.addEventListener("click", () => {
            createSelection(
                packageData.selection.start,
                packageData.selection.end,
                true
            );

            Array.from(
                tabList.querySelectorAll(".lab-tab-button")
            )
                .find((button) => /listen/i.test(button.textContent))
                ?.click();
        });

        actions.append(speak, stop, openRaw);

        const sources = document.createElement("details");
        sources.className = "synthetic-candidate-sources";
        const sourceSummary = document.createElement("summary");
        sourceSummary.textContent =
            "Show model-source disagreement";
        const sourceList = document.createElement("ul");

        candidate.sources.forEach((source) => {
            const item = document.createElement("li");
            item.append(
                element("strong", {
                    text:
                        `${source.model_name} · ${source.variant} · ` +
                        `${source.pass_id}`
                }),
                element("span", {
                    text:
                        `${source.lane}; avg log score ` +
                        `${source.avg_logprob.toFixed(3)}; ` +
                        `no-speech ${source.no_speech_prob.toFixed(3)}`
                }),
                element("blockquote", { text: source.text })
            );
            sourceList.append(item);
        });

        sources.append(sourceSummary, sourceList);
        card.append(header, text, stats, actions, sources);
        return card;
    }

    async function loadResults() {
        state.textContent = "Loading result package";
        resultStatus.textContent =
            "Checking assets/data/synthetic-reconstruction.json…";
        candidatesContainer.textContent = "";
        audioComparisons.hidden = true;
        provenance.hidden = true;

        try {
            const response = await fetch(
                "./assets/data/synthetic-reconstruction.json" +
                `?cache=${Date.now()}`,
                { cache: "no-store" }
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}; run the local analysis first.`
                );
            }

            const data = await response.json();

            if (
                data.schema !==
                "experimental_synthetic_reconstruction_v1"
            ) {
                throw new Error(
                    `Unexpected schema: ${data.schema}`
                );
            }

            packageData = data;
            state.textContent = "Results loaded";
            requestStart.value = data.selection.start.toFixed(2);
            requestEnd.value = data.selection.end.toFixed(2);
            requestPadding.value =
                data.selection.context_padding_requested.toFixed(2);

            resultStatus.textContent =
                `${data.candidates.length} synthetic alternative(s) ` +
                `for ${formatTime(data.selection.start)}–` +
                `${formatTime(data.selection.end)}. ` +
                "None is a verified quotation.";

            renderAudio(data);

            data.candidates.forEach((candidate) => {
                candidatesContainer.append(
                    renderCandidate(candidate)
                );
            });

            if (!data.candidates.length) {
                candidatesContainer.append(
                    element("div", {
                        className: "synthetic-empty",
                        text:
                            "No textual candidate survived grouping. " +
                            "The passage may be too weak or non-speech."
                    })
                );
            }

            provenance.hidden = false;
            provenanceJson.textContent = JSON.stringify(
                {
                    schema: data.schema,
                    generated_at_utc: data.generated_at_utc,
                    status: data.status,
                    warnings: data.warnings,
                    source: data.source,
                    selection: data.selection,
                    configuration: data.configuration,
                    variants: data.variants,
                    models: data.models,
                    environment: data.environment,
                    interpretation_rules: data.interpretation_rules
                },
                null,
                2
            );
        }
        catch (error) {
            packageData = null;
            state.textContent = "No generated package";
            resultStatus.textContent =
                "Synthetic reconstruction results are unavailable: " +
                error.message;
        }
    }

    reloadResults.addEventListener("click", loadResults);
    loadResults();
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        () => initializeSyntheticReconstructionTab(),
        { once: true }
    );
}
else {
    initializeSyntheticReconstructionTab();
}
'''

    if CSS_MARKER not in styles:
        styles += r'''

/* synthetic-reconstruction-tab-v1 */

.synthetic-reconstruction-tab-button {
    border-color: rgba(239, 143, 143, 0.34);
}

.synthetic-reconstruction-warning {
    margin-bottom: 1rem;
    border-color: rgba(239, 143, 143, 0.45);
    border-left-color: var(--red);
    background: rgba(61, 32, 37, 0.7);
}

.synthetic-request-grid {
    display: grid;
    grid-template-columns:
        repeat(3, minmax(140px, 0.55fr))
        repeat(2, minmax(180px, 1fr));
    align-items: end;
    gap: 0.7rem;
    margin-bottom: 0.7rem;
}

.synthetic-request-grid label {
    display: grid;
    gap: 0.35rem;
    color: var(--muted);
    font-size: 0.82rem;
}

.synthetic-request-grid input {
    min-height: 2.55rem;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 0.45rem;
    background: #0d141b;
    color: var(--text);
}

.synthetic-request-grid button,
.synthetic-request-actions button,
.synthetic-candidate-actions button {
    min-height: 2.55rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.48rem;
    background: var(--surface-2);
    color: var(--text);
    cursor: pointer;
}

.synthetic-request-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
    margin-bottom: 0.65rem;
}

#synthetic-copy-command {
    border-color: rgba(127, 196, 239, 0.6);
    background: var(--blue-dark);
}

.synthetic-result-status {
    margin: 1rem 0;
    padding: 0.8rem;
    border: 1px solid var(--border);
    border-radius: 0.55rem;
    background: #0d141b;
    color: var(--muted);
}

.synthetic-audio-comparisons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.7rem;
    margin-bottom: 1rem;
}

.synthetic-audio-card {
    display: grid;
    gap: 0.35rem;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.55rem;
    background: #0d141b;
}

.synthetic-audio-card strong {
    text-transform: capitalize;
}

.synthetic-audio-card span {
    min-height: 2.5em;
    color: var(--muted);
    font-size: 0.77rem;
}

.synthetic-audio-card audio {
    width: 100%;
}

.synthetic-candidates {
    display: grid;
    gap: 0.75rem;
}

.synthetic-candidate-card {
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.65rem;
    background:
        linear-gradient(
            180deg,
            rgba(21, 29, 38, 0.98),
            rgba(13, 19, 25, 0.98)
        );
}

.synthetic-candidate-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.synthetic-candidate-rank {
    color: var(--blue);
    font-size: 0.77rem;
    font-weight: 850;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.synthetic-support-label {
    padding: 0.28rem 0.5rem;
    border: 1px solid rgba(239, 195, 107, 0.35);
    border-radius: 999px;
    background: var(--amber-dark);
    color: var(--amber);
    font-size: 0.72rem;
}

.synthetic-candidate-text {
    margin: 0.85rem 0;
    padding: 0.85rem;
    border-left: 3px solid var(--red);
    background: rgba(61, 32, 37, 0.34);
    font-size: clamp(1rem, 2vw, 1.25rem);
    line-height: 1.55;
}

.synthetic-candidate-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
    margin-bottom: 0.8rem;
}

.synthetic-candidate-stats > div {
    min-width: 0;
    padding: 0.6rem;
    border: 1px solid var(--border);
    border-radius: 0.45rem;
    background: #0d141b;
}

.synthetic-candidate-stats strong,
.synthetic-candidate-stats span {
    display: block;
}

.synthetic-candidate-stats strong {
    color: var(--muted);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

.synthetic-candidate-stats span {
    margin-top: 0.2rem;
    font-size: 0.8rem;
    overflow-wrap: anywhere;
}

.synthetic-candidate-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-bottom: 0.7rem;
}

.synthetic-candidate-actions button:first-child {
    border-color: rgba(239, 143, 143, 0.55);
    background: var(--red-dark);
}

.synthetic-candidate-sources {
    padding: 0.7rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: #0b1015;
}

.synthetic-candidate-sources summary {
    cursor: pointer;
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 750;
}

.synthetic-candidate-sources ul {
    display: grid;
    gap: 0.55rem;
    margin: 0.7rem 0 0;
    padding: 0;
    list-style: none;
}

.synthetic-candidate-sources li {
    padding: 0.65rem;
    border: 1px solid var(--border);
    border-radius: 0.45rem;
    background: #0d141b;
}

.synthetic-candidate-sources strong,
.synthetic-candidate-sources span {
    display: block;
}

.synthetic-candidate-sources span {
    margin-top: 0.2rem;
    color: var(--muted);
    font-size: 0.73rem;
}

.synthetic-candidate-sources blockquote {
    margin: 0.55rem 0 0;
    padding-left: 0.65rem;
    border-left: 2px solid var(--border-strong);
    color: #dce6ed;
}

.synthetic-provenance {
    margin-top: 1rem;
    padding: 0.8rem;
    border: 1px solid var(--border);
    border-radius: 0.55rem;
    background: #0d141b;
}

.synthetic-provenance summary {
    cursor: pointer;
    font-weight: 750;
}

.synthetic-provenance pre {
    max-height: 38rem;
    overflow: auto;
    margin: 0.8rem 0 0;
    padding: 0.75rem;
    border-radius: 0.45rem;
    background: #070a0d;
    color: #cbd6de;
    font-size: 0.73rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.synthetic-empty {
    padding: 1rem;
    border: 1px dashed var(--border);
    border-radius: 0.55rem;
    color: var(--muted);
}

@media (max-width: 1050px) {
    .synthetic-request-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .synthetic-candidate-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 700px) {
    .synthetic-request-grid,
    .synthetic-candidate-stats,
    .synthetic-audio-comparisons {
        grid-template-columns: 1fr;
    }
}
'''

    app_path.write_text(app, encoding="utf-8")
    styles_path.write_text(styles, encoding="utf-8")

    print("Synthetic reconstruction website tab installed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
