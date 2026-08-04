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


// machine-hypotheses-v1
const hypothesisSearch = document.getElementById("hypothesis-search");
const hypothesisDisplayFilter = document.getElementById("hypothesis-display-filter");
const showWordSlots = document.getElementById("show-word-slots");
const expandAllHypotheses = document.getElementById("expand-all-hypotheses");
const collapseAllHypotheses = document.getElementById("collapse-all-hypotheses");
const hypothesisLoadStatus = document.getElementById("hypothesis-load-status");
const hypothesisRunSummary = document.getElementById("hypothesis-run-summary");
const hypothesisSegmentsContainer = document.getElementById("hypothesis-segments");
const hypothesisProvenance = document.getElementById("hypothesis-provenance");
const hypothesisProvenanceJson = document.getElementById("hypothesis-provenance-json");
let hypothesisPackage = null;
let renderedHypothesisSegments = [];

function hElement(tag, options = {}) {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.text !== undefined) element.textContent = String(options.text);
    if (options.type) element.type = options.type;
    return element;
}

function hypothesisTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds - minutes * 60;
    return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(2).padStart(5, "0")}`;
}

function agreementClass(band) {
    if (band.includes("strong")) return "strong";
    if (band.includes("substantial")) return "disagreement";
    return "mixed";
}

function appendRunSummary(packageData) {
    hypothesisRunSummary.textContent = "";
    hypothesisRunSummary.className = "hypothesis-run-summary";
    [
        ["Status", packageData.status],
        ["Generated", packageData.generated_at_utc],
        ["Source SHA-256", packageData.source.sha256],
        ["Channel 2 SHA-256", packageData.channel_extraction.sha256]
    ].forEach(([heading, value]) => {
        const card = hElement("div");
        card.append(hElement("strong", { text: heading }), hElement("span", { text: value }));
        hypothesisRunSummary.append(card);
    });
    hypothesisRunSummary.hidden = false;
}

function renderContextualHypotheses(segment) {
    const section = hElement("section", { className: "hypothesis-subsection" });
    section.append(hElement("h3", { text: "Contextual word hypotheses" }));
    const list = hElement("ol", { className: "hypothesis-list" });
    segment.contextual_hypotheses.forEach((hypothesis) => {
        const item = hElement("li");
        item.append(hElement("strong", { text: `${hypothesis.rank}. ${hypothesis.text || "[empty]"}` }));
        const sources = hypothesis.sources.map((source) =>
            `${source.run_id}; avg log probability ${source.avg_logprob.toFixed(3)}; no-speech ${source.no_speech_prob.toFixed(3)}`
        );
        item.append(hElement("span", {
            className: "hypothesis-source-line",
            text: `${hypothesis.supporting_runs} supporting configured run(s). ${sources.join(" | ")}`
        }));
        list.append(item);
    });
    if (segment.contextual_hypotheses.length === 0) {
        list.append(hElement("li", { text: "No contextual text hypothesis was retained." }));
    }
    section.append(list);
    return section;
}

function renderPhonemeHypotheses(segment) {
    const section = hElement("section", { className: "hypothesis-subsection" });
    section.append(hElement("h3", { text: "Independent CTC phoneme hypotheses" }));
    const list = hElement("ol", { className: "hypothesis-list" });
    segment.phoneme_hypotheses.forEach((hypothesis) => {
        const item = hElement("li");
        item.append(hElement("code", { text: hypothesis.phonemes }));
        item.append(hElement("span", {
            className: "hypothesis-source-line",
            text: `Rank ${hypothesis.rank}; relative CTC log score ${hypothesis.relative_log_score.toFixed(3)}. This is not a word probability.`
        }));
        list.append(item);
    });
    if (segment.phoneme_hypotheses.length === 0) {
        list.append(hElement("li", { text: "No phoneme hypothesis was retained." }));
    }
    section.append(list);
    return section;
}

function renderWordSlots(segment) {
    const section = hElement("section", { className: "hypothesis-subsection word-slot-section" });
    section.append(hElement("h3", { text: "Time-aligned word alternatives" }));
    const wrapper = hElement("div", { className: "table-wrap" });
    const table = hElement("table", { className: "word-slot-table" });
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Interval", "Generated alternatives", "Scope"].forEach((heading) => headRow.append(hElement("th", { text: heading })));
    head.append(headRow);
    table.append(head);
    const body = document.createElement("tbody");
    segment.word_alternative_slots.forEach((slot) => {
        const row = document.createElement("tr");
        row.append(hElement("td", { text: `${hypothesisTime(slot.start)}–${hypothesisTime(slot.end)}` }));
        const alternativesCell = document.createElement("td");
        slot.alternatives.forEach((alternative) => {
            alternativesCell.append(hElement("span", {
                className: "word-alternative",
                text: `${alternative.word} (${alternative.supporting_runs} run${alternative.supporting_runs === 1 ? "" : "s"})`
            }));
        });
        row.append(alternativesCell, hElement("td", { text: slot.omission_note }));
        body.append(row);
    });
    if (segment.word_alternative_slots.length === 0) {
        const row = document.createElement("tr");
        const cell = hElement("td", { text: "No word-level alternatives were available." });
        cell.colSpan = 3;
        row.append(cell);
        body.append(row);
    }
    table.append(body);
    wrapper.append(table);
    section.append(wrapper);
    return section;
}

function openHypothesisInterval(segment) {
    document.getElementById("full-recording").scrollIntoView({ behavior: "smooth", block: "start" });
    createSelection(segment.start, segment.end, true);
    if (channelMode) {
        channelMode.value = "channel2";
        ensureAudioGraph().then(() => {
            applyChannelRouting();
            applyGainSettings();
        }).catch(console.error);
    }
    window.setTimeout(zoomToActiveSelection, 350);
}

function renderHypothesisSegment(segment) {
    const details = hElement("details", { className: "hypothesis-segment" });
    details.dataset.agreement = agreementClass(segment.agreement.band);
    details.dataset.searchable = [
        ...segment.contextual_hypotheses.map((item) => item.text),
        ...segment.phoneme_hypotheses.map((item) => item.phonemes),
        ...segment.word_alternative_slots.flatMap((slot) => slot.alternatives.map((item) => item.word))
    ].join(" ").toLowerCase();

    const summary = document.createElement("summary");
    const timeButton = hElement("button", {
        className: "hypothesis-time-button",
        text: `${hypothesisTime(segment.start)}–${hypothesisTime(segment.end)}`,
        type: "button"
    });
    timeButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openHypothesisInterval(segment);
    });

    const best = segment.contextual_hypotheses[0];
    const bestText = hElement("div", { className: "hypothesis-best-text" });
    bestText.append(
        hElement("strong", { text: best?.text || "[no retained word hypothesis]" }),
        hElement("span", {
            text: `${segment.speech_status}. ${segment.contextual_hypotheses.length} distinct textual group(s); ${segment.phoneme_hypotheses.length} phoneme candidate(s).`
        })
    );
    const badge = hElement("span", {
        className: `agreement-badge ${agreementClass(segment.agreement.band)}`,
        text: segment.agreement.band
    });
    summary.append(timeButton, bestText, badge);
    details.append(summary);

    const body = hElement("div", { className: "hypothesis-body" });
    body.append(renderContextualHypotheses(segment), renderPhonemeHypotheses(segment), renderWordSlots(segment));
    const diagnostics = hElement("section", { className: "hypothesis-subsection" });
    diagnostics.append(
        hElement("h3", { text: "Interpretation limits" }),
        hElement("p", { text: `${segment.agreement.note} ${segment.phoneme_diagnostics.note || ""}` })
    );
    body.append(diagnostics);
    details.append(body);
    return details;
}

function applyHypothesisFilters() {
    const search = hypothesisSearch.value.trim().toLowerCase();
    const display = hypothesisDisplayFilter.value;
    renderedHypothesisSegments.forEach((element) => {
        const matchesSearch = !search || element.dataset.searchable.includes(search);
        const agreement = element.dataset.agreement;
        let matchesDisplay = true;
        if (display === "disagreement") matchesDisplay = agreement === "disagreement";
        else if (display === "mixed") matchesDisplay = agreement === "mixed" || agreement === "disagreement";
        else if (display === "agreement") matchesDisplay = agreement === "strong";
        element.hidden = !(matchesSearch && matchesDisplay);
    });
}

function setWordSlotVisibility() {
    document.querySelectorAll(".word-slot-section").forEach((section) => {
        section.hidden = !showWordSlots.checked;
    });
}

async function loadHypothesisPackage() {
    try {
        const response = await fetch("./assets/data/hypotheses.json", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}; the generator may not have run yet.`);
        hypothesisPackage = await response.json();
        if (hypothesisPackage.schema !== "experimental_machine_phonetic_hypotheses_v1") {
            throw new Error(`Unexpected schema: ${hypothesisPackage.schema}`);
        }
        hypothesisLoadStatus.textContent = `${hypothesisPackage.segments.length} model-selected interval(s) loaded. Displayed text remains unverified model output.`;
        appendRunSummary(hypothesisPackage);
        hypothesisSegmentsContainer.textContent = "";
        renderedHypothesisSegments = hypothesisPackage.segments.map(renderHypothesisSegment);
        renderedHypothesisSegments.forEach((element) => hypothesisSegmentsContainer.append(element));
        hypothesisProvenance.hidden = false;
        hypothesisProvenanceJson.textContent = JSON.stringify({
            schema: hypothesisPackage.schema,
            generated_at_utc: hypothesisPackage.generated_at_utc,
            status: hypothesisPackage.status,
            warnings: hypothesisPackage.warnings,
            source: hypothesisPackage.source,
            channel_extraction: hypothesisPackage.channel_extraction,
            configuration: hypothesisPackage.configuration,
            environment: hypothesisPackage.environment,
            models: hypothesisPackage.models,
            limitations: hypothesisPackage.limitations
        }, null, 2);
        [hypothesisSearch, hypothesisDisplayFilter, showWordSlots, expandAllHypotheses, collapseAllHypotheses].forEach((control) => control.disabled = false);
    } catch (error) {
        hypothesisLoadStatus.textContent = `The static hypothesis package is not available: ${error.message}`;
    }
}

hypothesisSearch?.addEventListener("input", applyHypothesisFilters);
hypothesisDisplayFilter?.addEventListener("change", applyHypothesisFilters);
showWordSlots?.addEventListener("change", setWordSlotVisibility);
expandAllHypotheses?.addEventListener("click", () => renderedHypothesisSegments.filter((element) => !element.hidden).forEach((element) => element.open = true));
collapseAllHypotheses?.addEventListener("click", () => renderedHypothesisSegments.forEach((element) => element.open = false));
if (hypothesisSegmentsContainer) loadHypothesisPackage();

// visual-refresh-v1
function initializeVisualRefresh() {
    if (document.body.classList.contains("visual-refresh")) return;
    document.body.classList.add("visual-refresh");
    document.body.id ||= "page-top";

    const hero = document.querySelector(".hero");
    const heroContainer = hero?.querySelector(".container");

    if (heroContainer && !heroContainer.querySelector(".hero-actions")) {
        const actions = document.createElement("div");
        actions.className = "hero-actions";

        [
            ["#full-recording", "Open waveform laboratory", true],
            ["#machine-hypotheses", "Review machine hypotheses", false],
            ["#background-speech-sweep", "Inspect background sweep", false]
        ].forEach(([href, label, primary]) => {
            if (!document.querySelector(href)) return;
            const link = document.createElement("a");
            link.className = `hero-action${primary ? " primary" : ""}`;
            link.href = href;
            link.textContent = label;
            actions.append(link);
        });

        const metrics = document.createElement("div");
        metrics.className = "hero-metrics";
        [
            ["9:45 source", "Complete circulated recording"],
            ["2 channels", "Independently routable"],
            ["Raw-first", "Conventional, non-generative DSP"],
            ["Disclosed output", "Models, settings, hashes, alternatives"]
        ].forEach(([title, description]) => {
            const card = document.createElement("div");
            card.className = "hero-metric";
            const strong = document.createElement("strong");
            const span = document.createElement("span");
            strong.textContent = title;
            span.textContent = description;
            card.append(strong, span);
            metrics.append(card);
        });
        heroContainer.append(actions, metrics);
    }

    const main = document.querySelector("main");
    const sections = main
        ? Array.from(main.querySelectorAll(":scope > section.section"))
        : [];

    sections.forEach((section, index) => {
        if (section.id) return;
        const text = section.querySelector("h2")?.textContent || `section-${index + 1}`;
        section.id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    });

    const labelFor = (section) => {
        const text = section.querySelector("h2")?.textContent?.trim() || "Section";
        const rules = [
            [/waveform laboratory/i, "Listen"],
            [/candidate a/i, "Candidate A"],
            [/candidate c/i, "Candidate C"],
            [/machine-generated phonetic/i, "Machine hypotheses"],
            [/background-speech sweep/i, "Background sweep"],
            [/summary/i, "Summary"],
            [/finding/i, "Findings"],
            [/method/i, "Method"],
            [/source/i, "Source"],
            [/limitation/i, "Limits"]
        ];
        return rules.find(([pattern]) => pattern.test(text))?.[1] || (text.length > 21 ? `${text.slice(0, 20)}…` : text);
    };

    if (hero && !document.querySelector(".site-section-nav")) {
        const nav = document.createElement("nav");
        nav.className = "site-section-nav";
        const inner = document.createElement("div");
        inner.className = "container site-section-nav-inner";
        const brand = document.createElement("span");
        brand.className = "site-nav-brand";
        brand.textContent = "Audio review";
        inner.append(brand);

        const preferred = ["Listen", "Summary", "Candidate A", "Candidate C", "Findings", "Machine hypotheses", "Background sweep", "Method"];
        const selected = sections.filter((section) => preferred.includes(labelFor(section)));
        (selected.length >= 3 ? selected : sections.slice(0, 8)).forEach((section) => {
            const link = document.createElement("a");
            link.className = "site-nav-link";
            link.href = `#${section.id}`;
            link.dataset.sectionId = section.id;
            link.textContent = labelFor(section);
            link.addEventListener("click", () => {
                if (section.classList.contains("is-collapsed")) {
                    section.querySelector(".section-collapse-button")?.click();
                }
            });
            inner.append(link);
        });

        const spacer = document.createElement("span");
        spacer.className = "site-nav-spacer";
        const expand = document.createElement("button");
        const compact = document.createElement("button");
        expand.className = compact.className = "site-nav-control";
        expand.type = compact.type = "button";
        expand.textContent = "Expand sections";
        compact.textContent = "Compact view";
        expand.addEventListener("click", () => document.querySelectorAll(".compactable-section.is-collapsed .section-collapse-button").forEach((button) => button.click()));
        compact.addEventListener("click", () => document.querySelectorAll(".compactable-section:not(.is-collapsed)").forEach((section) => section.querySelector(".section-collapse-button")?.click()));
        inner.append(spacer, expand, compact);
        nav.append(inner);
        hero.insertAdjacentElement("afterend", nav);
    }

    const startsOpen = (section) => {
        if (section.id === "full-recording") return true;
        return /summary|overall finding|key finding/i.test(section.querySelector("h2")?.textContent || "");
    };

    sections.forEach((section) => {
        if (section.id === "full-recording" || section.classList.contains("compactable-section")) return;
        let heading = section.querySelector(":scope > .section-heading");
        if (!heading) {
            const h2 = Array.from(section.children).find((child) => child.tagName === "H2");
            if (!h2) return;
            heading = document.createElement("div");
            heading.className = "compact-section-heading";
            section.insertBefore(heading, h2);
            heading.append(h2);
        }

        const body = document.createElement("div");
        body.className = "section-body";
        Array.from(section.children).filter((child) => child !== heading).forEach((child) => body.append(child));
        section.append(body);
        section.classList.add("compactable-section");

        const button = document.createElement("button");
        button.className = "section-collapse-button";
        button.type = "button";
        const setOpen = (open) => {
            section.classList.toggle("is-collapsed", !open);
            body.hidden = !open;
            button.textContent = open ? "Collapse" : "Open";
            button.setAttribute("aria-expanded", String(open));
        };
        button.addEventListener("click", () => setOpen(section.classList.contains("is-collapsed")));
        heading.append(button);
        setOpen(startsOpen(section));
    });

    const lab = document.getElementById("full-recording");
    if (lab && !lab.querySelector(".lab-workspace")) {
        const workspace = document.createElement("div");
        workspace.className = "lab-workspace";
        const tabs = document.createElement("div");
        tabs.className = "lab-tab-list";
        tabs.setAttribute("role", "tablist");
        const panels = [];

        [
            ["listen", "Listen & select", "lab-listen-grid", [".channel-legend", ".channel-panel", ".wave-shell", ".transport", ".selection-panel", ".zoom-panel", ".bookmarks"]],
            ["enhance", "Enhance & compare", "lab-enhance-grid", [".spectrum-panel", ".processing-panel"]],
            ["measure", "Measure & export", "lab-measure-grid", [".selection-analysis-panel"]],
            ["source", "Source & fallback", "lab-measure-grid", [".fallback-player"]]
        ].forEach(([id, label, className, selectors], index) => {
            const panel = document.createElement("div");
            panel.className = `lab-tab-panel ${className}`;
            panel.id = `lab-panel-${id}`;
            panel.hidden = index !== 0;
            selectors.forEach((selector) => {
                const element = lab.querySelector(selector);
                if (element && !workspace.contains(element)) panel.append(element);
            });
            if (!panel.children.length) return;
            const button = document.createElement("button");
            button.className = `lab-tab-button${index === 0 ? " active" : ""}`;
            button.type = "button";
            button.textContent = label;
            button.addEventListener("click", () => {
                tabs.querySelectorAll(".lab-tab-button").forEach((item) => item.classList.remove("active"));
                panels.forEach((item) => item.hidden = true);
                button.classList.add("active");
                panel.hidden = false;
            });
            tabs.append(button);
            panels.push(panel);
        });
        workspace.append(tabs, ...panels);
        (lab.querySelector(".lab-intro") || lab.querySelector(".section-heading")).insertAdjacentElement("afterend", workspace);
    }

    const links = Array.from(document.querySelectorAll(".site-nav-link[data-section-id]"));
    if ("IntersectionObserver" in window && links.length) {
        const byId = new Map(links.map((link) => [link.dataset.sectionId, link]));
        const observer = new IntersectionObserver((entries) => {
            const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (!visible) return;
            links.forEach((link) => link.classList.toggle("active", link === byId.get(visible.target.id)));
        }, { rootMargin: "-18% 0px -68% 0px", threshold: [.05, .2, .5] });
        sections.forEach((section) => observer.observe(section));
    }

    if (!document.querySelector(".back-to-top")) {
        const top = document.createElement("a");
        top.className = "back-to-top";
        top.href = "#page-top";
        top.textContent = "↑";
        top.setAttribute("aria-label", "Back to top");
        document.body.append(top);
        const update = () => top.classList.toggle("visible", window.scrollY > 800);
        window.addEventListener("scroll", update, { passive: true });
        update();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeVisualRefresh, { once: true });
} else {
    initializeVisualRefresh();
}
// selection-spectrogram-v1

function initializeSelectionSpectrogram(attempt = 0) {
    if (document.getElementById("selection-spectrogram-panel")) {
        return;
    }

    const workspace = document.querySelector(
        "#full-recording .lab-workspace"
    );
    const tabList = workspace?.querySelector(".lab-tab-list");

    if (!workspace || !tabList) {
        if (attempt < 40) {
            window.setTimeout(
                () => initializeSelectionSpectrogram(attempt + 1),
                100
            );
        }
        return;
    }

    const tabButton = document.createElement("button");
    tabButton.className = "lab-tab-button spectrogram-tab-button";
    tabButton.type = "button";
    tabButton.setAttribute("role", "tab");
    tabButton.setAttribute(
        "aria-controls",
        "selection-spectrogram-panel"
    );
    tabButton.setAttribute("aria-selected", "false");
    tabButton.textContent = "Spectrogram";

    const panel = document.createElement("div");
    panel.id = "selection-spectrogram-panel";
    panel.className = "lab-tab-panel spectrogram-lab-panel";
    panel.setAttribute("role", "tabpanel");
    panel.hidden = true;

    panel.innerHTML = `
        <section class="forensic-panel spectrogram-panel">
            <div class="forensic-panel-heading">
                <div>
                    <p class="eyebrow">Raw decoded samples</p>
                    <h3>Selection spectrogram</h3>
                </div>
                <output
                    id="spectrogram-state"
                    class="processing-state"
                >
                    Waiting for audio
                </output>
            </div>

            <p class="panel-description">
                This view plots frequency vertically and time horizontally
                from the selected raw samples. Dark areas mean energy falls
                below the current display range; they do not imply that time
                was removed. No audio is modified by this analyzer.
            </p>

            <div class="spectrogram-presets">
                <button
                    id="spectrogram-first-18"
                    type="button"
                    disabled
                >
                    Select and render first 18 seconds
                </button>
                <button
                    id="spectrogram-render"
                    type="button"
                    disabled
                >
                    Render current selection
                </button>
                <button
                    id="spectrogram-export"
                    type="button"
                    disabled
                >
                    Download PNG
                </button>

                <label class="checkbox-control">
                    <input
                        id="spectrogram-auto-render"
                        type="checkbox"
                        checked
                        disabled
                    >
                    Re-render after selection changes
                </label>
            </div>

            <div class="spectrogram-control-grid">
                <label>
                    Input
                    <select id="spectrogram-channel" disabled>
                        <option value="channel2" selected>
                            Channel 2 — nearby microphone
                        </option>
                        <option value="channel1">
                            Channel 1 — call/hold-music side
                        </option>
                        <option value="mono">
                            Mono average — (L + R) / 2
                        </option>
                        <option value="difference">
                            Difference — L − R
                        </option>
                    </select>
                </label>

                <label>
                    FFT size
                    <select id="spectrogram-fft-size" disabled>
                        <option value="512">512 — more time detail</option>
                        <option value="1024">1024</option>
                        <option value="2048" selected>
                            2048 — balanced
                        </option>
                        <option value="4096">
                            4096 — more frequency detail
                        </option>
                    </select>
                </label>

                <label>
                    Window overlap
                    <select id="spectrogram-overlap" disabled>
                        <option value="0.5">50%</option>
                        <option value="0.75" selected>75%</option>
                        <option value="0.875">87.5%</option>
                    </select>
                </label>

                <label>
                    Maximum frequency
                    <select id="spectrogram-max-frequency" disabled>
                        <option value="4000">4 kHz</option>
                        <option value="8000" selected>8 kHz</option>
                        <option value="12000">12 kHz</option>
                        <option value="20000">20 kHz</option>
                    </select>
                </label>

                <label>
                    Palette
                    <select id="spectrogram-palette" disabled>
                        <option value="inferno" selected>
                            Inferno
                        </option>
                        <option value="ocean">Ocean</option>
                        <option value="grayscale">Grayscale</option>
                    </select>
                </label>

                <label class="checkbox-control">
                    <input
                        id="spectrogram-auto-contrast"
                        type="checkbox"
                        checked
                        disabled
                    >
                    Auto contrast per selection
                </label>

                <label>
                    Fixed floor
                    <span class="range-row">
                        <input
                            id="spectrogram-floor"
                            type="range"
                            min="-140"
                            max="-45"
                            value="-105"
                            step="1"
                            disabled
                        >
                        <output id="spectrogram-floor-value">
                            −105 dB
                        </output>
                    </span>
                </label>

                <label>
                    Fixed ceiling
                    <span class="range-row">
                        <input
                            id="spectrogram-ceiling"
                            type="range"
                            min="-70"
                            max="0"
                            value="-20"
                            step="1"
                            disabled
                        >
                        <output id="spectrogram-ceiling-value">
                            −20 dB
                        </output>
                    </span>
                </label>
            </div>

            <div class="spectrogram-canvas-shell">
                <canvas
                    id="selection-spectrogram-canvas"
                    width="1200"
                    height="520"
                    aria-label="Spectrogram of the current audio selection"
                ></canvas>
                <div
                    id="spectrogram-placeholder"
                    class="spectrogram-placeholder"
                >
                    Select a passage, then render it.
                </div>
            </div>

            <div
                id="spectrogram-summary"
                class="spectrogram-summary"
            >
                No spectrogram has been rendered.
            </div>

            <div class="warning-strip">
                A spectrogram changes the visual representation, not the
                source. Contrast settings can make weak energy easier to see,
                but they can also make noise appear prominent. Compare
                displays using the same fixed scale when making evidentiary
                comparisons.
            </div>
        </section>
    `;

    workspace.append(panel);
    tabList.append(tabButton);

    const canvas = document.getElementById(
        "selection-spectrogram-canvas"
    );
    const context = canvas.getContext("2d", {
        alpha: false
    });

    const state = document.getElementById("spectrogram-state");
    const placeholder = document.getElementById(
        "spectrogram-placeholder"
    );
    const summary = document.getElementById("spectrogram-summary");
    const first18Button = document.getElementById(
        "spectrogram-first-18"
    );
    const renderButton = document.getElementById(
        "spectrogram-render"
    );
    const exportButton = document.getElementById(
        "spectrogram-export"
    );
    const autoRender = document.getElementById(
        "spectrogram-auto-render"
    );
    const channelSelect = document.getElementById(
        "spectrogram-channel"
    );
    const fftSizeSelect = document.getElementById(
        "spectrogram-fft-size"
    );
    const overlapSelect = document.getElementById(
        "spectrogram-overlap"
    );
    const maxFrequencySelect = document.getElementById(
        "spectrogram-max-frequency"
    );
    const paletteSelect = document.getElementById(
        "spectrogram-palette"
    );
    const autoContrast = document.getElementById(
        "spectrogram-auto-contrast"
    );
    const floorControl = document.getElementById(
        "spectrogram-floor"
    );
    const ceilingControl = document.getElementById(
        "spectrogram-ceiling"
    );
    const floorValue = document.getElementById(
        "spectrogram-floor-value"
    );
    const ceilingValue = document.getElementById(
        "spectrogram-ceiling-value"
    );

    const controls = [
        first18Button,
        renderButton,
        autoRender,
        channelSelect,
        fftSizeSelect,
        overlapSelect,
        maxFrequencySelect,
        paletteSelect,
        autoContrast,
        floorControl,
        ceilingControl
    ];

    let lastRender = null;
    let scheduledRender = null;
    const hannCache = new Map();

    const setAnalyzerEnabled = (enabled) => {
        controls.forEach((control) => {
            control.disabled = !enabled;
        });
        exportButton.disabled = !enabled || !lastRender;
        state.textContent = enabled
            ? "Ready"
            : "Waiting for audio";
    };

    const showTab = () => {
        workspace
            .querySelectorAll(".lab-tab-panel")
            .forEach((otherPanel) => {
                otherPanel.hidden = true;
            });

        tabList
            .querySelectorAll(".lab-tab-button")
            .forEach((otherButton) => {
                otherButton.classList.remove("active");
                otherButton.setAttribute(
                    "aria-selected",
                    "false"
                );
            });

        panel.hidden = false;
        tabButton.classList.add("active");
        tabButton.setAttribute("aria-selected", "true");

        if (decodedAudio && activeRegion && !lastRender) {
            window.setTimeout(renderSpectrogram, 40);
        }
    };

    tabButton.addEventListener("click", showTab);

    function getHann(size) {
        if (hannCache.has(size)) {
            return hannCache.get(size);
        }

        const windowValues = new Float64Array(size);

        for (let index = 0; index < size; index += 1) {
            windowValues[index] =
                0.5 -
                0.5 *
                    Math.cos(
                        (2 * Math.PI * index) / (size - 1)
                    );
        }

        hannCache.set(size, windowValues);
        return windowValues;
    }

    function fftInPlace(real, imaginary) {
        const size = real.length;
        let target = 0;

        for (let index = 1; index < size; index += 1) {
            let bit = size >> 1;

            while (target & bit) {
                target ^= bit;
                bit >>= 1;
            }

            target ^= bit;

            if (index < target) {
                const realValue = real[index];
                real[index] = real[target];
                real[target] = realValue;

                const imaginaryValue = imaginary[index];
                imaginary[index] = imaginary[target];
                imaginary[target] = imaginaryValue;
            }
        }

        for (
            let blockSize = 2;
            blockSize <= size;
            blockSize <<= 1
        ) {
            const angle = (-2 * Math.PI) / blockSize;
            const blockCosine = Math.cos(angle);
            const blockSine = Math.sin(angle);
            const half = blockSize >> 1;

            for (
                let blockStart = 0;
                blockStart < size;
                blockStart += blockSize
            ) {
                let cosine = 1;
                let sine = 0;

                for (
                    let offset = 0;
                    offset < half;
                    offset += 1
                ) {
                    const evenIndex = blockStart + offset;
                    const oddIndex = evenIndex + half;

                    const oddReal =
                        real[oddIndex] * cosine -
                        imaginary[oddIndex] * sine;
                    const oddImaginary =
                        real[oddIndex] * sine +
                        imaginary[oddIndex] * cosine;

                    const evenReal = real[evenIndex];
                    const evenImaginary =
                        imaginary[evenIndex];

                    real[evenIndex] =
                        evenReal + oddReal;
                    imaginary[evenIndex] =
                        evenImaginary + oddImaginary;
                    real[oddIndex] =
                        evenReal - oddReal;
                    imaginary[oddIndex] =
                        evenImaginary - oddImaginary;

                    const nextCosine =
                        cosine * blockCosine -
                        sine * blockSine;
                    sine =
                        cosine * blockSine +
                        sine * blockCosine;
                    cosine = nextCosine;
                }
            }
        }
    }

    function percentile(values, probability) {
        if (!values.length) {
            return 0;
        }

        values.sort((first, second) => first - second);
        const position =
            (values.length - 1) *
            Math.min(Math.max(probability, 0), 1);
        const lower = Math.floor(position);
        const upper = Math.ceil(position);

        if (lower === upper) {
            return values[lower];
        }

        const weight = position - lower;
        return (
            values[lower] * (1 - weight) +
            values[upper] * weight
        );
    }

    function interpolateStops(stops, value) {
        const safeValue = Math.min(Math.max(value, 0), 1);

        for (let index = 1; index < stops.length; index += 1) {
            const previous = stops[index - 1];
            const current = stops[index];

            if (safeValue <= current[0]) {
                const span = current[0] - previous[0] || 1;
                const fraction =
                    (safeValue - previous[0]) / span;

                return [
                    Math.round(
                        previous[1] +
                            (current[1] - previous[1]) *
                                fraction
                    ),
                    Math.round(
                        previous[2] +
                            (current[2] - previous[2]) *
                                fraction
                    ),
                    Math.round(
                        previous[3] +
                            (current[3] - previous[3]) *
                                fraction
                    )
                ];
            }
        }

        return stops[stops.length - 1].slice(1);
    }

    function paletteColor(name, value) {
        if (name === "grayscale") {
            const gray = Math.round(
                255 * Math.min(Math.max(value, 0), 1)
            );
            return [gray, gray, gray];
        }

        if (name === "ocean") {
            return interpolateStops(
                [
                    [0, 3, 8, 18],
                    [0.2, 8, 31, 58],
                    [0.45, 13, 86, 117],
                    [0.7, 56, 158, 177],
                    [0.88, 157, 219, 201],
                    [1, 244, 247, 211]
                ],
                value
            );
        }

        return interpolateStops(
            [
                [0, 0, 0, 4],
                [0.14, 27, 12, 65],
                [0.3, 74, 12, 107],
                [0.48, 126, 30, 105],
                [0.65, 181, 54, 84],
                [0.8, 229, 97, 51],
                [0.92, 250, 166, 38],
                [1, 252, 255, 164]
            ],
            value
        );
    }

    function getInputArrays() {
        const channel1 = decodedAudio.getChannelData(0);
        const channel2 = decodedAudio.numberOfChannels > 1
            ? decodedAudio.getChannelData(1)
            : channel1;

        return {
            channel1,
            channel2
        };
    }

    function inputSample(
        mode,
        channel1,
        channel2,
        sampleIndex
    ) {
        const left = channel1[sampleIndex] || 0;
        const right = channel2[sampleIndex] || 0;

        if (mode === "channel1") {
            return left;
        }

        if (mode === "mono") {
            return (left + right) * 0.5;
        }

        if (mode === "difference") {
            return left - right;
        }

        return right;
    }

    function drawLabel(
        targetContext,
        text,
        x,
        y,
        alignment = "left"
    ) {
        targetContext.textAlign = alignment;
        targetContext.fillStyle = "#aebdca";
        targetContext.font =
            "12px ui-sans-serif, system-ui, sans-serif";
        targetContext.fillText(text, x, y);
    }

    async function renderSpectrogram() {
        if (!decodedAudio || !activeRegion) {
            state.textContent = "Select a passage first";
            summary.textContent =
                "No active waveform selection is available.";
            return;
        }

        renderButton.disabled = true;
        first18Button.disabled = true;
        exportButton.disabled = true;
        state.textContent = "Rendering…";
        placeholder.hidden = true;

        await new Promise((resolve) => {
            window.requestAnimationFrame(resolve);
        });

        const started = performance.now();
        const sampleRate = decodedAudio.sampleRate;
        const selectionStartSeconds = Math.max(
            0,
            activeRegion.start
        );
        const selectionEndSeconds = Math.min(
            decodedAudio.duration,
            activeRegion.end
        );
        const startSample = Math.floor(
            selectionStartSeconds * sampleRate
        );
        const endSample = Math.ceil(
            selectionEndSeconds * sampleRate
        );
        const sampleCount = Math.max(
            1,
            endSample - startSample
        );

        const fftSize = Number(fftSizeSelect.value);
        const overlap = Number(overlapSelect.value);
        const baseHop = Math.max(
            1,
            Math.round(fftSize * (1 - overlap))
        );
        const maxFrequency = Math.min(
            Number(maxFrequencySelect.value),
            sampleRate / 2
        );

        const shellWidth =
            canvas.parentElement.clientWidth || 1100;
        const cssWidth = Math.max(
            620,
            Math.min(1420, Math.floor(shellWidth - 2))
        );
        const cssHeight = Math.max(
            480,
            Math.min(660, Math.round(cssWidth * 0.48))
        );
        const leftMargin = 70;
        const rightMargin = 24;
        const topMargin = 28;
        const energyHeight = 82;
        const bottomMargin = 52;
        const gap = 42;
        const plotWidth = Math.max(
            320,
            cssWidth - leftMargin - rightMargin
        );
        const plotHeight = Math.max(
            240,
            cssHeight -
                topMargin -
                energyHeight -
                bottomMargin -
                gap
        );

        const maximumFrames = Math.min(
            1500,
            Math.max(420, Math.floor(plotWidth * 1.25))
        );

        let hopSize = baseHop;
        const possibleFrames =
            sampleCount <= fftSize
                ? 1
                : 1 +
                  Math.floor(
                      (sampleCount - fftSize) / hopSize
                  );

        if (possibleFrames > maximumFrames) {
            hopSize = Math.max(
                baseHop,
                Math.ceil(
                    (sampleCount - fftSize) /
                        Math.max(maximumFrames - 1, 1)
                )
            );
        }

        const frameCount =
            sampleCount <= fftSize
                ? 1
                : Math.max(
                      1,
                      1 +
                          Math.floor(
                              (sampleCount - fftSize) /
                                  hopSize
                          )
                  );

        const maximumBin = Math.max(
            1,
            Math.min(
                fftSize / 2,
                Math.floor(
                    (maxFrequency / sampleRate) *
                        fftSize
                )
            )
        );

        const { channel1, channel2 } = getInputArrays();
        const inputMode = channelSelect.value;
        const hann = getHann(fftSize);
        const real = new Float64Array(fftSize);
        const imaginary = new Float64Array(fftSize);
        const pixels = new Float32Array(
            frameCount * plotHeight
        );
        const rmsValues = new Float32Array(frameCount);
        const normalization =
            2 / Math.max(
                hann.reduce(
                    (total, value) => total + value,
                    0
                ),
                1
            );

        for (
            let frameIndex = 0;
            frameIndex < frameCount;
            frameIndex += 1
        ) {
            const frameStart =
                startSample + frameIndex * hopSize;
            let sumSquares = 0;

            real.fill(0);
            imaginary.fill(0);

            for (
                let sampleOffset = 0;
                sampleOffset < fftSize;
                sampleOffset += 1
            ) {
                const absoluteIndex =
                    frameStart + sampleOffset;

                const sample =
                    absoluteIndex < endSample
                        ? inputSample(
                              inputMode,
                              channel1,
                              channel2,
                              absoluteIndex
                          )
                        : 0;

                sumSquares += sample * sample;
                real[sampleOffset] =
                    sample * hann[sampleOffset];
            }

            rmsValues[frameIndex] =
                20 *
                Math.log10(
                    Math.sqrt(
                        sumSquares / fftSize
                    ) + 1e-12
                );

            fftInPlace(real, imaginary);

            for (
                let pixelY = 0;
                pixelY < plotHeight;
                pixelY += 1
            ) {
                const frequencyFraction =
                    1 -
                    pixelY /
                        Math.max(plotHeight - 1, 1);
                const bin = Math.max(
                    0,
                    Math.min(
                        maximumBin,
                        Math.round(
                            frequencyFraction *
                                maximumBin
                        )
                    )
                );
                const magnitude =
                    Math.hypot(
                        real[bin],
                        imaginary[bin]
                    ) * normalization;

                pixels[
                    frameIndex * plotHeight + pixelY
                ] =
                    20 *
                    Math.log10(magnitude + 1e-12);
            }

            if (
                frameIndex > 0 &&
                frameIndex % 180 === 0
            ) {
                state.textContent =
                    `Rendering ${Math.round(
                        (frameIndex / frameCount) * 100
                    )}%…`;

                await new Promise((resolve) => {
                    window.setTimeout(resolve, 0);
                });
            }
        }

        let floorDb = Number(floorControl.value);
        let ceilingDb = Number(ceilingControl.value);

        if (autoContrast.checked) {
            const samples = [];
            const stride = Math.max(
                1,
                Math.floor(pixels.length / 24000)
            );

            for (
                let index = 0;
                index < pixels.length;
                index += stride
            ) {
                const value = pixels[index];

                if (Number.isFinite(value)) {
                    samples.push(value);
                }
            }

            ceilingDb = Math.min(
                0,
                percentile(samples, 0.995)
            );
            floorDb = Math.max(
                -150,
                percentile(samples, 0.06)
            );

            if (ceilingDb - floorDb < 48) {
                floorDb = ceilingDb - 48;
            }
        }

        if (ceilingDb <= floorDb + 10) {
            ceilingDb = floorDb + 10;
        }

        const devicePixelRatioValue = Math.min(
            window.devicePixelRatio || 1,
            2
        );

        canvas.width = Math.round(
            cssWidth * devicePixelRatioValue
        );
        canvas.height = Math.round(
            cssHeight * devicePixelRatioValue
        );
        canvas.style.height = `${cssHeight}px`;

        context.setTransform(
            devicePixelRatioValue,
            0,
            0,
            devicePixelRatioValue,
            0,
            0
        );
        context.fillStyle = "#080c10";
        context.fillRect(0, 0, cssWidth, cssHeight);

        const imageCanvas = document.createElement(
            "canvas"
        );
        imageCanvas.width = frameCount;
        imageCanvas.height = plotHeight;
        const imageContext = imageCanvas.getContext(
            "2d",
            { alpha: false }
        );
        const image = imageContext.createImageData(
            frameCount,
            plotHeight
        );
        const palette = paletteSelect.value;
        const range = ceilingDb - floorDb;

        for (
            let frameIndex = 0;
            frameIndex < frameCount;
            frameIndex += 1
        ) {
            for (
                let pixelY = 0;
                pixelY < plotHeight;
                pixelY += 1
            ) {
                const dbValue =
                    pixels[
                        frameIndex *
                            plotHeight +
                            pixelY
                    ];
                const normalized =
                    (dbValue - floorDb) / range;
                const [red, green, blue] =
                    paletteColor(
                        palette,
                        normalized
                    );
                const imageIndex =
                    (pixelY * frameCount +
                        frameIndex) *
                    4;

                image.data[imageIndex] = red;
                image.data[imageIndex + 1] = green;
                image.data[imageIndex + 2] = blue;
                image.data[imageIndex + 3] = 255;
            }
        }

        imageContext.putImageData(image, 0, 0);
        context.imageSmoothingEnabled = true;
        context.drawImage(
            imageCanvas,
            leftMargin,
            topMargin,
            plotWidth,
            plotHeight
        );

        context.strokeStyle =
            "rgba(206, 224, 238, 0.24)";
        context.lineWidth = 1;

        const frequencyTickCount = 4;

        for (
            let tick = 0;
            tick <= frequencyTickCount;
            tick += 1
        ) {
            const fraction =
                tick / frequencyTickCount;
            const y =
                topMargin +
                plotHeight -
                fraction * plotHeight;
            const frequency =
                fraction * maxFrequency;

            context.beginPath();
            context.moveTo(leftMargin, y);
            context.lineTo(
                leftMargin + plotWidth,
                y
            );
            context.stroke();

            drawLabel(
                context,
                frequency >= 1000
                    ? `${(frequency / 1000).toFixed(
                          frequency % 1000 === 0
                              ? 0
                              : 1
                      )} kHz`
                    : `${Math.round(frequency)} Hz`,
                leftMargin - 10,
                y + 4,
                "right"
            );
        }

        const duration =
            selectionEndSeconds -
            selectionStartSeconds;
        const timeTickCount = 6;

        for (
            let tick = 0;
            tick <= timeTickCount;
            tick += 1
        ) {
            const fraction = tick / timeTickCount;
            const x =
                leftMargin +
                fraction * plotWidth;

            context.strokeStyle =
                "rgba(206, 224, 238, 0.16)";
            context.beginPath();
            context.moveTo(x, topMargin);
            context.lineTo(
                x,
                topMargin + plotHeight
            );
            context.stroke();

            drawLabel(
                context,
                `${(
                    selectionStartSeconds +
                    duration * fraction
                ).toFixed(2)} s`,
                x,
                topMargin + plotHeight + 20,
                "center"
            );
        }

        context.strokeStyle =
            "rgba(220, 235, 246, 0.65)";
        context.strokeRect(
            leftMargin,
            topMargin,
            plotWidth,
            plotHeight
        );

        drawLabel(
            context,
            "Frequency",
            10,
            topMargin - 8,
            "left"
        );

        drawLabel(
            context,
            `${floorDb.toFixed(1)} to ${ceilingDb.toFixed(
                1
            )} dB display range`,
            leftMargin + plotWidth,
            topMargin - 8,
            "right"
        );

        const energyTop =
            topMargin + plotHeight + gap;
        const energyBottom =
            energyTop + energyHeight;
        const energyFloor = Math.min(
            -100,
            floorDb
        );
        const energyCeiling = -5;

        context.fillStyle = "#0d141b";
        context.fillRect(
            leftMargin,
            energyTop,
            plotWidth,
            energyHeight
        );

        context.strokeStyle =
            "rgba(220, 235, 246, 0.2)";

        [-80, -60, -40, -20].forEach(
            (dbValue) => {
                const fraction =
                    (dbValue - energyFloor) /
                    (energyCeiling -
                        energyFloor);
                const y =
                    energyBottom -
                    Math.min(
                        Math.max(fraction, 0),
                        1
                    ) *
                        energyHeight;

                context.beginPath();
                context.moveTo(leftMargin, y);
                context.lineTo(
                    leftMargin + plotWidth,
                    y
                );
                context.stroke();

                drawLabel(
                    context,
                    `${dbValue} dB`,
                    leftMargin - 10,
                    y + 4,
                    "right"
                );
            }
        );

        context.strokeStyle = "#efc36b";
        context.lineWidth = 1.5;
        context.beginPath();

        rmsValues.forEach((dbValue, index) => {
            const x =
                leftMargin +
                (index /
                    Math.max(
                        rmsValues.length - 1,
                        1
                    )) *
                    plotWidth;
            const fraction =
                (dbValue - energyFloor) /
                (energyCeiling - energyFloor);
            const y =
                energyBottom -
                Math.min(
                    Math.max(fraction, 0),
                    1
                ) *
                    energyHeight;

            if (index === 0) {
                context.moveTo(x, y);
            }
            else {
                context.lineTo(x, y);
            }
        });

        context.stroke();
        context.strokeStyle =
            "rgba(220, 235, 246, 0.65)";
        context.strokeRect(
            leftMargin,
            energyTop,
            plotWidth,
            energyHeight
        );

        drawLabel(
            context,
            "Short-window RMS energy",
            leftMargin,
            energyTop - 9,
            "left"
        );

        const elapsed =
            performance.now() - started;
        const effectiveOverlap =
            1 - hopSize / fftSize;

        lastRender = {
            start: selectionStartSeconds,
            end: selectionEndSeconds,
            channel: inputMode,
            fftSize,
            hopSize,
            frameCount,
            maxFrequency,
            floorDb,
            ceilingDb,
            elapsed
        };

        state.textContent = "Rendered";
        summary.textContent =
            `${formatTime(selectionStartSeconds)}–` +
            `${formatTime(selectionEndSeconds)} · ` +
            `${inputMode.replace("channel", "Channel ")} · ` +
            `${sampleRate.toLocaleString()} Hz source · ` +
            `${fftSize}-sample FFT · ` +
            `${Math.round(effectiveOverlap * 100)}% effective overlap · ` +
            `${frameCount.toLocaleString()} analysis frames · ` +
            `${maxFrequency.toLocaleString()} Hz ceiling · ` +
            `${floorDb.toFixed(1)} to ` +
            `${ceilingDb.toFixed(1)} dB display · ` +
            `${elapsed.toFixed(0)} ms`;

        renderButton.disabled = false;
        first18Button.disabled = false;
        exportButton.disabled = false;
    }

    function scheduleSpectrogramRender() {
        if (
            !autoRender.checked ||
            panel.hidden ||
            !decodedAudio ||
            !activeRegion
        ) {
            return;
        }

        window.clearTimeout(scheduledRender);
        scheduledRender = window.setTimeout(
            renderSpectrogram,
            180
        );
    }

    first18Button.addEventListener(
        "click",
        () => {
            createSelection(0, 18, true);
            showTab();
            window.setTimeout(
                renderSpectrogram,
                120
            );
        }
    );

    renderButton.addEventListener(
        "click",
        renderSpectrogram
    );

    exportButton.addEventListener(
        "click",
        () => {
            if (!lastRender) {
                return;
            }

            canvas.toBlob((blob) => {
                if (!blob) {
                    return;
                }

                const link =
                    document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download =
                    `spectrogram-${lastRender.channel}-` +
                    `${lastRender.start.toFixed(2)}-` +
                    `${lastRender.end.toFixed(2)}.png`;
                link.click();

                window.setTimeout(() => {
                    URL.revokeObjectURL(link.href);
                }, 1000);
            }, "image/png");
        }
    );

    floorControl.addEventListener("input", () => {
        floorValue.textContent =
            `${Number(floorControl.value)} dB`;
        scheduleSpectrogramRender();
    });

    ceilingControl.addEventListener(
        "input",
        () => {
            ceilingValue.textContent =
                `${Number(
                    ceilingControl.value
                )} dB`;
            scheduleSpectrogramRender();
        }
    );

    [
        channelSelect,
        fftSizeSelect,
        overlapSelect,
        maxFrequencySelect,
        paletteSelect,
        autoContrast
    ].forEach((control) => {
        control.addEventListener(
            "change",
            scheduleSpectrogramRender
        );
    });

    regions.on(
        "region-updated",
        scheduleSpectrogramRender
    );

    wavesurfer.on("ready", () => {
        setAnalyzerEnabled(true);
    });

    setAnalyzerEnabled(Boolean(decodedAudio));
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        () => initializeSelectionSpectrogram(),
        { once: true }
    );
}
else {
    initializeSelectionSpectrogram();
}

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

// model-interpretation-audio-loop-v1

function initializeModelInterpretationAudioLoop(attempt = 0) {
    const panel = document.getElementById(
        "synthetic-reconstruction-panel"
    );

    if (!panel) {
        if (attempt < 80) {
            window.setTimeout(
                () => initializeModelInterpretationAudioLoop(
                    attempt + 1
                ),
                100
            );
        }
        return;
    }

    if (panel.dataset.actualAudioLoopInstalled === "true") {
        return;
    }

    panel.dataset.actualAudioLoopInstalled = "true";

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    const tabButton = Array.from(
        document.querySelectorAll(
            "#full-recording .lab-tab-button"
        )
    ).find((button) =>
        /synthetic reconstruction/i.test(
            button.textContent || ""
        )
    );

    if (tabButton) {
        tabButton.textContent = "Model interpretations";
    }

    const heading = panel.querySelector(
        ".synthetic-reconstruction-card > " +
        ".forensic-panel-heading h3"
    );

    if (heading) {
        heading.textContent =
            "Model interpretations — not a transcript";
    }

    const eyebrow = panel.querySelector(
        ".synthetic-reconstruction-card > " +
        ".forensic-panel-heading .eyebrow"
    );

    if (eyebrow) {
        eyebrow.textContent =
            "Machine-generated wording hypotheses";
    }

    const warning = panel.querySelector(
        ".synthetic-reconstruction-warning"
    );

    if (warning) {
        warning.textContent =
            "The models propose possible wording for ambiguous " +
            "speech. Playback always uses the actual source audio " +
            "or a disclosed conventional processing variant. " +
            "Generated wording is not a verified quotation.";
    }

    const backgroundHeading = panel.querySelector(
        "#synthetic-background-chatter h3"
    );

    if (backgroundHeading) {
        backgroundHeading.textContent =
            "Background-chatter interpretations";
    }

    const host = panel.querySelector(
        ".synthetic-reconstruction-card"
    );

    if (!host) {
        return;
    }

    const reviewBar = document.createElement("section");
    reviewBar.className = "actual-audio-review-bar";
    reviewBar.innerHTML = `
        <div class="actual-audio-review-copy">
            <p class="eyebrow">Actual-source listening</p>
            <strong>
                Model text above; source audio below
            </strong>
            <span>
                Candidate buttons create a precise waveform selection,
                enable looping, and play the actual recording through
                the current processing settings.
            </span>
        </div>

        <div class="actual-audio-review-actions">
            <button
                id="model-loop-current-selection"
                type="button"
            >
                Loop current selection
            </button>

            <button
                id="model-raw-channel-2"
                type="button"
            >
                Raw Channel 2
            </button>

            <button
                id="model-open-processing"
                type="button"
            >
                Open adjustments
            </button>

            <button
                id="model-stop-loop"
                type="button"
            >
                Stop
            </button>
        </div>

        <output
            id="model-audio-review-status"
            class="actual-audio-review-status"
        >
            Waiting for a candidate or waveform selection.
        </output>
    `;

    const firstResultStatus = host.querySelector(
        "#synthetic-result-status"
    );

    if (firstResultStatus) {
        firstResultStatus.insertAdjacentElement(
            "afterend",
            reviewBar
        );
    }
    else {
        host.prepend(reviewBar);
    }

    const reviewStatus = document.getElementById(
        "model-audio-review-status"
    );

    function formatLoopTime(seconds) {
        const safe = Number.isFinite(seconds)
            ? Math.max(0, seconds)
            : 0;
        const minutes = Math.floor(safe / 60);
        const remainder = safe - minutes * 60;

        return (
            `${String(minutes).padStart(2, "0")}:` +
            `${remainder.toFixed(2).padStart(5, "0")}`
        );
    }

    function listenTabButton() {
        return Array.from(
            document.querySelectorAll(
                "#full-recording .lab-tab-button"
            )
        ).find((button) =>
            /listen/i.test(button.textContent || "")
        );
    }

    function processingTabButton() {
        return Array.from(
            document.querySelectorAll(
                "#full-recording .lab-tab-button"
            )
        ).find((button) =>
            /enhance|adjust|process/i.test(
                button.textContent || ""
            )
        );
    }

    function updateReviewStatus(prefix = "Selection") {
        if (!activeRegion) {
            reviewStatus.textContent =
                "No waveform selection is active.";
            return;
        }

        const mode =
            channelMode?.selectedOptions?.[0]?.textContent ||
            channelMode?.value ||
            "current routing";

        const processing =
            bypassFilters?.checked
                ? "processing bypassed"
                : "current processing enabled";

        reviewStatus.textContent =
            `${prefix}: ` +
            `${formatLoopTime(activeRegion.start)}–` +
            `${formatLoopTime(activeRegion.end)} · ` +
            `${mode} · ${processing} · looping`;
    }

    async function startActualAudioLoop(
        options = {}
    ) {
        if (!activeRegion) {
            reviewStatus.textContent =
                "Create or open a waveform selection first.";
            return;
        }

        if (options.rawChannel2) {
            if (channelMode) {
                channelMode.value = "channel2";
                channelMode.dispatchEvent(
                    new Event("change", { bubbles: true })
                );
            }

            if (bypassFilters) {
                bypassFilters.checked = true;
                bypassFilters.dispatchEvent(
                    new Event("change", { bubbles: true })
                );
            }
        }

        if (loopSelection) {
            loopSelection.checked = true;
            loopSelection.dispatchEvent(
                new Event("change", { bubbles: true })
            );
        }

        try {
            await playActiveSelection();
            updateReviewStatus(
                options.rawChannel2
                    ? "Raw Channel 2"
                    : "Actual source"
            );
        }
        catch (error) {
            reviewStatus.textContent =
                `Playback failed: ${error.message}`;
        }
    }

    function stopActualAudioLoop() {
        if (loopSelection) {
            loopSelection.checked = false;
            loopSelection.dispatchEvent(
                new Event("change", { bubbles: true })
            );
        }

        selectionPlaybackActive = false;
        wavesurfer.pause();

        reviewStatus.textContent =
            "Actual-audio loop stopped.";
    }

    document
        .getElementById("model-loop-current-selection")
        ?.addEventListener("click", () => {
            startActualAudioLoop();
        });

    document
        .getElementById("model-raw-channel-2")
        ?.addEventListener("click", () => {
            startActualAudioLoop({
                rawChannel2: true
            });
        });

    document
        .getElementById("model-open-processing")
        ?.addEventListener("click", () => {
            processingTabButton()?.click();

            if (activeRegion) {
                updateReviewStatus(
                    "Adjusting active loop"
                );
            }
            else {
                reviewStatus.textContent =
                    "Processing controls opened. " +
                    "Select a candidate to begin looping.";
            }
        });

    document
        .getElementById("model-stop-loop")
        ?.addEventListener("click", stopActualAudioLoop);

    function removeSyntheticSpeechControls(root = panel) {
        root.querySelectorAll("button").forEach(
            (button) => {
                const text = (
                    button.textContent || ""
                ).trim();

                if (
                    /^(speak synthetic alternative|stop synthetic speech|speak candidate)$/i.test(
                        text
                    )
                ) {
                    button.remove();
                }
            }
        );
    }

    function enhanceCandidateButtons(root = panel) {
        removeSyntheticSpeechControls(root);

        root.querySelectorAll(
            ".synthetic-candidate-actions"
        ).forEach((actions) => {
            const sourceButton = Array.from(
                actions.querySelectorAll("button")
            ).find((button) =>
                /open source (selection|interval)/i.test(
                    button.textContent || ""
                ) ||
                /open & loop actual audio/i.test(
                    button.textContent || ""
                )
            );

            if (!sourceButton) {
                return;
            }

            sourceButton.textContent =
                "Open & loop actual audio";
            sourceButton.classList.add(
                "actual-audio-loop-button"
            );

            if (
                !actions.querySelector(
                    ".candidate-open-adjustments"
                )
            ) {
                const adjustments =
                    document.createElement("button");
                adjustments.type = "button";
                adjustments.className =
                    "candidate-open-adjustments";
                adjustments.textContent =
                    "Adjust processing";
                adjustments.addEventListener(
                    "click",
                    () => {
                        processingTabButton()?.click();
                    }
                );

                actions.append(adjustments);
            }

            if (
                !actions.querySelector(
                    ".candidate-stop-loop"
                )
            ) {
                const stop =
                    document.createElement("button");
                stop.type = "button";
                stop.className =
                    "candidate-stop-loop";
                stop.textContent = "Stop loop";
                stop.addEventListener(
                    "click",
                    stopActualAudioLoop
                );

                actions.append(stop);
            }
        });
    }

    panel.addEventListener("click", (event) => {
        const button = event.target.closest("button");

        if (!button) {
            return;
        }

        if (
            button.classList.contains(
                "actual-audio-loop-button"
            ) ||
            /open & loop actual audio/i.test(
                button.textContent || ""
            )
        ) {
            window.setTimeout(() => {
                if (loopSelection) {
                    loopSelection.checked = true;
                    loopSelection.dispatchEvent(
                        new Event(
                            "change",
                            { bubbles: true }
                        )
                    );
                }

                listenTabButton()?.click();

                window.setTimeout(() => {
                    startActualAudioLoop();
                }, 70);
            }, 40);
        }
    });

    const observer = new MutationObserver(
        (mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType !== Node.ELEMENT_NODE) {
                        return;
                    }

                    enhanceCandidateButtons(node);
                });
            }
        }
    );

    observer.observe(panel, {
        childList: true,
        subtree: true
    });

    enhanceCandidateButtons(panel);

    regions.on("region-updated", () => {
        if (loopSelection?.checked) {
            updateReviewStatus("Updated selection");
        }
    });

    const existingSpeechFunctionWarning =
        panel.querySelector(
            ".synthetic-reconstruction-card " +
            ".compact-note"
        );

    if (existingSpeechFunctionWarning) {
        existingSpeechFunctionWarning.textContent =
            "Run the local models to update the wording. " +
            "All listening controls use the actual source audio.";
    }
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        () => initializeModelInterpretationAudioLoop(),
        { once: true }
    );
}
else {
    initializeModelInterpretationAudioLoop();
}
// guided-listening-mode-v1

function initializeGuidedListeningMode(attempt = 0) {
    const lab = document.getElementById("full-recording");
    const waveShell = lab?.querySelector(".wave-shell");
    const labIntro = lab?.querySelector(".lab-intro");

    if (
        !lab ||
        !waveShell ||
        !labIntro ||
        !channelMode ||
        !filterPreset ||
        !bypassFilters ||
        !loopSelection
    ) {
        if (attempt < 80) {
            window.setTimeout(
                () => initializeGuidedListeningMode(
                    attempt + 1
                ),
                100
            );
        }
        return;
    }

    if (
        document.getElementById(
            "guided-listening-panel"
        )
    ) {
        return;
    }

    document.body.classList.add(
        "guided-listening-site"
    );

    const heading = lab.querySelector(
        ".section-heading h2"
    );

    if (heading) {
        heading.dataset.originalHeading =
            heading.textContent || "";
        heading.textContent =
            "Listen to the recording";
    }

    const originalIntro = labIntro.innerHTML;

    labIntro.innerHTML = `
        Choose a passage and a listening mode below.
        No audio or EQ experience is required.
        The original recording remains available at all times.
    `;

    const manualHelp = document.createElement(
        "details"
    );
    manualHelp.className =
        "guided-manual-help";
    manualHelp.innerHTML = `
        <summary>
            Manual waveform instructions
        </summary>
        <div>${originalIntro}</div>
    `;
    labIntro.insertAdjacentElement(
        "afterend",
        manualHelp
    );

    const panel = document.createElement("section");
    panel.id = "guided-listening-panel";
    panel.className = "guided-listening-panel";
    panel.setAttribute(
        "aria-labelledby",
        "guided-listening-title"
    );

    panel.innerHTML = `
        <div class="guided-listening-heading">
            <div>
                <p class="eyebrow">
                    Simple listening mode
                </p>
                <h3 id="guided-listening-title">
                    Three steps—no technical settings required
                </h3>
            </div>

            <button
                id="guided-advanced-toggle"
                type="button"
                aria-expanded="false"
            >
                Show technical controls
            </button>
        </div>

        <div class="guided-step">
            <div class="guided-step-number">1</div>
            <div class="guided-step-content">
                <h4>Choose what to hear</h4>
                <p>
                    These buttons select the passages discussed
                    in the review. You can also drag across the
                    waveform to select any other passage.
                </p>

                <div
                    class="guided-choice-row"
                    id="guided-passage-buttons"
                >
                    <button
                        type="button"
                        data-guided-passage="opening"
                    >
                        First 18 seconds
                        <small>00:00.00–00:18.00</small>
                    </button>

                    <button
                        type="button"
                        data-guided-passage="candidate-a"
                    >
                        Candidate A
                        <small>00:00.08–00:01.62</small>
                    </button>

                    <button
                        type="button"
                        data-guided-passage="candidate-c"
                    >
                        Candidate C
                        <small>00:12.55–00:15.05</small>
                    </button>

                    <button
                        type="button"
                        data-guided-passage="current"
                    >
                        Use my waveform selection
                        <small>Keep current boundaries</small>
                    </button>
                </div>
            </div>
        </div>

        <div class="guided-step">
            <div class="guided-step-number">2</div>
            <div class="guided-step-content">
                <h4>Choose how to hear it</h4>
                <p>
                    Start with the original. The other modes only
                    change how the existing sound is presented;
                    they do not create missing speech.
                </p>

                <div
                    class="guided-mode-grid"
                    id="guided-mode-buttons"
                >
                    <button
                        type="button"
                        data-guided-mode="original"
                    >
                        <strong>Original recording</strong>
                        <span>
                            Normal stereo with no filtering.
                        </span>
                    </button>

                    <button
                        type="button"
                        data-guided-mode="nearby"
                    >
                        <strong>Nearby microphone</strong>
                        <span>
                            Channel 2 in both ears; no filtering.
                        </span>
                    </button>

                    <button
                        type="button"
                        data-guided-mode="clearer"
                    >
                        <strong>Make speech clearer</strong>
                        <span>
                            Mild speech-focused filtering.
                        </span>
                    </button>

                    <button
                        type="button"
                        data-guided-mode="strong"
                    >
                        <strong>Strong speech focus</strong>
                        <span>
                            More aggressive; compare with raw.
                        </span>
                    </button>

                    <button
                        type="button"
                        data-guided-mode="rumble"
                    >
                        <strong>Reduce low rumble</strong>
                        <span>
                            Removes mostly low-frequency noise.
                        </span>
                    </button>
                </div>

                <div
                    id="guided-mode-explanation"
                    class="guided-mode-explanation"
                >
                    <strong>Original recording:</strong>
                    no channel isolation or filtering.
                </div>
            </div>
        </div>

        <div class="guided-step">
            <div class="guided-step-number">3</div>
            <div class="guided-step-content">
                <h4>Listen and compare</h4>
                <p>
                    Looping is usually easiest for short,
                    unclear passages. Use A/B comparison to
                    alternate between raw Channel 2 and the
                    selected listening mode.
                </p>

                <div class="guided-playback-row">
                    <button
                        id="guided-play-once"
                        type="button"
                    >
                        Play once
                    </button>

                    <button
                        id="guided-loop"
                        type="button"
                    >
                        Loop passage
                    </button>

                    <button
                        id="guided-compare"
                        type="button"
                    >
                        A/B: hear raw Channel 2
                    </button>

                    <button
                        id="guided-stop"
                        type="button"
                    >
                        Stop
                    </button>
                </div>

                <output
                    id="guided-listening-status"
                    class="guided-listening-status"
                    aria-live="polite"
                >
                    Choose a passage, then press Play once or
                    Loop passage.
                </output>
            </div>
        </div>

        <details class="guided-safety-note">
            <summary>
                What the listening modes can—and cannot—do
            </summary>
            <p>
                Filtering can reduce distracting frequencies or
                emphasize the range where speech often occurs.
                It cannot restore information discarded by the
                source recording. Strong processing can also make
                noise sound speech-like. Always compare an
                interpretation with the original or raw Channel 2.
            </p>
        </details>
    `;

    manualHelp.insertAdjacentElement(
        "afterend",
        panel
    );

    const advancedTargets = [
        lab.querySelector(".channel-panel"),
        lab.querySelector(".spectrum-panel"),
        lab.querySelector(".selection-panel"),
        lab.querySelector(".processing-panel"),
        lab.querySelector(".zoom-panel"),
        lab.querySelector(
            ".selection-analysis-panel"
        )
    ].filter(Boolean);

    advancedTargets.forEach((element) => {
        element.classList.add(
            "guided-advanced-control"
        );
    });

    const technicalTabPatterns = [
        /measure/i,
        /source/i
    ];

    const technicalTabButtons = Array.from(
        lab.querySelectorAll(".lab-tab-button")
    ).filter((button) =>
        technicalTabPatterns.some((pattern) =>
            pattern.test(button.textContent || "")
        )
    );

    technicalTabButtons.forEach((button) => {
        button.classList.add(
            "guided-advanced-tab"
        );
    });

    const advancedToggle = document.getElementById(
        "guided-advanced-toggle"
    );
    const status = document.getElementById(
        "guided-listening-status"
    );
    const modeExplanation = document.getElementById(
        "guided-mode-explanation"
    );
    const compareButton = document.getElementById(
        "guided-compare"
    );

    const passages = {
        opening: {
            start: 0,
            end: 18,
            label: "First 18 seconds"
        },
        "candidate-a": {
            start: 0.08,
            end: 1.62,
            label: "Candidate A"
        },
        "candidate-c": {
            start: 12.55,
            end: 15.05,
            label: "Candidate C"
        }
    };

    const modes = {
        original: {
            label: "Original recording",
            channel: "stereo",
            preset: "bypass",
            bypass: true,
            explanation:
                "<strong>Original recording:</strong> " +
                "normal stereo with no filtering."
        },
        nearby: {
            label: "Nearby microphone",
            channel: "channel2",
            preset: "bypass",
            bypass: true,
            explanation:
                "<strong>Nearby microphone:</strong> " +
                "Channel 2 is centered in both ears. " +
                "No frequency filtering is applied."
        },
        clearer: {
            label: "Make speech clearer",
            channel: "channel2",
            preset: "speech-mild",
            bypass: false,
            explanation:
                "<strong>Make speech clearer:</strong> " +
                "Channel 2 is centered and mildly filtered " +
                "to reduce frequencies outside much of the " +
                "speech range. Compare with raw audio."
        },
        strong: {
            label: "Strong speech focus",
            channel: "channel2",
            preset: "speech-narrow",
            bypass: false,
            explanation:
                "<strong>Strong speech focus:</strong> " +
                "a narrower and more aggressive speech-band " +
                "treatment. This can emphasize artifacts, so " +
                "raw comparison is especially important."
        },
        rumble: {
            label: "Reduce low rumble",
            channel: "channel2",
            preset: "rumble",
            bypass: false,
            explanation:
                "<strong>Reduce low rumble:</strong> " +
                "Channel 2 is centered and low-frequency " +
                "noise is reduced. Most higher-frequency " +
                "content is left alone."
        }
    };

    let selectedPassage = null;
    let selectedMode = "original";
    let comparingRaw = false;

    function dispatchChange(element) {
        if (!element) {
            return;
        }

        element.dispatchEvent(
            new Event("change", {
                bubbles: true
            })
        );
    }

    function highlightChoice(
        selector,
        attribute,
        value
    ) {
        panel.querySelectorAll(selector).forEach(
            (button) => {
                const active =
                    button.dataset[attribute] === value;

                button.classList.toggle(
                    "active",
                    active
                );
                button.setAttribute(
                    "aria-pressed",
                    String(active)
                );
            }
        );
    }

    function applyMode(
        modeName,
        options = {}
    ) {
        const configuration = modes[modeName];

        if (!configuration) {
            return;
        }

        channelMode.value = configuration.channel;
        dispatchChange(channelMode);

        filterPreset.value = configuration.preset;
        dispatchChange(filterPreset);

        bypassFilters.checked =
            configuration.bypass;
        dispatchChange(bypassFilters);

        if (!options.temporary) {
            selectedMode = modeName;
            comparingRaw = false;
            compareButton.textContent =
                "A/B: hear raw Channel 2";

            highlightChoice(
                "[data-guided-mode]",
                "guidedMode",
                modeName
            );

            modeExplanation.innerHTML =
                configuration.explanation;

            status.textContent =
                `${configuration.label} selected. ` +
                "The audio has not been reconstructed.";
        }
    }

    function ensureSelection() {
        if (activeRegion) {
            return true;
        }

        createSelection(0, 18, true);
        selectedPassage = "opening";

        highlightChoice(
            "[data-guided-passage]",
            "guidedPassage",
            "opening"
        );

        status.textContent =
            "The first 18 seconds were selected automatically.";

        return Boolean(activeRegion);
    }

    function choosePassage(name) {
        if (name === "current") {
            if (!activeRegion) {
                status.textContent =
                    "Drag across the waveform first, or choose " +
                    "one of the prepared passages.";
                return;
            }

            selectedPassage = "current";
            highlightChoice(
                "[data-guided-passage]",
                "guidedPassage",
                name
            );

            status.textContent =
                `Current waveform selection: ` +
                `${formatTime(activeRegion.start)}–` +
                `${formatTime(activeRegion.end)}.`;
            return;
        }

        const passage = passages[name];

        if (!passage) {
            return;
        }

        createSelection(
            passage.start,
            passage.end,
            true
        );

        selectedPassage = name;

        highlightChoice(
            "[data-guided-passage]",
            "guidedPassage",
            name
        );

        window.setTimeout(() => {
            zoomToActiveSelection();
        }, 40);

        status.textContent =
            `${passage.label} selected: ` +
            `${formatTime(passage.start)}–` +
            `${formatTime(passage.end)}.`;
    }

    async function startPlayback(looping) {
        if (!ensureSelection()) {
            return;
        }

        loopSelection.checked = looping;
        dispatchChange(loopSelection);

        try {
            await playActiveSelection();

            const modeLabel =
                modes[selectedMode].label;

            status.textContent =
                `${looping ? "Looping" : "Playing"} ` +
                `${formatTime(activeRegion.start)}–` +
                `${formatTime(activeRegion.end)} using ` +
                `${modeLabel}.`;
        }
        catch (error) {
            status.textContent =
                `Playback failed: ${error.message}`;
        }
    }

    function stopPlayback() {
        selectionPlaybackActive = false;
        loopSelection.checked = false;
        dispatchChange(loopSelection);
        wavesurfer.pause();

        status.textContent = "Playback stopped.";
    }

    function setAdvancedOpen(open) {
        document.body.classList.toggle(
            "guided-advanced-open",
            open
        );

        advancedToggle.setAttribute(
            "aria-expanded",
            String(open)
        );

        advancedToggle.textContent =
            open
                ? "Hide technical controls"
                : "Show technical controls";

        try {
            window.localStorage.setItem(
                "nolan-guided-advanced-open",
                String(open)
            );
        }
        catch {
            // Storage is optional.
        }
    }

    panel.querySelectorAll(
        "[data-guided-passage]"
    ).forEach((button) => {
        button.addEventListener("click", () => {
            choosePassage(
                button.dataset.guidedPassage
            );
        });
    });

    panel.querySelectorAll(
        "[data-guided-mode]"
    ).forEach((button) => {
        button.addEventListener("click", () => {
            applyMode(
                button.dataset.guidedMode
            );
        });
    });

    document
        .getElementById("guided-play-once")
        .addEventListener("click", () => {
            startPlayback(false);
        });

    document
        .getElementById("guided-loop")
        .addEventListener("click", () => {
            startPlayback(true);
        });

    document
        .getElementById("guided-stop")
        .addEventListener(
            "click",
            stopPlayback
        );

    compareButton.addEventListener("click", () => {
        if (selectedMode === "original") {
            status.textContent =
                "Choose Nearby microphone, Make speech " +
                "clearer, Strong speech focus, or Reduce " +
                "low rumble before using A/B comparison.";
            return;
        }

        comparingRaw = !comparingRaw;

        if (comparingRaw) {
            applyMode("nearby", {
                temporary: true
            });

            compareButton.textContent =
                `A/B: return to ${modes[selectedMode].label}`;

            status.textContent =
                "A/B comparison: raw Channel 2 is active. " +
                "Press the button again to return to the " +
                "selected listening mode.";
        }
        else {
            applyMode(selectedMode, {
                temporary: true
            });

            compareButton.textContent =
                "A/B: hear raw Channel 2";

            status.textContent =
                `A/B comparison: returned to ` +
                `${modes[selectedMode].label}.`;
        }
    });

    advancedToggle.addEventListener("click", () => {
        setAdvancedOpen(
            !document.body.classList.contains(
                "guided-advanced-open"
            )
        );
    });

    regions.on("region-updated", (region) => {
        if (region !== activeRegion) {
            return;
        }

        selectedPassage = "current";

        highlightChoice(
            "[data-guided-passage]",
            "guidedPassage",
            "current"
        );

        status.textContent =
            `Custom passage selected: ` +
            `${formatTime(region.start)}–` +
            `${formatTime(region.end)}.`;
    });

    let storedAdvanced = false;

    try {
        storedAdvanced =
            window.localStorage.getItem(
                "nolan-guided-advanced-open"
            ) === "true";
    }
    catch {
        storedAdvanced = false;
    }

    setAdvancedOpen(storedAdvanced);
    applyMode("original");

    const listenTab = Array.from(
        lab.querySelectorAll(".lab-tab-button")
    ).find((button) =>
        /listen/i.test(button.textContent || "")
    );

    if (listenTab) {
        listenTab.textContent =
            "Listen — simple mode";
    }
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        () => initializeGuidedListeningMode(),
        { once: true }
    );
}
else {
    initializeGuidedListeningMode();
}