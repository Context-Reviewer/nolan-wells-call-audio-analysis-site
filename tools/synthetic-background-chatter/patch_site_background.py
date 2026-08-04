from __future__ import annotations

import argparse
from pathlib import Path


JS_MARKER = "// synthetic-background-chatter-ui-v1"
CSS_MARKER = "/* synthetic-background-chatter-ui-v1 */"


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

// synthetic-background-chatter-ui-v1

function initializeSyntheticBackgroundChatter(attempt = 0) {
    if (document.getElementById("synthetic-background-chatter")) {
        return;
    }

    const syntheticPanel = document.getElementById(
        "synthetic-reconstruction-panel"
    );

    if (!syntheticPanel) {
        if (attempt < 60) {
            window.setTimeout(
                () => initializeSyntheticBackgroundChatter(
                    attempt + 1
                ),
                100
            );
        }
        return;
    }

    const host = syntheticPanel.querySelector(
        ".synthetic-reconstruction-card"
    );

    if (!host) {
        return;
    }

    const section = document.createElement("section");
    section.id = "synthetic-background-chatter";
    section.className = "synthetic-background-chatter";

    section.innerHTML = `
        <div class="synthetic-background-heading">
            <div>
                <p class="eyebrow">
                    High-sensitivity short-window scan
                </p>
                <h3>Background-chatter reconstruction</h3>
            </div>
            <button
                id="reload-synthetic-background"
                type="button"
            >
                Reload background results
            </button>
        </div>

        <div class="notice synthetic-background-warning">
            This lane deliberately favors sensitivity. Single-output
            candidates are especially prone to hallucination. Repetition
            across windows, variants, or models means the output is more
            reproducible—not necessarily true.
        </div>

        <div
            id="synthetic-background-status"
            class="synthetic-result-status"
        >
            Looking for background-chatter results…
        </div>

        <div
            id="synthetic-background-audio"
            class="synthetic-audio-comparisons"
            hidden
        ></div>

        <div class="synthetic-background-toolbar">
            <label>
                Minimum recurrence
                <select id="synthetic-background-support-filter">
                    <option value="1">Show all candidates</option>
                    <option value="2" selected>
                        At least 2 supporting outputs
                    </option>
                    <option value="3">
                        At least 3 supporting outputs
                    </option>
                    <option value="5">
                        At least 5 supporting outputs
                    </option>
                </select>
            </label>

            <label>
                Search wording
                <input
                    id="synthetic-background-search"
                    type="search"
                    placeholder="Filter candidates"
                >
            </label>
        </div>

        <div
            id="synthetic-background-candidates"
            class="synthetic-background-candidates"
        ></div>

        <details
            id="synthetic-background-provenance"
            class="synthetic-provenance"
            hidden
        >
            <summary>
                Background-scan configuration and provenance
            </summary>
            <pre id="synthetic-background-provenance-json"></pre>
        </details>
    `;

    const provenance = host.querySelector(
        "#synthetic-provenance"
    );

    if (provenance) {
        provenance.insertAdjacentElement(
            "beforebegin",
            section
        );
    }
    else {
        host.append(section);
    }

    const reloadButton = document.getElementById(
        "reload-synthetic-background"
    );
    const status = document.getElementById(
        "synthetic-background-status"
    );
    const audioContainer = document.getElementById(
        "synthetic-background-audio"
    );
    const candidatesContainer = document.getElementById(
        "synthetic-background-candidates"
    );
    const supportFilter = document.getElementById(
        "synthetic-background-support-filter"
    );
    const search = document.getElementById(
        "synthetic-background-search"
    );
    const provenancePanel = document.getElementById(
        "synthetic-background-provenance"
    );
    const provenanceJson = document.getElementById(
        "synthetic-background-provenance-json"
    );

    let dataPackage = null;

    function formatCandidateTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainder = seconds - minutes * 60;

        return (
            `${String(minutes).padStart(2, "0")}:` +
            `${remainder.toFixed(2).padStart(5, "0")}`
        );
    }

    function speak(text) {
        if (!("speechSynthesis" in window)) {
            return;
        }

        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(
            `Synthetic background candidate. ${text}`
        );
        utterance.rate = 0.86;
        utterance.pitch = 1;
        utterance.volume = 0.95;

        const voice = window.speechSynthesis
            .getVoices()
            .find((item) => /^en[-_]/i.test(item.lang));

        if (voice) {
            utterance.voice = voice;
        }

        window.speechSynthesis.speak(utterance);
    }

    function renderAudio() {
        audioContainer.textContent = "";

        Object.entries(dataPackage.variants).forEach(
            ([name, variant]) => {
                const card = document.createElement("div");
                card.className = "synthetic-audio-card";

                const strong = document.createElement("strong");
                strong.textContent = name.replaceAll("_", " ");

                const description = document.createElement("span");
                description.textContent = variant.description;

                const audio = document.createElement("audio");
                audio.controls = true;
                audio.preload = "metadata";
                audio.src = `./${variant.public_audio_path}`;

                card.append(strong, description, audio);
                audioContainer.append(card);
            }
        );

        audioContainer.hidden = false;
    }

    function renderCandidates() {
        candidatesContainer.textContent = "";

        if (!dataPackage) {
            return;
        }

        const minimumSupport = Number(supportFilter.value);
        const query = search.value.trim().toLowerCase();

        const visible = dataPackage.candidates.filter(
            (candidate) =>
                candidate.supporting_outputs >= minimumSupport &&
                (
                    !query ||
                    candidate.text.toLowerCase().includes(query)
                )
        );

        visible.forEach((candidate) => {
            const card = document.createElement("article");
            card.className =
                "synthetic-background-candidate-card";

            const header = document.createElement("div");
            header.className =
                "synthetic-background-candidate-header";

            const time = document.createElement("strong");
            time.textContent =
                `${formatCandidateTime(candidate.start)}–` +
                `${formatCandidateTime(candidate.end)}`;

            const label = document.createElement("span");
            label.className = "synthetic-support-label";
            label.textContent = candidate.support_label;

            header.append(time, label);

            const text = document.createElement("p");
            text.className =
                "synthetic-background-candidate-text";
            text.textContent = candidate.text;

            const metrics = document.createElement("div");
            metrics.className =
                "synthetic-background-candidate-metrics";
            metrics.textContent =
                `${candidate.supporting_outputs} outputs · ` +
                `${candidate.supporting_windows} windows · ` +
                `${candidate.supporting_models.length} model(s) · ` +
                `${candidate.supporting_variants.join(", ")}`;

            const actions = document.createElement("div");
            actions.className =
                "synthetic-candidate-actions";

            const open = document.createElement("button");
            open.type = "button";
            open.textContent = "Open source interval";
            open.addEventListener("click", () => {
                createSelection(
                    Math.max(0, candidate.start - 0.35),
                    candidate.end + 0.35,
                    true
                );

                const listenTab = Array.from(
                    document.querySelectorAll(
                        "#full-recording .lab-tab-button"
                    )
                ).find((button) =>
                    /listen/i.test(button.textContent)
                );

                listenTab?.click();
            });

            const say = document.createElement("button");
            say.type = "button";
            say.textContent = "Speak candidate";
            say.addEventListener("click", () => {
                speak(candidate.text);
            });

            actions.append(open, say);

            const details = document.createElement("details");
            details.className =
                "synthetic-candidate-sources";

            const summary = document.createElement("summary");
            summary.textContent =
                "Show all contributing model outputs";

            const list = document.createElement("ul");

            candidate.sources.forEach((source) => {
                const item = document.createElement("li");
                const sourceName = document.createElement("strong");
                sourceName.textContent =
                    `${source.model_name} · ${source.variant} · ` +
                    `${source.window_duration.toFixed(1)}s window · ` +
                    `${source.pass_id}`;

                const sourceScore = document.createElement("span");
                sourceScore.textContent =
                    `${formatCandidateTime(source.window_start)}–` +
                    `${formatCandidateTime(source.window_end)} · ` +
                    `avg log score ` +
                    `${source.avg_logprob.toFixed(3)} · ` +
                    `no-speech ` +
                    `${source.no_speech_prob.toFixed(3)}`;

                const quote = document.createElement("blockquote");
                quote.textContent = source.text;

                item.append(
                    sourceName,
                    sourceScore,
                    quote
                );
                list.append(item);
            });

            details.append(summary, list);

            card.append(
                header,
                text,
                metrics,
                actions,
                details
            );
            candidatesContainer.append(card);
        });

        if (!visible.length) {
            const empty = document.createElement("div");
            empty.className = "synthetic-empty";
            empty.textContent =
                "No candidates match the current recurrence " +
                "and wording filters.";
            candidatesContainer.append(empty);
        }

        status.textContent =
            `${visible.length} of ` +
            `${dataPackage.candidates.length} candidate clusters shown.`;
    }

    async function loadPackage() {
        status.textContent =
            "Loading synthetic background-chatter package…";
        candidatesContainer.textContent = "";
        audioContainer.hidden = true;
        provenancePanel.hidden = true;

        try {
            const response = await fetch(
                "./assets/data/synthetic-background-chatter.json" +
                `?cache=${Date.now()}`,
                { cache: "no-store" }
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}; run the local ` +
                    "background-chatter sweep first."
                );
            }

            const data = await response.json();

            if (
                data.schema !==
                "experimental_synthetic_background_chatter_v1"
            ) {
                throw new Error(
                    `Unexpected schema: ${data.schema}`
                );
            }

            dataPackage = data;
            renderAudio();
            renderCandidates();

            provenancePanel.hidden = false;
            provenanceJson.textContent = JSON.stringify(
                {
                    schema: data.schema,
                    generated_at_utc: data.generated_at_utc,
                    status: data.status,
                    warnings: data.warnings,
                    source: data.source,
                    selection: data.selection,
                    configuration: data.configuration,
                    models: data.models,
                    environment: data.environment
                },
                null,
                2
            );
        }
        catch (error) {
            dataPackage = null;
            status.textContent =
                "Background-chatter results unavailable: " +
                error.message;
        }
    }

    reloadButton.addEventListener("click", loadPackage);
    supportFilter.addEventListener(
        "change",
        renderCandidates
    );
    search.addEventListener("input", renderCandidates);

    loadPackage();
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        () => initializeSyntheticBackgroundChatter(),
        { once: true }
    );
}
else {
    initializeSyntheticBackgroundChatter();
}
'''

    if CSS_MARKER not in styles:
        styles += r'''

/* synthetic-background-chatter-ui-v1 */

.synthetic-background-chatter {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border);
}

.synthetic-background-heading {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
}

.synthetic-background-heading h3 {
    margin: 0;
}

.synthetic-background-heading button,
.synthetic-background-toolbar select,
.synthetic-background-toolbar input {
    min-height: 2.5rem;
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: 0.45rem;
    background: var(--surface-2);
    color: var(--text);
}

.synthetic-background-warning {
    margin-bottom: 0.8rem;
    border-color: rgba(239, 195, 107, 0.4);
    background: rgba(60, 48, 23, 0.62);
}

.synthetic-background-toolbar {
    display: grid;
    grid-template-columns:
        minmax(220px, 0.7fr)
        minmax(240px, 1fr);
    gap: 0.7rem;
    margin: 0.8rem 0;
}

.synthetic-background-toolbar label {
    display: grid;
    gap: 0.35rem;
    color: var(--muted);
    font-size: 0.8rem;
}

.synthetic-background-candidates {
    display: grid;
    gap: 0.7rem;
}

.synthetic-background-candidate-card {
    padding: 0.9rem;
    border: 1px solid var(--border);
    border-radius: 0.6rem;
    background: #0d141b;
}

.synthetic-background-candidate-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.7rem;
}

.synthetic-background-candidate-header strong {
    color: var(--blue);
    font-family:
        ui-monospace, SFMono-Regular, Consolas,
        monospace;
}

.synthetic-background-candidate-text {
    margin: 0.7rem 0;
    padding: 0.75rem;
    border-left: 3px solid var(--amber);
    background: rgba(60, 48, 23, 0.34);
    font-size: 1rem;
    line-height: 1.5;
}

.synthetic-background-candidate-metrics {
    margin-bottom: 0.65rem;
    color: var(--muted);
    font-size: 0.76rem;
}

@media (max-width: 720px) {
    .synthetic-background-heading {
        align-items: stretch;
        flex-direction: column;
    }

    .synthetic-background-toolbar {
        grid-template-columns: 1fr;
    }
}
'''

    app_path.write_text(app, encoding="utf-8")
    styles_path.write_text(styles, encoding="utf-8")

    print("Synthetic background-chatter UI installed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
