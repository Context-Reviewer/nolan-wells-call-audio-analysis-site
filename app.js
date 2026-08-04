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