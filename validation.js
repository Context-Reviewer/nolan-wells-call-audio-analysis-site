
const get = (id) => document.getElementById(id);

const deterministicButton = get("run-deterministic");
const liveButton = get("run-live");
const loopButton = get("run-loop");
const downloadButton = get("download-report");
const stateBadge = get("validation-state");
const resultBody = get("validation-results");
const logElement = get("validation-log");
const frame = get("validation-frame");

const passCount = get("pass-count");
const failCount = get("fail-count");
const pendingCount = get("pending-count");
const totalCount = get("total-count");

const results = [];
let report = null;
let hook = null;
let mediaManifest = null;

function log(message) {
    const prefix = new Date().toISOString();
    logElement.textContent += `\n[${prefix}] ${message}`;
    logElement.scrollTop = logElement.scrollHeight;
}

function setState(text, className) {
    stateBadge.textContent = text;
    stateBadge.className = `status ${className}`;
}

function addResult(id, name, status, details = {}) {
    const existing = results.find((item) => item.id === id);

    const item = {
        id,
        name,
        status,
        details,
        recordedAtUtc: new Date().toISOString()
    };

    if (existing) {
        Object.assign(existing, item);
    }
    else {
        results.push(item);
    }

    renderResults();
    return item;
}

function renderResults() {
    resultBody.textContent = "";

    for (const result of results) {
        const row = document.createElement("tr");
        const nameCell = document.createElement("td");
        const statusCell = document.createElement("td");
        const detailCell = document.createElement("td");

        nameCell.textContent = result.name;
        statusCell.textContent = result.status.toUpperCase();
        statusCell.className =
            `validation-result validation-${result.status}`;
        detailCell.className = "validation-details";
        detailCell.textContent = JSON.stringify(
            result.details,
            null,
            0
        );

        row.append(nameCell, statusCell, detailCell);
        resultBody.append(row);
    }

    const passed = results.filter(
        (item) => item.status === "pass"
    ).length;
    const failed = results.filter(
        (item) => item.status === "fail"
    ).length;
    const pending = results.filter(
        (item) => item.status === "pending"
    ).length;

    passCount.textContent = passed;
    failCount.textContent = failed;
    pendingCount.textContent = pending;
    totalCount.textContent = results.length;

    report = buildReport();
    downloadButton.disabled = results.length === 0;
}

function expect(id, name, condition, details = {}) {
    return addResult(
        id,
        name,
        condition ? "pass" : "fail",
        details
    );
}

function pending(id, name, details = {}) {
    return addResult(id, name, "pending", details);
}

function sleep(milliseconds) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, milliseconds);
    });
}

async function sha256Hex(value) {
    let buffer;

    if (
        value &&
        typeof value.arrayBuffer === "function"
    ) {
        buffer = await value.arrayBuffer();
    }
    else if (ArrayBuffer.isView(value)) {
        const copy = new Uint8Array(
            value.byteLength
        );

        copy.set(
            new Uint8Array(
                value.buffer,
                value.byteOffset,
                value.byteLength
            )
        );

        buffer = copy.buffer;
    }
    else if (
        value &&
        typeof value.byteLength === "number"
    ) {
        const copy = new Uint8Array(
            value.byteLength
        );

        copy.set(new Uint8Array(value));
        buffer = copy.buffer;
    }
    else {
        throw new TypeError(
            "SHA-256 input is not a Blob, ArrayBuffer, or typed array."
        );
    }

    const hash = await crypto.subtle.digest(
        "SHA-256",
        buffer
    );

    return Array.from(new Uint8Array(hash))
        .map((byte) =>
            byte.toString(16).padStart(2, "0")
        )
        .join("");
}

async function waitForHook(timeoutMs = 30000) {
    const started = performance.now();

    while (
        performance.now() - started < timeoutMs
    ) {
        const target = frame.contentWindow;

        if (
            target?.__nolanAudioValidation?.isReady()
        ) {
            return target.__nolanAudioValidation;
        }

        await sleep(150);
    }

    throw new Error(
        "The audio-review frame did not become ready."
    );
}

function rms(samples) {
    let sumSquares = 0;

    for (const value of samples) {
        sumSquares += value * value;
    }

    return Math.sqrt(
        sumSquares / Math.max(samples.length, 1)
    );
}

function toneAmplitude(
    samples,
    sampleRate,
    frequency
) {
    let cosine = 0;
    let sine = 0;

    for (
        let index = 0;
        index < samples.length;
        index += 1
    ) {
        const phase =
            2 * Math.PI * frequency *
            index / sampleRate;

        cosine += samples[index] *
            Math.cos(phase);
        sine += samples[index] *
            Math.sin(phase);
    }

    return (
        2 *
        Math.hypot(cosine, sine) /
        samples.length
    );
}

function parseWavHeader(arrayBuffer) {
    const view = new DataView(arrayBuffer);

    function ascii(offset, length) {
        return Array.from(
            { length },
            (_, index) =>
                String.fromCharCode(
                    view.getUint8(offset + index)
                )
        ).join("");
    }

    return {
        riff: ascii(0, 4),
        wave: ascii(8, 4),
        formatTag: view.getUint16(20, true),
        channels: view.getUint16(22, true),
        sampleRate: view.getUint32(24, true),
        bitsPerSample: view.getUint16(34, true),
        dataTag: ascii(36, 4),
        dataBytes: view.getUint32(40, true)
    };
}

async function testMediaHashes() {
    mediaManifest = await fetch(
        "./forensic-methods/VALIDATION-TEST-MEDIA.json",
        { cache: "no-store" }
    ).then((response) => {
        if (!response.ok) {
            throw new Error(
                `Manifest HTTP ${response.status}`
            );
        }

        return response.json();
    });

    for (const file of mediaManifest.files) {
        const response = await fetch(
            `./${file.path}?check=${Date.now()}`,
            { cache: "no-store" }
        );

        const bytes = await response.arrayBuffer();
        const hash = await sha256Hex(bytes);

        expect(
            `media-hash-${file.path}`,
            `Test-media integrity: ${file.path}`,
            response.ok &&
            bytes.byteLength === file.bytes &&
            hash === file.sha256,
            {
                expectedBytes: file.bytes,
                actualBytes: bytes.byteLength,
                expectedSha256: file.sha256,
                actualSha256: hash
            }
        );
    }
}

async function testHookAndEnvironment() {
    hook = await waitForHook();

    expect(
        "validation-hook",
        "Actual application validation hook",
        hook.version ===
            "browser-audio-validation-hook-v1",
        {
            version: hook.version
        }
    );

    const appResponse = await fetch(
        `./app.js?check=${Date.now()}`,
        { cache: "no-store" }
    );
    const appBytes = await appResponse.arrayBuffer();

    expect(
        "app-source-fetch",
        "Application source available",
        appResponse.ok,
        {
            httpStatus: appResponse.status,
            sha256: await sha256Hex(appBytes)
        }
    );
}

async function testSelectionAndMixes() {
    const info = await hook.loadMedia(
        "./assets/validation/known-stereo-routing.wav"
    );

    // analysis-buffer-characterization-v1
    const sourceSampleRate =
        mediaManifest?.sample_rate_hz ?? 48000;

    expect(
        "decode-routing-media",
        "Known stereo test media preserves duration and channels",
        Number.isFinite(info.sampleRate) &&
        info.sampleRate > 0 &&
        info.channels === 2 &&
        Math.abs(info.durationSeconds - 4) < 0.01,
        {
            ...info,
            sourceSampleRate,
            resampledForAnalysis:
                info.sampleRate !== sourceSampleRate
        }
    );

    addResult(
        "analysis-buffer-rate",
        "Browser analysis-buffer sample rate characterized",
        "pass",
        {
            sourceSampleRate,
            decodedAnalysisSampleRate:
                info.sampleRate,
            resampled:
                info.sampleRate !== sourceSampleRate,
            note:
                "Waveform-derived statistics and raw-mix " +
                "browser exports use this decoded analysis " +
                "buffer. Live listening uses the media " +
                "playback chain."
        }
    );

    hook.createSelection(0.25, 0.75);

    const stereo = hook.getSelectionSampleData(
        "stereo"
    );
    const expectedSamples = Math.round(
        stereo.sampleRate * 0.50
    );

    expect(
        "selection-boundaries",
        "Selection duration maps to the expected decoded samples",
        stereo.channels.length === 2 &&
        stereo.channels[0].length ===
            expectedSamples &&
        stereo.channels[1].length ===
            expectedSamples,
        {
            sampleRate: stereo.sampleRate,
            selectionDurationSeconds: 0.50,
            leftSamples: stereo.channels[0].length,
            rightSamples: stereo.channels[1].length,
            expectedSamples
        }
    );

    const channel1 = hook.getSelectionSampleData(
        "channel1"
    );
    const channel2 = hook.getSelectionSampleData(
        "channel2"
    );
    const mono = hook.getSelectionSampleData("mono");

    const c1_440 = toneAmplitude(
        channel1.channels[0],
        channel1.sampleRate,
        440
    );
    const c1_880 = toneAmplitude(
        channel1.channels[0],
        channel1.sampleRate,
        880
    );
    const c2_440 = toneAmplitude(
        channel2.channels[0],
        channel2.sampleRate,
        440
    );
    const c2_880 = toneAmplitude(
        channel2.channels[0],
        channel2.sampleRate,
        880
    );
    const mono_440 = toneAmplitude(
        mono.channels[0],
        mono.sampleRate,
        440
    );
    const mono_880 = toneAmplitude(
        mono.channels[0],
        mono.sampleRate,
        880
    );

    expect(
        "export-channel1",
        "Export mix isolates Channel 1",
        c1_440 > 0.18 &&
        c1_880 < 0.01,
        { c1_440, c1_880 }
    );

    expect(
        "export-channel2",
        "Export mix isolates Channel 2",
        c2_880 > 0.18 &&
        c2_440 < 0.01,
        { c2_440, c2_880 }
    );

    expect(
        "export-mono",
        "Mono export contains both channels at half gain",
        mono_440 > 0.08 &&
        mono_880 > 0.08 &&
        mono_440 < 0.13 &&
        mono_880 < 0.13,
        { mono_440, mono_880 }
    );

    await hook.loadMedia(
        "./assets/validation/identical-cancellation.wav"
    );
    hook.createSelection(0.25, 0.75);

    const identicalDifference =
        hook.getSelectionSampleData(
            "difference"
        );

    expect(
        "export-difference-cancel",
        "Difference export cancels identical channels",
        rms(
            identicalDifference.channels[0]
        ) < 0.0001,
        {
            rms: rms(
                identicalDifference.channels[0]
            )
        }
    );

    await hook.loadMedia(
        "./assets/validation/opposite-polarity.wav"
    );
    hook.createSelection(0.25, 0.75);

    const oppositeMono =
        hook.getSelectionSampleData("mono");
    const oppositeDifference =
        hook.getSelectionSampleData(
            "difference"
        );

    expect(
        "export-opposite-mono",
        "Mono export cancels opposite polarity",
        rms(oppositeMono.channels[0]) < 0.0001,
        {
            rms: rms(oppositeMono.channels[0])
        }
    );

    expect(
        "export-opposite-difference",
        "Difference export preserves opposite polarity",
        rms(
            oppositeDifference.channels[0]
        ) > 0.14,
        {
            rms: rms(
                oppositeDifference.channels[0]
            )
        }
    );
}

async function testGainAndPresets() {
    const gainTests = [
        [0, 1],
        [-6, 10 ** (-6 / 20)],
        [6, 10 ** (6 / 20)],
        [-60, 0]
    ];

    for (const [db, expected] of gainTests) {
        const actual = hook.dbToGain(db);

        expect(
            `db-gain-${db}`,
            `dB conversion: ${db} dB`,
            Math.abs(actual - expected) < 1e-10,
            { db, expected, actual }
        );
    }

    const expectedPresets = {
        bypass: {
            filtersBypassed: true,
            compressorEnabled: false,
            highpass: [false, 100],
            lowpass: [false, 6000],
            presencePeak: [false, 2500, 4, 1.2]
        },
        "speech-mild": {
            filtersBypassed: false,
            compressorEnabled: false,
            highpass: [true, 100],
            lowpass: [true, 6000],
            presencePeak: [true, 2500, 4, 1.2]
        },
        "speech-narrow": {
            filtersBypassed: false,
            compressorEnabled: true,
            highpass: [true, 180],
            lowpass: [true, 4200],
            presencePeak: [true, 2200, 6, 1.6]
        },
        rumble: {
            filtersBypassed: false,
            compressorEnabled: false,
            highpass: [true, 180],
            lowpass: [false, 6000],
            presencePeak: [false, 2500, 4, 1.2]
        }
    };

    for (
        const [name, expected] of
        Object.entries(expectedPresets)
    ) {
        const settings = await hook.setPreset(name);

        const ok =
            settings.filtersBypassed ===
                expected.filtersBypassed &&
            settings.compressorEnabled ===
                expected.compressorEnabled &&
            settings.highpass.enabled ===
                expected.highpass[0] &&
            settings.highpass.frequencyHz ===
                expected.highpass[1] &&
            settings.lowpass.enabled ===
                expected.lowpass[0] &&
            settings.lowpass.frequencyHz ===
                expected.lowpass[1] &&
            settings.presencePeak.enabled ===
                expected.presencePeak[0] &&
            settings.presencePeak.frequencyHz ===
                expected.presencePeak[1] &&
            settings.presencePeak.gainDb ===
                expected.presencePeak[2] &&
            settings.presencePeak.q ===
                expected.presencePeak[3];

        expect(
            `preset-${name}`,
            `Preset configuration: ${name}`,
            ok,
            settings
        );
    }
}

async function testWavEncoder() {
    const left = new Float32Array([
        -1,
        -0.5,
        0,
        0.5,
        1
    ]);
    const right = new Float32Array([
        1,
        0.5,
        0,
        -0.5,
        -1
    ]);

    const blob = hook.encodeWav(
        [left, right],
        48000
    );
    const bytes = await blob.arrayBuffer();
    const header = parseWavHeader(bytes);

    expect(
        "wav-header",
        "WAV export header",
        header.riff === "RIFF" &&
        header.wave === "WAVE" &&
        header.formatTag === 1 &&
        header.channels === 2 &&
        header.sampleRate === 48000 &&
        header.bitsPerSample === 16 &&
        header.dataTag === "data" &&
        header.dataBytes === 20,
        header
    );

    expect(
        "wav-size",
        "WAV export byte length",
        bytes.byteLength === 64,
        {
            expectedBytes: 64,
            actualBytes: bytes.byteLength,
            sha256: await sha256Hex(bytes)
        }
    );
}

async function runDeterministicTests() {
    deterministicButton.disabled = true;
    liveButton.disabled = true;
    loopButton.disabled = true;
    results.length = 0;
    renderResults();
    logElement.textContent = "Starting deterministic tests.";
    setState("Running", "uncertain");

    try {
        await testHookAndEnvironment();
        await testMediaHashes();
        await testSelectionAndMixes();
        await testGainAndPresets();
        await testWavEncoder();

        pending(
            "live-routing-filter",
            "Live routing, gain, and filter response",
            {
                action:
                    "Press Run live routing and filter tests."
            }
        );

        pending(
            "loop-boundary",
            "Actual selection-loop behavior",
            {
                action:
                    "Press Run loop-boundary test."
            }
        );

        liveButton.disabled = false;
        loopButton.disabled = false;

        const failed = results.some(
            (item) => item.status === "fail"
        );

        setState(
            failed
                ? "Deterministic failures"
                : "Deterministic tests passed",
            failed ? "unsupported" : "high"
        );
        log("Deterministic tests completed.");
    }
    catch (error) {
        addResult(
            "deterministic-run-error",
            "Deterministic validation run",
            "fail",
            {
                message: error.message,
                stack: error.stack
            }
        );
        setState("Run failed", "unsupported");
        log(`ERROR: ${error.stack || error.message}`);
    }
    finally {
        deterministicButton.disabled = false;
    }
}

function dbDifference(processed, baseline) {
    return processed - baseline;
}

async function readSpectrum(
    frequencies,
    settleMs = 300
) {
    await sleep(settleMs);
    return hook.sampleSpectrum(
        frequencies
    ).values;
}

async function runLiveTests() {
    liveButton.disabled = true;
    loopButton.disabled = true;
    setState("Live tests running", "uncertain");
    log("Starting live routing and filter tests.");

    const frequencies = [80, 440, 500, 880, 1000, 2200, 8000];

    try {
        await hook.loadMedia(
            "./assets/validation/known-stereo-routing.wav"
        );
        await hook.setPreset("bypass");
        await hook.setGains(0, 0, 0);

        await hook.setChannelMode("stereo");
        await hook.playFrom(0.5);
        const stereo = await readSpectrum(
            frequencies
        );

        await hook.setChannelMode("channel1");
        const channel1 = await readSpectrum(
            frequencies
        );

        await hook.setChannelMode("channel2");
        const channel2 = await readSpectrum(
            frequencies
        );

        expect(
            "live-routing-stereo",
            "Live stereo contains both known tones",
            stereo["440"] > -35 &&
            stereo["880"] > -35,
            stereo
        );

        expect(
            "live-routing-channel1",
            "Live Channel 1 suppresses Channel 2 tone",
            channel1["440"] -
                channel1["880"] > 20,
            {
                db440: channel1["440"],
                db880: channel1["880"],
                separationDb:
                    channel1["440"] -
                    channel1["880"]
            }
        );

        expect(
            "live-routing-channel2",
            "Live Channel 2 suppresses Channel 1 tone",
            channel2["880"] -
                channel2["440"] > 20,
            {
                db440: channel2["440"],
                db880: channel2["880"],
                separationDb:
                    channel2["880"] -
                    channel2["440"]
            }
        );

        await hook.setChannelMode("channel2");
        await hook.setGains(0, 0, 0);
        const gainBaseline = await readSpectrum(
            [880],
            180
        );

        await hook.setGains(0, 0, -6);
        const gainMinus6 = await readSpectrum(
            [880],
            180
        );

        const measuredGainDelta =
            gainMinus6["880"] -
            gainBaseline["880"];

        expect(
            "live-master-gain",
            "Live master gain applies approximately −6 dB",
            Math.abs(
                measuredGainDelta - (-6)
            ) < 1.5,
            {
                baselineDb: gainBaseline["880"],
                reducedDb: gainMinus6["880"],
                measuredDeltaDb:
                    measuredGainDelta
            }
        );

        hook.stop();

        await hook.loadMedia(
            "./assets/validation/identical-cancellation.wav"
        );
        await hook.setPreset("bypass");
        await hook.setGains(0, 0, 0);
        await hook.setChannelMode("difference");
        await hook.playFrom(0.5);
        const differenceRms =
            await sleep(250).then(() =>
                hook.sampleOutputRms()
            );

        expect(
            "live-difference-cancel",
            "Live difference mode cancels identical channels",
            differenceRms < 0.003,
            { outputRms: differenceRms }
        );

        hook.stop();

        await hook.loadMedia(
            "./assets/validation/filter-multitone.wav"
        );
        await hook.setChannelMode("channel2");
        await hook.setGains(0, 0, 0);
        await hook.setPreset("bypass");
        await hook.playFrom(0.5);

        const baseline = await readSpectrum(
            [80, 500, 2200, 8000],
            300
        );

        await hook.setPreset("speech-mild");
        const mild = await readSpectrum(
            [80, 500, 2200, 8000],
            250
        );

        await hook.setPreset("speech-narrow");
        const narrow = await readSpectrum(
            [80, 500, 2200, 8000],
            250
        );

        await hook.setPreset("rumble");
        const rumble = await readSpectrum(
            [80, 500, 2200, 8000],
            250
        );

        expect(
            "live-filter-mild",
            "Mild speech preset changes the expected bands",
            dbDifference(
                mild["80"],
                baseline["80"]
            ) < -1.5 &&
            dbDifference(
                mild["8000"],
                baseline["8000"]
            ) < -1.5 &&
            dbDifference(
                mild["2200"],
                baseline["2200"]
            ) > 1.5,
            {
                delta80Db: dbDifference(
                    mild["80"],
                    baseline["80"]
                ),
                delta2200Db: dbDifference(
                    mild["2200"],
                    baseline["2200"]
                ),
                delta8000Db: dbDifference(
                    mild["8000"],
                    baseline["8000"]
                )
            }
        );

        expect(
            "live-filter-narrow",
            "Narrow speech preset is more selective",
            dbDifference(
                narrow["80"],
                baseline["80"]
            ) < -5 &&
            dbDifference(
                narrow["8000"],
                baseline["8000"]
            ) < -5 &&
            dbDifference(
                narrow["2200"],
                baseline["2200"]
            ) > 2,
            {
                delta80Db: dbDifference(
                    narrow["80"],
                    baseline["80"]
                ),
                delta2200Db: dbDifference(
                    narrow["2200"],
                    baseline["2200"]
                ),
                delta8000Db: dbDifference(
                    narrow["8000"],
                    baseline["8000"]
                )
            }
        );

        expect(
            "live-filter-rumble",
            "Rumble preset reduces low frequency while preserving higher bands",
            dbDifference(
                rumble["80"],
                baseline["80"]
            ) < -5 &&
            Math.abs(
                dbDifference(
                    rumble["2200"],
                    baseline["2200"]
                )
            ) < 1.5 &&
            Math.abs(
                dbDifference(
                    rumble["8000"],
                    baseline["8000"]
                )
            ) < 1.5,
            {
                delta80Db: dbDifference(
                    rumble["80"],
                    baseline["80"]
                ),
                delta2200Db: dbDifference(
                    rumble["2200"],
                    baseline["2200"]
                ),
                delta8000Db: dbDifference(
                    rumble["8000"],
                    baseline["8000"]
                )
            }
        );

        hook.stop();

        addResult(
            "live-routing-filter",
            "Live routing, gain, and filter response",
            results.some(
                (item) =>
                    item.id.startsWith("live-") &&
                    item.id !==
                        "live-routing-filter" &&
                    item.status === "fail"
            )
                ? "fail"
                : "pass",
            {
                completed: true
            }
        );

        const failed = results.some(
            (item) => item.status === "fail"
        );

        setState(
            failed
                ? "Validation failures"
                : "Live tests passed",
            failed ? "unsupported" : "high"
        );
        log("Live routing and filter tests completed.");
    }
    catch (error) {
        addResult(
            "live-routing-filter",
            "Live routing, gain, and filter response",
            "fail",
            {
                message: error.message,
                stack: error.stack
            }
        );
        setState("Live test failed", "unsupported");
        log(`ERROR: ${error.stack || error.message}`);
    }
    finally {
        hook?.stop();
        liveButton.disabled = false;
        loopButton.disabled = false;
    }
}

async function runLoopTest() {
    loopButton.disabled = true;
    liveButton.disabled = true;
    setState("Loop test running", "uncertain");
    log("Starting actual loop-boundary test.");

    try {
        await hook.loadMedia(
            "./assets/validation/known-stereo-routing.wav"
        );
        await hook.setPreset("bypass");
        await hook.setChannelMode("channel2");
        await hook.setGains(0, 0, -18);
        hook.createSelection(0.20, 0.50);

        const observed = [];
        await hook.playSelection(true);

        const started = performance.now();

        while (
            performance.now() - started < 1400
        ) {
            observed.push({
                atMs: performance.now() - started,
                currentTime: hook.getCurrentTime()
            });
            await sleep(20);
        }

        hook.stop();

        let wraps = 0;
        let maxTime = Number.NEGATIVE_INFINITY;
        let minTime = Number.POSITIVE_INFINITY;

        for (
            let index = 1;
            index < observed.length;
            index += 1
        ) {
            const previous =
                observed[index - 1].currentTime;
            const current =
                observed[index].currentTime;

            if (previous - current > 0.12) {
                wraps += 1;
            }

            maxTime = Math.max(maxTime, current);
            minTime = Math.min(minTime, current);
        }

        const passed =
            wraps >= 2 &&
            minTime >= 0.16 &&
            maxTime <= 0.58;

        expect(
            "loop-boundary",
            "Actual selection-loop behavior",
            passed,
            {
                selectionStart: 0.20,
                selectionEnd: 0.50,
                observedWraps: wraps,
                observedMinimumSeconds: minTime,
                observedMaximumSeconds: maxTime,
                sampleCount: observed.length
            }
        );

        setState(
            passed
                ? "Loop test passed"
                : "Loop test failed",
            passed ? "high" : "unsupported"
        );
        log("Loop-boundary test completed.");
    }
    catch (error) {
        addResult(
            "loop-boundary",
            "Actual selection-loop behavior",
            "fail",
            {
                message: error.message,
                stack: error.stack
            }
        );
        setState("Loop test failed", "unsupported");
        log(`ERROR: ${error.stack || error.message}`);
    }
    finally {
        hook?.stop();
        loopButton.disabled = false;
        liveButton.disabled = false;
    }
}

function buildReport() {
    const failed = results.filter(
        (item) => item.status === "fail"
    );
    const pendingItems = results.filter(
        (item) => item.status === "pending"
    );

    return {
        schema:
            "nolan_wells_browser_audio_validation_v1",
        generatedAtUtc: new Date().toISOString(),
        environment: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            hardwareConcurrency:
                navigator.hardwareConcurrency ?? null,
            deviceMemoryGb:
                navigator.deviceMemory ?? null,
            secureContext: window.isSecureContext,
            pageUrl: window.location.href
        },
        application: {
            validationHook:
                hook?.version ?? null,
            analysisBufferDisclosure:
                "Waveform-derived statistics and raw-mix " +
                "browser WAV exports use the decoded " +
                "analysis buffer at the sample rate recorded " +
                "by the validation tests. Live listening " +
                "uses the media playback and Web Audio chain."
        },
        testMediaManifest: mediaManifest,
        summary: {
            passed: results.filter(
                (item) => item.status === "pass"
            ).length,
            failed: failed.length,
            pending: pendingItems.length,
            overall:
                failed.length > 0
                    ? "fail"
                    : pendingItems.length > 0
                        ? "incomplete"
                        : "pass"
        },
        results
    };
}

function downloadReport() {
    const completedReport = buildReport();
    const timestamp =
        completedReport.generatedAtUtc
            .replaceAll(":", "")
            .replaceAll("-", "")
            .replace(/\.\d+Z$/, "Z");

    const blob = new Blob(
        [
            JSON.stringify(
                completedReport,
                null,
                2
            ) + "\n"
        ],
        {
            type: "application/json"
        }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download =
        `browser-audio-validation-${timestamp}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

deterministicButton.addEventListener(
    "click",
    runDeterministicTests
);
liveButton.addEventListener(
    "click",
    runLiveTests
);
loopButton.addEventListener(
    "click",
    runLoopTest
);
downloadButton.addEventListener(
    "click",
    downloadReport
);

pending(
    "live-routing-filter",
    "Live routing, gain, and filter response",
    {
        action:
            "Run deterministic tests first."
    }
);
pending(
    "loop-boundary",
    "Actual selection-loop behavior",
    {
        action:
            "Run deterministic tests first."
    }
);

logElement.textContent =
    "Ready. Begin with deterministic tests.";
setState("Not run", "uncertain");
