import WaveSurfer from "https://cdn.jsdelivr.net/npm/wavesurfer.js@7.12.6/dist/wavesurfer.esm.js";
import RegionsPlugin from "https://cdn.jsdelivr.net/npm/wavesurfer.js@7.12.6/dist/plugins/regions.esm.js";
import TimelinePlugin from "https://cdn.jsdelivr.net/npm/wavesurfer.js@7.12.6/dist/plugins/timeline.esm.js";
import HoverPlugin from "https://cdn.jsdelivr.net/npm/wavesurfer.js@7.12.6/dist/plugins/hover.esm.js";

document.querySelectorAll("[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
        const target = document.getElementById(button.dataset.target);

        if (!target) {
            return;
        }

        const willReveal = target.hidden;
        target.hidden = !willReveal;
        button.textContent = willReveal
            ? "Hide interpretation"
            : "Reveal current interpretation";
    });
});

const get = (id) => document.getElementById(id);

const statusElement = get("waveform-status");
const playPauseButton = get("play-pause");
const stopButton = get("stop");
const backFiveButton = get("back-five");
const forwardFiveButton = get("forward-five");
const playbackRate = get("playback-rate");
const currentTime = get("current-time");
const selectionStart = get("selection-start");
const selectionEnd = get("selection-end");
const applySelectionButton = get("apply-selection");
const playSelectionButton = get("play-selection");
const loopSelection = get("loop-selection");
const clearSelectionButton = get("clear-selection");
const selectionDuration = get("selection-duration");
const zoomLevel = get("zoom-level");
const zoomValue = get("zoom-value");
const zoomSelectionButton = get("zoom-selection");
const resetZoomButton = get("reset-zoom");
const bookmarkButtons = document.querySelectorAll(".bookmark");
const openFullButtons = document.querySelectorAll(".open-full-selection");

const channelMode = get("channel-mode");
const channel1Gain = get("channel-1-gain");
const channel2Gain = get("channel-2-gain");
const masterGain = get("master-gain");
const channel1GainValue = get("channel-1-gain-value");
const channel2GainValue = get("channel-2-gain-value");
const masterGainValue = get("master-gain-value");
const signalPathStatus = get("signal-path-status");
const focusChannel2Button = get("focus-channel-2");
const restoreStereoButton = get("restore-stereo");
const swapChannelsButton = get("swap-channels");

const filterPreset = get("filter-preset");
const preservePitch = get("preserve-pitch");
const bypassFilters = get("bypass-filters");
const compressorEnabled = get("compressor-enabled");
const highpassEnabled = get("highpass-enabled");
const highpassFrequency = get("highpass-frequency");
const highpassValue = get("highpass-value");
const lowpassEnabled = get("lowpass-enabled");
const lowpassFrequency = get("lowpass-frequency");
const lowpassValue = get("lowpass-value");
const notchEnabled = get("notch-enabled");
const notchFrequency = get("notch-frequency");
const notchFrequencyValue = get("notch-frequency-value");
const notchQ = get("notch-q");
const notchQValue = get("notch-q-value");
const peakEnabled = get("peak-enabled");
const peakFrequency = get("peak-frequency");
const peakFrequencyValue = get("peak-frequency-value");
const peakGain = get("peak-gain");
const peakGainValue = get("peak-gain-value");
const peakQ = get("peak-q");
const peakQValue = get("peak-q-value");
const resetProcessingButton = get("reset-processing");
const filterStatus = get("filter-status");

const spectrumCanvas = get("spectrum-canvas");
const spectrumMaxFrequency = get("spectrum-max-frequency");

const analysisStatus = get("analysis-status");
const exportMode = get("export-mode");
const exportSelectionWavButton = get("export-selection-wav");
const downloadAnalysisReportButton = get("download-analysis-report");
const copySelectionLinkButton = get("copy-selection-link");
const exportStatus = get("export-status");

const statElements = {
    channel1: {
        peak: get("stat-c1-peak"),
        rms: get("stat-c1-rms"),
        crest: get("stat-c1-crest"),
        dc: get("stat-c1-dc"),
        zeroCrossings: get("stat-c1-zc")
    },
    channel2: {
        peak: get("stat-c2-peak"),
        rms: get("stat-c2-rms"),
        crest: get("stat-c2-crest"),
        dc: get("stat-c2-dc"),
        zeroCrossings: get("stat-c2-zc")
    }
};

const regions = RegionsPlugin.create();

const wavesurfer = WaveSurfer.create({
    container: "#waveform",
    url: "./assets/audio/full-recording.mp3",
    height: 230,
    normalize: true,
    cursorColor: "#f1f4f7",
    cursorWidth: 1,
    minPxPerSec: 1,
    autoScroll: true,
    autoCenter: true,
    dragToSeek: true,
    splitChannels: [
        {
            height: 108,
            waveColor: "#4e7696",
            progressColor: "#9ec6e5"
        },
        {
            height: 108,
            waveColor: "#8a6a35",
            progressColor: "#e4bc73"
        }
    ],
    plugins: [
        regions,
        TimelinePlugin.create({
            height: 24,
            timeInterval: 30,
            primaryLabelInterval: 60,
            secondaryLabelInterval: 30,
            style: {
                fontSize: "11px",
                color: "#9aa8b5"
            }
        }),
        HoverPlugin.create({
            lineColor: "#e9edf2",
            lineWidth: 1,
            labelBackground: "#111820",
            labelColor: "#f3f6f9",
            labelSize: "11px"
        })
    ]
});

const mediaElement = wavesurfer.getMediaElement();
mediaElement.crossOrigin = "anonymous";

let activeRegion = null;
let selectionPlaybackActive = false;
let regionBeingReplaced = false;
let decodedAudio = null;
let analysisTimer = null;
let latestStatistics = null;
let latestExportHash = null;

let audioGraph = null;
let spectrumAnimationFrame = null;

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        seconds = 0;
    }

    const minutes = Math.floor(seconds / 60);
    const remainder = seconds - minutes * 60;

    return `${String(minutes).padStart(2, "0")}:${remainder
        .toFixed(2)
        .padStart(5, "0")}`;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function dbToGain(db) {
    if (db <= -60) {
        return 0;
    }

    return 10 ** (db / 20);
}

function gainToDb(value) {
    if (!Number.isFinite(value) || value <= 0) {
        return Number.NEGATIVE_INFINITY;
    }

    return 20 * Math.log10(value);
}

function formatDb(value) {
    if (!Number.isFinite(value)) {
        return "−∞ dBFS";
    }

    return `${value.toFixed(2)} dBFS`;
}

function formatSignedDb(value) {
    const number = Number(value);
    const prefix = number > 0 ? "+" : "";
    return `${prefix}${number.toFixed(1)} dB`;
}

function setControlsEnabled(enabled) {
    [
        playPauseButton,
        stopButton,
        backFiveButton,
        forwardFiveButton,
        playbackRate,
        selectionStart,
        selectionEnd,
        applySelectionButton,
        playSelectionButton,
        loopSelection,
        clearSelectionButton,
        zoomLevel,
        zoomSelectionButton,
        resetZoomButton,
        channelMode,
        channel1Gain,
        channel2Gain,
        masterGain,
        focusChannel2Button,
        restoreStereoButton,
        swapChannelsButton,
        filterPreset,
        preservePitch,
        bypassFilters,
        compressorEnabled,
        highpassEnabled,
        highpassFrequency,
        lowpassEnabled,
        lowpassFrequency,
        notchEnabled,
        notchFrequency,
        notchQ,
        peakEnabled,
        peakFrequency,
        peakGain,
        peakQ,
        resetProcessingButton,
        spectrumMaxFrequency,
        exportMode,
        exportSelectionWavButton,
        downloadAnalysisReportButton,
        copySelectionLinkButton,
        ...bookmarkButtons
    ].forEach((element) => {
        if (element) {
            element.disabled = !enabled;
        }
    });
}

function updateClock(time = wavesurfer.getCurrentTime()) {
    currentTime.textContent =
        `${formatTime(time)} / ${formatTime(wavesurfer.getDuration())}`;
}

function updateSelectionDisplay() {
    if (!activeRegion) {
        selectionDuration.textContent = "No selection";
        analysisStatus.textContent = "Waiting for selection";
        return;
    }

    selectionStart.value = activeRegion.start.toFixed(2);
    selectionEnd.value = activeRegion.end.toFixed(2);
    selectionDuration.textContent =
        `${formatTime(activeRegion.start)}–${formatTime(activeRegion.end)} ` +
        `(${(activeRegion.end - activeRegion.start).toFixed(2)} sec)`;

    scheduleSelectionAnalysis();
}

function createSelection(start, end, center = false) {
    const duration = wavesurfer.getDuration();

    if (!Number.isFinite(duration) || duration <= 0) {
        return;
    }

    const safeStart = clamp(Number(start), 0, duration);
    const safeEnd = clamp(Number(end), safeStart + 0.02, duration);

    regionBeingReplaced = true;
    regions.clearRegions();
    activeRegion = null;

    activeRegion = regions.addRegion({
        start: safeStart,
        end: safeEnd,
        drag: true,
        resize: true,
        minLength: 0.02,
        color: "rgba(231, 189, 98, 0.28)"
    });

    regionBeingReplaced = false;
    updateSelectionDisplay();

    if (center) {
        wavesurfer.setTime(safeStart);
        wavesurfer.setScrollTime(safeStart);
    }
}

function zoomToActiveSelection() {
    if (!activeRegion) {
        return;
    }

    const selectedLength = Math.max(activeRegion.end - activeRegion.start, 0.05);
    const waveformWidth = get("waveform").clientWidth || 900;
    const pixelsPerSecond = clamp(
        Math.floor((waveformWidth * 0.82) / selectedLength),
        1,
        300
    );

    zoomLevel.value = String(pixelsPerSecond);
    zoomValue.textContent = `${pixelsPerSecond} px/sec`;
    wavesurfer.zoom(pixelsPerSecond);
    wavesurfer.setScrollTime(activeRegion.start);
}

async function playActiveSelection() {
    if (!activeRegion) {
        return;
    }

    await ensureAudioGraph();
    selectionPlaybackActive = true;
    wavesurfer.setTime(activeRegion.start);
    await wavesurfer.play(activeRegion.start, activeRegion.end);
}

function getAudioContextClass() {
    return window.AudioContext || window.webkitAudioContext;
}

async function ensureAudioGraph() {
    if (!audioGraph) {
        const AudioContextClass = getAudioContextClass();

        if (!AudioContextClass) {
            throw new Error("This browser does not support the Web Audio API.");
        }

        const context = new AudioContextClass();
        const source = context.createMediaElementSource(mediaElement);
        const splitter = context.createChannelSplitter(2);

        const channel1Pre = context.createGain();
        const channel2Pre = context.createGain();

        const leftToLeft = context.createGain();
        const leftToRight = context.createGain();
        const rightToLeft = context.createGain();
        const rightToRight = context.createGain();

        const merger = context.createChannelMerger(2);

        const highpass = context.createBiquadFilter();
        const lowpass = context.createBiquadFilter();
        const notch = context.createBiquadFilter();
        const peak = context.createBiquadFilter();

        const dryGain = context.createGain();
        const compressor = context.createDynamicsCompressor();
        const compressedGain = context.createGain();
        const master = context.createGain();
        const analyser = context.createAnalyser();

        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0.72;
        analyser.minDecibels = -110;
        analyser.maxDecibels = -10;

        compressor.threshold.value = -30;
        compressor.knee.value = 12;
        compressor.ratio.value = 3;
        compressor.attack.value = 0.006;
        compressor.release.value = 0.18;

        source.connect(splitter);
        splitter.connect(channel1Pre, 0);
        splitter.connect(channel2Pre, 1);

        channel1Pre.connect(leftToLeft);
        channel1Pre.connect(leftToRight);
        channel2Pre.connect(rightToLeft);
        channel2Pre.connect(rightToRight);

        leftToLeft.connect(merger, 0, 0);
        rightToLeft.connect(merger, 0, 0);
        leftToRight.connect(merger, 0, 1);
        rightToRight.connect(merger, 0, 1);

        merger.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(notch);
        notch.connect(peak);

        peak.connect(dryGain);
        peak.connect(compressor);
        compressor.connect(compressedGain);

        dryGain.connect(master);
        compressedGain.connect(master);

        master.connect(analyser);
        analyser.connect(context.destination);

        audioGraph = {
            context,
            source,
            splitter,
            channel1Pre,
            channel2Pre,
            leftToLeft,
            leftToRight,
            rightToLeft,
            rightToRight,
            merger,
            highpass,
            lowpass,
            notch,
            peak,
            dryGain,
            compressor,
            compressedGain,
            master,
            analyser
        };

        applyAllAudioSettings();
    }

    if (audioGraph.context.state === "suspended") {
        await audioGraph.context.resume();
    }

    return audioGraph;
}

function setMatrix(gains) {
    if (!audioGraph) {
        return;
    }

    const now = audioGraph.context.currentTime;
    const ramp = 0.015;

    [
        [audioGraph.leftToLeft, gains.leftToLeft],
        [audioGraph.leftToRight, gains.leftToRight],
        [audioGraph.rightToLeft, gains.rightToLeft],
        [audioGraph.rightToRight, gains.rightToRight]
    ].forEach(([node, value]) => {
        node.gain.cancelScheduledValues(now);
        node.gain.setTargetAtTime(value, now, ramp);
    });
}

function applyChannelRouting() {
    if (!audioGraph) {
        return;
    }

    const mode = channelMode.value;

    const matrices = {
        stereo: {
            leftToLeft: 1,
            leftToRight: 0,
            rightToLeft: 0,
            rightToRight: 1
        },
        channel1: {
            leftToLeft: 1,
            leftToRight: 1,
            rightToLeft: 0,
            rightToRight: 0
        },
        channel2: {
            leftToLeft: 0,
            leftToRight: 0,
            rightToLeft: 1,
            rightToRight: 1
        },
        mono: {
            leftToLeft: 0.5,
            leftToRight: 0.5,
            rightToLeft: 0.5,
            rightToRight: 0.5
        },
        difference: {
            leftToLeft: 0.5,
            leftToRight: 0.5,
            rightToLeft: -0.5,
            rightToRight: -0.5
        },
        "reverse-difference": {
            leftToLeft: -0.5,
            leftToRight: -0.5,
            rightToLeft: 0.5,
            rightToRight: 0.5
        }
    };

    setMatrix(matrices[mode] || matrices.stereo);
    updateSignalPathStatus();
}

function applyGainSettings() {
    channel1GainValue.textContent = formatSignedDb(channel1Gain.value);
    channel2GainValue.textContent = formatSignedDb(channel2Gain.value);
    masterGainValue.textContent = formatSignedDb(masterGain.value);

    if (!audioGraph) {
        updateSignalPathStatus();
        return;
    }

    const now = audioGraph.context.currentTime;
    audioGraph.channel1Pre.gain.setTargetAtTime(
        dbToGain(Number(channel1Gain.value)),
        now,
        0.015
    );
    audioGraph.channel2Pre.gain.setTargetAtTime(
        dbToGain(Number(channel2Gain.value)),
        now,
        0.015
    );
    audioGraph.master.gain.setTargetAtTime(
        dbToGain(Number(masterGain.value)),
        now,
        0.015
    );

    updateSignalPathStatus();
}

function updateSignalPathStatus() {
    const labels = {
        stereo: "Original stereo",
        channel1: "Channel 1 isolated",
        channel2: "Channel 2 isolated",
        mono: "Mono sum",
        difference: "L − R diagnostic",
        "reverse-difference": "R − L diagnostic"
    };

    const gainModified =
        Number(channel1Gain.value) !== 0 ||
        Number(channel2Gain.value) !== 0 ||
        Number(masterGain.value) !== 0;

    signalPathStatus.textContent =
        labels[channelMode.value] + (gainModified ? " · gain adjusted" : "");

    signalPathStatus.classList.toggle(
        "active",
        channelMode.value !== "stereo" || gainModified
    );
}

function applyFilterSettings() {
    highpassValue.textContent = `${highpassFrequency.value} Hz`;
    lowpassValue.textContent = `${lowpassFrequency.value} Hz`;
    notchFrequencyValue.textContent = `${notchFrequency.value} Hz`;
    notchQValue.textContent = Number(notchQ.value).toFixed(1);
    peakFrequencyValue.textContent = `${peakFrequency.value} Hz`;
    peakGainValue.textContent = formatSignedDb(peakGain.value);
    peakQValue.textContent = Number(peakQ.value).toFixed(1);

    const bypassed = bypassFilters.checked;
    const activeNames = [];

    if (!bypassed && highpassEnabled.checked) {
        activeNames.push(`HP ${highpassFrequency.value} Hz`);
    }

    if (!bypassed && lowpassEnabled.checked) {
        activeNames.push(`LP ${lowpassFrequency.value} Hz`);
    }

    if (!bypassed && notchEnabled.checked) {
        activeNames.push(`notch ${notchFrequency.value} Hz`);
    }

    if (!bypassed && peakEnabled.checked) {
        activeNames.push(
            `presence ${peakFrequency.value} Hz ${formatSignedDb(peakGain.value)}`
        );
    }

    if (!bypassed && compressorEnabled.checked) {
        activeNames.push("compression");
    }

    filterStatus.textContent =
        activeNames.length > 0 ? activeNames.join(" · ") : "Filters bypassed";
    filterStatus.classList.toggle("active", activeNames.length > 0);

    if (!audioGraph) {
        return;
    }

    const now = audioGraph.context.currentTime;

    audioGraph.highpass.type =
        !bypassed && highpassEnabled.checked ? "highpass" : "allpass";
    audioGraph.highpass.frequency.setTargetAtTime(
        Number(highpassFrequency.value),
        now,
        0.01
    );
    audioGraph.highpass.Q.setTargetAtTime(0.707, now, 0.01);

    audioGraph.lowpass.type =
        !bypassed && lowpassEnabled.checked ? "lowpass" : "allpass";
    audioGraph.lowpass.frequency.setTargetAtTime(
        Number(lowpassFrequency.value),
        now,
        0.01
    );
    audioGraph.lowpass.Q.setTargetAtTime(0.707, now, 0.01);

    audioGraph.notch.type =
        !bypassed && notchEnabled.checked ? "notch" : "allpass";
    audioGraph.notch.frequency.setTargetAtTime(
        Number(notchFrequency.value),
        now,
        0.01
    );
    audioGraph.notch.Q.setTargetAtTime(Number(notchQ.value), now, 0.01);

    audioGraph.peak.type =
        !bypassed && peakEnabled.checked ? "peaking" : "allpass";
    audioGraph.peak.frequency.setTargetAtTime(
        Number(peakFrequency.value),
        now,
        0.01
    );
    audioGraph.peak.gain.setTargetAtTime(Number(peakGain.value), now, 0.01);
    audioGraph.peak.Q.setTargetAtTime(Number(peakQ.value), now, 0.01);

    const compressionActive = !bypassed && compressorEnabled.checked;
    audioGraph.dryGain.gain.setTargetAtTime(
        compressionActive ? 0 : 1,
        now,
        0.01
    );
    audioGraph.compressedGain.gain.setTargetAtTime(
        compressionActive ? 1 : 0,
        now,
        0.01
    );
}

function applyAllAudioSettings() {
    applyChannelRouting();
    applyGainSettings();
    applyFilterSettings();

    const shouldPreserve = preservePitch.checked;
    mediaElement.preservesPitch = shouldPreserve;
    mediaElement.mozPreservesPitch = shouldPreserve;
    mediaElement.webkitPreservesPitch = shouldPreserve;
}

function setPreset(name) {
    const presets = {
        bypass: {
            highpass: false,
            highpassFrequency: 100,
            lowpass: false,
            lowpassFrequency: 6000,
            notch: false,
            notchFrequency: 1000,
            notchQ: 8,
            peak: false,
            peakFrequency: 2500,
            peakGain: 4,
            peakQ: 1.2,
            compressor: false,
            bypass: true
        },
        "speech-mild": {
            highpass: true,
            highpassFrequency: 100,
            lowpass: true,
            lowpassFrequency: 6000,
            notch: false,
            notchFrequency: 1000,
            notchQ: 8,
            peak: true,
            peakFrequency: 2500,
            peakGain: 4,
            peakQ: 1.2,
            compressor: false,
            bypass: false
        },
        "speech-narrow": {
            highpass: true,
            highpassFrequency: 180,
            lowpass: true,
            lowpassFrequency: 4200,
            notch: false,
            notchFrequency: 1000,
            notchQ: 8,
            peak: true,
            peakFrequency: 2200,
            peakGain: 6,
            peakQ: 1.6,
            compressor: true,
            bypass: false
        },
        rumble: {
            highpass: true,
            highpassFrequency: 180,
            lowpass: false,
            lowpassFrequency: 6000,
            notch: false,
            notchFrequency: 1000,
            notchQ: 8,
            peak: false,
            peakFrequency: 2500,
            peakGain: 4,
            peakQ: 1.2,
            compressor: false,
            bypass: false
        },
        telephone: {
            highpass: true,
            highpassFrequency: 300,
            lowpass: true,
            lowpassFrequency: 3400,
            notch: false,
            notchFrequency: 1000,
            notchQ: 8,
            peak: true,
            peakFrequency: 1800,
            peakGain: 3,
            peakQ: 1,
            compressor: false,
            bypass: false
        }
    };

    const preset = presets[name];

    if (!preset) {
        return;
    }

    highpassEnabled.checked = preset.highpass;
    highpassFrequency.value = String(preset.highpassFrequency);
    lowpassEnabled.checked = preset.lowpass;
    lowpassFrequency.value = String(preset.lowpassFrequency);
    notchEnabled.checked = preset.notch;
    notchFrequency.value = String(preset.notchFrequency);
    notchQ.value = String(preset.notchQ);
    peakEnabled.checked = preset.peak;
    peakFrequency.value = String(preset.peakFrequency);
    peakGain.value = String(preset.peakGain);
    peakQ.value = String(preset.peakQ);
    compressorEnabled.checked = preset.compressor;
    bypassFilters.checked = preset.bypass;

    applyFilterSettings();
}

function markPresetCustom() {
    filterPreset.value = "custom";
    applyFilterSettings();
}

function resetAllProcessing() {
    channelMode.value = "stereo";
    channel1Gain.value = "0";
    channel2Gain.value = "0";
    masterGain.value = "0";
    filterPreset.value = "bypass";
    preservePitch.checked = true;
    setPreset("bypass");
    applyAllAudioSettings();
}

function drawSpectrum() {
    spectrumAnimationFrame = requestAnimationFrame(drawSpectrum);

    const canvas = spectrumCanvas;
    const context2d = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const displayWidth = Math.max(canvas.clientWidth, 320);
    const displayHeight = Math.max(canvas.clientHeight, 180);

    if (
        canvas.width !== Math.floor(displayWidth * ratio) ||
        canvas.height !== Math.floor(displayHeight * ratio)
    ) {
        canvas.width = Math.floor(displayWidth * ratio);
        canvas.height = Math.floor(displayHeight * ratio);
    }

    context2d.setTransform(ratio, 0, 0, ratio, 0, 0);
    context2d.clearRect(0, 0, displayWidth, displayHeight);
    context2d.fillStyle = "#090c0f";
    context2d.fillRect(0, 0, displayWidth, displayHeight);

    context2d.strokeStyle = "#27313a";
    context2d.lineWidth = 1;

    for (let index = 1; index < 5; index += 1) {
        const y = (displayHeight * index) / 5;
        context2d.beginPath();
        context2d.moveTo(0, y);
        context2d.lineTo(displayWidth, y);
        context2d.stroke();
    }

    if (!audioGraph) {
        context2d.fillStyle = "#84919d";
        context2d.font = "13px system-ui";
        context2d.fillText(
            "Press Play or change a signal control to activate the analyzer.",
            16,
            28
        );
        return;
    }

    const analyser = audioGraph.analyser;
    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(data);

    const nyquist = audioGraph.context.sampleRate / 2;
    const maxFrequency = Math.min(
        Number(spectrumMaxFrequency.value),
        nyquist
    );
    const maxBin = Math.max(
        1,
        Math.floor((maxFrequency / nyquist) * data.length)
    );

    const minDb = analyser.minDecibels;
    const maxDb = analyser.maxDecibels;

    context2d.beginPath();

    for (let x = 0; x < displayWidth; x += 1) {
        const bin = Math.min(
            maxBin - 1,
            Math.floor((x / displayWidth) * maxBin)
        );
        const db = Number.isFinite(data[bin]) ? data[bin] : minDb;
        const normalized = clamp((db - minDb) / (maxDb - minDb), 0, 1);
        const y = displayHeight - normalized * (displayHeight - 22);

        if (x === 0) {
            context2d.moveTo(x, y);
        }
        else {
            context2d.lineTo(x, y);
        }
    }

    context2d.strokeStyle = "#e0b660";
    context2d.lineWidth = 1.5;
    context2d.stroke();

    context2d.fillStyle = "#8f9ba6";
    context2d.font = "11px system-ui";

    [0, 0.25, 0.5, 0.75, 1].forEach((fraction) => {
        const frequency = maxFrequency * fraction;
        const x = displayWidth * fraction;
        const label =
            frequency >= 1000
                ? `${(frequency / 1000).toFixed(
                    Number.isInteger(frequency / 1000) ? 0 : 1
                )}k`
                : `${Math.round(frequency)}`;

        context2d.fillText(label, Math.min(x + 3, displayWidth - 28), 14);
    });
}

function computeChannelStatistics(samples, startIndex, endIndex) {
    const count = Math.max(0, endIndex - startIndex);

    if (count === 0) {
        return null;
    }

    const stride = Math.max(1, Math.ceil(count / 2_000_000));
    let peak = 0;
    let sumSquares = 0;
    let sum = 0;
    let zeroCrossings = 0;
    let previous = samples[startIndex] || 0;
    let sampledCount = 0;

    for (let index = startIndex; index < endIndex; index += stride) {
        const sample = samples[index] || 0;
        const absolute = Math.abs(sample);

        peak = Math.max(peak, absolute);
        sumSquares += sample * sample;
        sum += sample;

        if (
            (previous < 0 && sample >= 0) ||
            (previous >= 0 && sample < 0)
        ) {
            zeroCrossings += 1;
        }

        previous = sample;
        sampledCount += 1;
    }

    const rms = Math.sqrt(sumSquares / Math.max(sampledCount, 1));
    const dc = sum / Math.max(sampledCount, 1);
    const crest = rms > 0 ? peak / rms : 0;

    return {
        peak,
        peakDb: gainToDb(peak),
        rms,
        rmsDb: gainToDb(rms),
        dc,
        crest,
        zeroCrossings,
        stride,
        sampledCount
    };
}

function renderChannelStatistics(target, statistics) {
    if (!statistics) {
        Object.values(target).forEach((element) => {
            element.textContent = "—";
        });
        return;
    }

    target.peak.textContent = formatDb(statistics.peakDb);
    target.rms.textContent = formatDb(statistics.rmsDb);
    target.crest.textContent = `${statistics.crest.toFixed(2)}×`;
    target.dc.textContent = statistics.dc.toExponential(3);
    target.zeroCrossings.textContent =
        statistics.zeroCrossings.toLocaleString();
}

function analyzeSelection() {
    if (!decodedAudio || !activeRegion) {
        latestStatistics = null;
        analysisStatus.textContent = "Waiting for selection";
        return;
    }

    analysisStatus.textContent = "Calculating…";

    const sampleRate = decodedAudio.sampleRate;
    const startIndex = clamp(
        Math.floor(activeRegion.start * sampleRate),
        0,
        decodedAudio.length
    );
    const endIndex = clamp(
        Math.ceil(activeRegion.end * sampleRate),
        startIndex + 1,
        decodedAudio.length
    );

    const channel1Samples = decodedAudio.getChannelData(0);
    const channel2Samples =
        decodedAudio.numberOfChannels > 1
            ? decodedAudio.getChannelData(1)
            : channel1Samples;

    const channel1Statistics = computeChannelStatistics(
        channel1Samples,
        startIndex,
        endIndex
    );
    const channel2Statistics = computeChannelStatistics(
        channel2Samples,
        startIndex,
        endIndex
    );

    latestStatistics = {
        start: activeRegion.start,
        end: activeRegion.end,
        duration: activeRegion.end - activeRegion.start,
        sampleRate,
        sourceChannels: decodedAudio.numberOfChannels,
        channel1: channel1Statistics,
        channel2: channel2Statistics
    };

    renderChannelStatistics(statElements.channel1, channel1Statistics);
    renderChannelStatistics(statElements.channel2, channel2Statistics);

    const approximate =
        channel1Statistics?.stride > 1 ||
        channel2Statistics?.stride > 1;

    analysisStatus.textContent = approximate
        ? "Calculated · regularly sampled"
        : "Calculated · every sample";
}

function scheduleSelectionAnalysis() {
    window.clearTimeout(analysisTimer);
    analysisTimer = window.setTimeout(analyzeSelection, 120);
}

function getEffectiveExportMode() {
    return exportMode.value === "current"
        ? channelMode.value
        : exportMode.value;
}

function getSelectionSampleData(mode) {
    if (!decodedAudio || !activeRegion) {
        throw new Error("No decoded selection is available.");
    }

    const sampleRate = decodedAudio.sampleRate;
    const startIndex = clamp(
        Math.floor(activeRegion.start * sampleRate),
        0,
        decodedAudio.length
    );
    const endIndex = clamp(
        Math.ceil(activeRegion.end * sampleRate),
        startIndex + 1,
        decodedAudio.length
    );
    const length = endIndex - startIndex;

    if (length / sampleRate > 120) {
        throw new Error(
            "WAV export is limited to 120 seconds. Select a shorter interval."
        );
    }

    const left = decodedAudio.getChannelData(0);
    const right =
        decodedAudio.numberOfChannels > 1
            ? decodedAudio.getChannelData(1)
            : left;

    if (mode === "stereo") {
        return {
            sampleRate,
            channels: [
                left.slice(startIndex, endIndex),
                right.slice(startIndex, endIndex)
            ]
        };
    }

    const output = new Float32Array(length);

    for (let index = 0; index < length; index += 1) {
        const leftSample = left[startIndex + index] || 0;
        const rightSample = right[startIndex + index] || 0;

        switch (mode) {
            case "channel1":
                output[index] = leftSample;
                break;
            case "channel2":
                output[index] = rightSample;
                break;
            case "mono":
                output[index] = 0.5 * (leftSample + rightSample);
                break;
            case "difference":
                output[index] = 0.5 * (leftSample - rightSample);
                break;
            case "reverse-difference":
                output[index] = 0.5 * (rightSample - leftSample);
                break;
            default:
                output[index] = 0.5 * (leftSample + rightSample);
                break;
        }
    }

    return {
        sampleRate,
        channels: [output]
    };
}

function writeAscii(view, offset, text) {
    for (let index = 0; index < text.length; index += 1) {
        view.setUint8(offset + index, text.charCodeAt(index));
    }
}

function encodeWav(channelData, sampleRate) {
    const numberOfChannels = channelData.length;
    const frameCount = channelData[0].length;
    const bytesPerSample = 2;
    const dataSize = frameCount * numberOfChannels * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(
        28,
        sampleRate * numberOfChannels * bytesPerSample,
        true
    );
    view.setUint16(32, numberOfChannels * bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;

    for (let frame = 0; frame < frameCount; frame += 1) {
        for (let channel = 0; channel < numberOfChannels; channel += 1) {
            const sample = clamp(channelData[channel][frame], -1, 1);
            const integer =
                sample < 0
                    ? Math.round(sample * 32768)
                    : Math.round(sample * 32767);

            view.setInt16(offset, integer, true);
            offset += 2;
        }
    }

    return new Blob([buffer], { type: "audio/wav" });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

async function sha256Hex(blob) {
    const bytes = await blob.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(hash))
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
}

function safeFilenameTime(seconds) {
    return Number(seconds).toFixed(2).replace(".", "-");
}

function collectSettings() {
    return {
        channelMode: channelMode.value,
        channel1GainDb: Number(channel1Gain.value),
        channel2GainDb: Number(channel2Gain.value),
        masterGainDb: Number(masterGain.value),
        playbackRate: Number(playbackRate.value),
        preservePitch: preservePitch.checked,
        filtersBypassed: bypassFilters.checked,
        preset: filterPreset.value,
        highpass: {
            enabled: highpassEnabled.checked,
            frequencyHz: Number(highpassFrequency.value)
        },
        lowpass: {
            enabled: lowpassEnabled.checked,
            frequencyHz: Number(lowpassFrequency.value)
        },
        notch: {
            enabled: notchEnabled.checked,
            frequencyHz: Number(notchFrequency.value),
            q: Number(notchQ.value)
        },
        presencePeak: {
            enabled: peakEnabled.checked,
            frequencyHz: Number(peakFrequency.value),
            gainDb: Number(peakGain.value),
            q: Number(peakQ.value)
        },
        compressorEnabled: compressorEnabled.checked
    };
}

function buildAnalysisReport() {
    if (!activeRegion) {
        throw new Error("Create a selection first.");
    }

    return {
        schema: "nolan_wells_browser_selection_analysis_v1",
        generatedAt: new Date().toISOString(),
        source: {
            workingMedia: "assets/audio/full-recording.mp3",
            provenance:
                "YouTube-derived working source; not represented as the native MDMR file."
        },
        selection: {
            startSeconds: activeRegion.start,
            endSeconds: activeRegion.end,
            durationSeconds: activeRegion.end - activeRegion.start
        },
        settings: collectSettings(),
        measuredStatistics: latestStatistics,
        lastExportSha256: latestExportHash,
        cautions: [
            "Browser filters are conventional non-generative DSP.",
            "Filtering cannot restore discarded information.",
            "Extreme settings may emphasize codec or phase artifacts.",
            "Transcription remains a human interpretation, not a measurement."
        ]
    };
}

function applyDeepLink() {
    const parameters = new URLSearchParams(window.location.search);
    const start = Number(parameters.get("start"));
    const end = Number(parameters.get("end"));
    const mode = parameters.get("mode");
    const zoom = Number(parameters.get("zoom"));

    if (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        end > start
    ) {
        createSelection(start, end, true);
    }

    if (
        mode &&
        [
            "stereo",
            "channel1",
            "channel2",
            "mono",
            "difference",
            "reverse-difference"
        ].includes(mode)
    ) {
        channelMode.value = mode;
        applyChannelRouting();
    }

    if (Number.isFinite(zoom) && zoom >= 1 && zoom <= 300) {
        zoomLevel.value = String(zoom);
        zoomValue.textContent = `${zoom} px/sec`;
        wavesurfer.zoom(zoom);
    }
}

regions.on("region-created", (region) => {
    if (regionBeingReplaced) {
        return;
    }

    if (activeRegion && activeRegion.id !== region.id) {
        activeRegion.remove();
    }

    activeRegion = region;
    selectionPlaybackActive = false;
    latestExportHash = null;
    updateSelectionDisplay();
});

regions.on("region-update", (region) => {
    activeRegion = region;
    updateSelectionDisplay();
});

regions.on("region-updated", (region) => {
    activeRegion = region;
    selectionPlaybackActive = false;
    latestExportHash = null;
    updateSelectionDisplay();
});

regions.on("region-clicked", (region, event) => {
    event.stopPropagation();
    activeRegion = region;
    selectionPlaybackActive = false;
    wavesurfer.setTime(region.start);
    updateSelectionDisplay();
});

regions.on("region-removed", (region) => {
    if (activeRegion?.id === region.id) {
        activeRegion = null;
        selectionPlaybackActive = false;
        latestStatistics = null;
        updateSelectionDisplay();
    }
});

regions.on("region-out", async (region) => {
    if (
        selectionPlaybackActive &&
        activeRegion?.id === region.id &&
        loopSelection.checked
    ) {
        await playActiveSelection();
    }
    else if (activeRegion?.id === region.id) {
        selectionPlaybackActive = false;
    }
});

wavesurfer.on("ready", () => {
    statusElement.classList.add("ready");
    setControlsEnabled(true);
    updateClock(0);

    decodedAudio = wavesurfer.getDecodedData();

    regions.enableDragSelection(
        {
            color: "rgba(231, 189, 98, 0.28)",
            drag: true,
            resize: true,
            minLength: 0.02
        },
        3
    );

    createSelection(0.08, 1.62, false);
    applyDeepLink();
    drawSpectrum();
});

wavesurfer.on("error", (error) => {
    statusElement.textContent =
        `The waveform could not load. Use the standard player below. ${error}`;
});

wavesurfer.on("timeupdate", (time) => {
    updateClock(time);

    if (
        selectionPlaybackActive &&
        activeRegion &&
        time >= activeRegion.end - 0.015
    ) {
        if (loopSelection.checked) {
            wavesurfer.setTime(activeRegion.start);
        }
        else {
            selectionPlaybackActive = false;
        }
    }
});

wavesurfer.on("play", () => {
    playPauseButton.textContent = "Pause";
});

wavesurfer.on("pause", () => {
    playPauseButton.textContent = "Play";
});

wavesurfer.on("finish", async () => {
    if (selectionPlaybackActive && activeRegion && loopSelection.checked) {
        await playActiveSelection();
    }
    else {
        selectionPlaybackActive = false;
    }
});

playPauseButton.addEventListener("click", async () => {
    await ensureAudioGraph();
    selectionPlaybackActive = false;
    await wavesurfer.playPause();
});

stopButton.addEventListener("click", () => {
    selectionPlaybackActive = false;
    wavesurfer.stop();
});

backFiveButton.addEventListener("click", () => {
    selectionPlaybackActive = false;
    wavesurfer.setTime(
        clamp(wavesurfer.getCurrentTime() - 5, 0, wavesurfer.getDuration())
    );
});

forwardFiveButton.addEventListener("click", () => {
    selectionPlaybackActive = false;
    wavesurfer.setTime(
        clamp(wavesurfer.getCurrentTime() + 5, 0, wavesurfer.getDuration())
    );
});

playbackRate.addEventListener("change", () => {
    wavesurfer.setPlaybackRate(Number(playbackRate.value), true);
});

applySelectionButton.addEventListener("click", () => {
    const start = Number(selectionStart.value);
    const end = Number(selectionEnd.value);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        window.alert("Selection end must be greater than selection start.");
        return;
    }

    selectionPlaybackActive = false;
    createSelection(start, end, true);
});

playSelectionButton.addEventListener("click", playActiveSelection);

clearSelectionButton.addEventListener("click", () => {
    selectionPlaybackActive = false;
    regions.clearRegions();
    activeRegion = null;
    latestStatistics = null;
    updateSelectionDisplay();
});

zoomLevel.addEventListener("input", () => {
    const value = Number(zoomLevel.value);
    zoomValue.textContent = `${value} px/sec`;
    wavesurfer.zoom(value);
});

zoomSelectionButton.addEventListener("click", zoomToActiveSelection);

resetZoomButton.addEventListener("click", () => {
    zoomLevel.value = "1";
    zoomValue.textContent = "1 px/sec";
    wavesurfer.zoom(1);
    wavesurfer.setScroll(0);
});

bookmarkButtons.forEach((button) => {
    button.addEventListener("click", () => {
        createSelection(
            Number(button.dataset.start),
            Number(button.dataset.end),
            true
        );
        zoomToActiveSelection();
    });
});

openFullButtons.forEach((button) => {
    button.addEventListener("click", () => {
        get("full-recording").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        createSelection(
            Number(button.dataset.start),
            Number(button.dataset.end),
            true
        );

        window.setTimeout(zoomToActiveSelection, 350);
    });
});

channelMode.addEventListener("change", async () => {
    await ensureAudioGraph();
    applyChannelRouting();
});

[channel1Gain, channel2Gain, masterGain].forEach((control) => {
    control.addEventListener("input", async () => {
        await ensureAudioGraph();
        applyGainSettings();
    });
});

focusChannel2Button.addEventListener("click", async () => {
    channelMode.value = "channel2";
    channel1Gain.value = "0";
    channel2Gain.value = "0";
    await ensureAudioGraph();
    applyChannelRouting();
    applyGainSettings();
});

restoreStereoButton.addEventListener("click", async () => {
    channelMode.value = "stereo";
    channel1Gain.value = "0";
    channel2Gain.value = "0";
    await ensureAudioGraph();
    applyChannelRouting();
    applyGainSettings();
});

swapChannelsButton.addEventListener("click", async () => {
    const currentLeft = channel1Gain.value;
    channel1Gain.value = channel2Gain.value;
    channel2Gain.value = currentLeft;

    if (channelMode.value === "channel1") {
        channelMode.value = "channel2";
    }
    else if (channelMode.value === "channel2") {
        channelMode.value = "channel1";
    }

    await ensureAudioGraph();
    applyChannelRouting();
    applyGainSettings();
});

filterPreset.addEventListener("change", async () => {
    await ensureAudioGraph();

    if (filterPreset.value !== "custom") {
        setPreset(filterPreset.value);
    }
});

preservePitch.addEventListener("change", async () => {
    await ensureAudioGraph();
    applyAllAudioSettings();
});

bypassFilters.addEventListener("change", async () => {
    await ensureAudioGraph();
    applyFilterSettings();
});

compressorEnabled.addEventListener("change", async () => {
    await ensureAudioGraph();
    markPresetCustom();
});

[
    highpassEnabled,
    highpassFrequency,
    lowpassEnabled,
    lowpassFrequency,
    notchEnabled,
    notchFrequency,
    notchQ,
    peakEnabled,
    peakFrequency,
    peakGain,
    peakQ
].forEach((control) => {
    control.addEventListener("input", async () => {
        await ensureAudioGraph();
        markPresetCustom();
    });

    control.addEventListener("change", async () => {
        await ensureAudioGraph();
        markPresetCustom();
    });
});

resetProcessingButton.addEventListener("click", async () => {
    await ensureAudioGraph();
    resetAllProcessing();
});

spectrumMaxFrequency.addEventListener("change", async () => {
    await ensureAudioGraph();
});

exportSelectionWavButton.addEventListener("click", async () => {
    try {
        const mode = getEffectiveExportMode();
        const selection = getSelectionSampleData(mode);
        const blob = encodeWav(selection.channels, selection.sampleRate);

        exportStatus.textContent = "Calculating SHA-256…";
        const hash = await sha256Hex(blob);
        latestExportHash = hash;

        const filename =
            `nolan-selection-${safeFilenameTime(activeRegion.start)}-` +
            `${safeFilenameTime(activeRegion.end)}-${mode}.wav`;

        downloadBlob(blob, filename);

        exportStatus.textContent =
            `Downloaded ${filename} · SHA-256 ${hash} · ` +
            "raw channel mix; browser filters excluded.";
    }
    catch (error) {
        exportStatus.textContent = error.message;
    }
});

downloadAnalysisReportButton.addEventListener("click", () => {
    try {
        const report = buildAnalysisReport();
        const blob = new Blob(
            [JSON.stringify(report, null, 2) + "\n"],
            { type: "application/json" }
        );

        const filename =
            `nolan-selection-${safeFilenameTime(activeRegion.start)}-` +
            `${safeFilenameTime(activeRegion.end)}-report.json`;

        downloadBlob(blob, filename);
        exportStatus.textContent = `Downloaded ${filename}`;
    }
    catch (error) {
        exportStatus.textContent = error.message;
    }
});

copySelectionLinkButton.addEventListener("click", async () => {
    if (!activeRegion) {
        exportStatus.textContent = "Create a selection first.";
        return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("start", activeRegion.start.toFixed(2));
    url.searchParams.set("end", activeRegion.end.toFixed(2));
    url.searchParams.set("mode", channelMode.value);
    url.searchParams.set("zoom", zoomLevel.value);

    try {
        await navigator.clipboard.writeText(url.toString());
        exportStatus.textContent = `Copied: ${url}`;
    }
    catch {
        window.prompt("Copy this interval link:", url.toString());
    }
});

window.addEventListener("beforeunload", () => {
    if (spectrumAnimationFrame) {
        cancelAnimationFrame(spectrumAnimationFrame);
    }

    if (audioGraph?.context) {
        audioGraph.context.close();
    }
});

updateSignalPathStatus();
applyGainSettings();
applyFilterSettings();
