const PatternType = {
    JACK: "Jack",
    STREAM: "Stream",
    JHS: "JHS",
    TECH: "Tech",
    UNKNOWN: "Unknown"
};

const SubPatternType = {
    JACK_SMALL: "Jack-S",
    JACK_MEDIUM: "Jack-M",
    JACK_LARGE: "Jack-L",
    JHS_JS: "JHS-JS",
    JHS_HS: "JHS-HS",
    JHS_QS: "JHS-QS",
    STREAM_NORMAL: "Stream-N",
    STREAM_CHAOS: "Stream-C",
    TECH_JACK: "Tech-J",
    TECH_STREAM: "Tech-S",
    TECH_JHS: "Tech-M",
    TECH_PURE: "Tech-P",
    UNKNOWN: "Unknown"
};

class Note {
    constructor(time, column, isHold, holdEnd = 0) {
        this.time = time;
        this.column = column;
        this.isHold = isHold;
        this.holdEnd = holdEnd;
    }
}

class BeatmapInfo {
    constructor() {
        this.filepath = "";
        this.title = "";
        this.artist = "";
        this.version = "";
        this.creator = "";
        this.keyCount = 4;
        this.totalTime = 0;
        this.noteCount = 0;
        this.notes = [];
    }
}

class WindowResult {
    constructor() {
        this.windowIdx = 0;
        this.startTime = 0;
        this.endTime = 0;
        this.noteCount = 0;
        this.density = 0;
        this.jackRate = 0;
        this.chordRatio = 0;
        this.columnEntropy = 0;
        this.colDominance = 0;
        this.intervalVariance = 0;
        this.avgColumnSpan = 0;
        this.longNoteRatio = 0;
        this.pattern = PatternType.UNKNOWN;
        this.patternScore = 0;
        this.subPattern = SubPatternType.UNKNOWN;
        this.chordCounts = [0, 0, 0, 0];
        this.jackDensity = 0;
        this.jbar = 0;
        this.xbar = 0;
        this.pbar = 0;
        this.abar = 0;
        this.difficulty = 0;
    }
}

function parseOsuFromText(content) {
    const bm = new BeatmapInfo();
    const lines = content.split('\n');
    let currentSection = "";

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('//')) {
            continue;
        }
        if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
            currentSection = trimmedLine.slice(1, -1);
            continue;
        }

        try {
            if (currentSection === 'General') {
                if (trimmedLine.startsWith('Mode:')) {
                    bm.mode = parseInt(trimmedLine.split(':')[1].trim(), 10);
                }
            } else if (currentSection === 'Metadata') {
                if (trimmedLine.startsWith('Title:')) {
                    bm.title = trimmedLine.split(':', 1)[1].trim();
                } else if (trimmedLine.startsWith('Artist:')) {
                    bm.artist = trimmedLine.split(':', 1)[1].trim();
                } else if (trimmedLine.startsWith('Version:')) {
                    bm.version = trimmedLine.split(':', 1)[1].trim();
                } else if (trimmedLine.startsWith('Creator:')) {
                    bm.creator = trimmedLine.split(':', 1)[1].trim();
                }
            } else if (currentSection === 'Difficulty') {
                if (trimmedLine.startsWith('CircleSize:')) {
                    bm.keyCount = parseInt(trimmedLine.split(':')[1].trim(), 10);
                }
            } else if (currentSection === 'HitObjects') {
                const note = parseHitObject(trimmedLine, bm.keyCount);
                if (note) {
                    bm.notes.push(note);
                }
            }
        } catch (e) {
            continue;
        }
    }

    if (bm.mode !== undefined && bm.mode !== 3) {
        throw new Error(`Not osu!mania beatmap (mode=${bm.mode})`);
    }
    if (bm.keyCount < 4) {
        throw new Error(`At least 4K beatmap required (current ${bm.keyCount}K)`);
    }

    bm.notes.sort((a, b) => a.time - b.time);
    bm.noteCount = bm.notes.length;

    if (bm.notes.length > 0) {
        let maxT = 0;
        let maxH = 0;
        for (const n of bm.notes) {
            maxT = Math.max(maxT, n.time);
            if (n.isHold) {
                maxH = Math.max(maxH, n.holdEnd);
            }
        }
        bm.totalTime = Math.max(maxT, maxH);
    }
    return bm;
}

function parseHitObject(line, keyCount) {
    const parts = line.split(',');
    if (parts.length < 5) {
        return null;
    }
    try {
        const x = parseFloat(parts[0]);
        const time = parseFloat(parts[2]);
        const typeFlags = parseInt(parts[3], 10);

        let column = Math.floor(x * keyCount / 512);
        column = Math.max(0, Math.min(column, keyCount - 1));

        const isHold = !!(typeFlags & 128);
        const isNormal = !!(typeFlags & 1);
        if (!isNormal && !isHold) {
            return null;
        }

        let holdEnd = 0;
        if (isHold && parts.length >= 6) {
            try {
                holdEnd = parseFloat(parts[5].split(':')[0]);
            } catch (e) {
                // ignore
            }
        }

        return new Note(time, column, isHold, holdEnd);
    } catch (e) {
        return null;
    }
}

const USE_OLD_ALGORITHM = false;

function groupChords(notes) {
    if (!notes || notes.length === 0) {
        return [];
    }
    const sortedNotes = [...notes].sort((a, b) => a.time - b.time);

    let chordThreshold;
    if (sortedNotes.length > 1) {
        const totalInterval = sortedNotes[sortedNotes.length - 1].time - sortedNotes[0].time;
        const avgInterval = totalInterval / (sortedNotes.length - 1);
        chordThreshold = avgInterval * 0.05;
    } else {
        chordThreshold = 3.0;
    }

    chordThreshold = Math.max(chordThreshold, 1.0);
    chordThreshold = Math.min(chordThreshold, 5.0);

    const groups = [[sortedNotes[0]]];
    for (let i = 1; i < sortedNotes.length; i++) {
        const n = sortedNotes[i];
        if (n.time - groups[groups.length - 1][0].time <= chordThreshold) {
            groups[groups.length - 1].push(n);
        } else {
            groups.push([n]);
        }
    }
    return groups;
}

function detectJacks(notes) {
    const nonLn = notes.filter(n => !n.isHold);
    if (nonLn.length < 3) {
        return [0.0, 0.0];
    }

    const keyCount = notes.length > 0 ? Math.max(...notes.map(n => n.column)) + 1 : 4;
    const colCounts = [];
    for (let c = 0; c < keyCount; c++) {
        colCounts.push(notes.filter(n => n.column === c).length);
    }
    const total = colCounts.reduce((a, b) => a + b, 0);
    const colDom = total > 0 ? Math.max(...colCounts) / total : 0;

    const chords = groupChords(nonLn);
    const groupCols = chords.map(c => new Set(c.map(n => n.column)));

    const colNotes = {};
    for (const n of nonLn) {
        if (!colNotes[n.column]) {
            colNotes[n.column] = [];
        }
        colNotes[n.column].push(n);
    }

    const jackIds = new Set();

    for (let col = 0; col < keyCount; col++) {
        let streakStart = 0;
        for (let gIdx = 0; gIdx < groupCols.length; gIdx++) {
            const cols = groupCols[gIdx];
            if (cols.has(col)) {
                if (gIdx === 0 || !groupCols[gIdx - 1].has(col)) {
                    streakStart = gIdx;
                }
            } else {
                if (gIdx > 0 && groupCols[gIdx - 1].has(col)) {
                    if (gIdx - streakStart >= 2) {
                        for (let sg = streakStart; sg < gIdx; sg++) {
                            for (const n of chords[sg]) {
                                if (n.column === col) {
                                    jackIds.add(n);
                                }
                            }
                        }
                    }
                }
                streakStart = gIdx + 1;
            }
        }

        if (groupCols.length > 0 && groupCols[groupCols.length - 1].has(col)) {
            const endIdx = groupCols.length;
            if (endIdx - streakStart >= 2) {
                for (let sg = streakStart; sg < endIdx; sg++) {
                    for (const n of chords[sg]) {
                        if (n.column === col) {
                            jackIds.add(n);
                        }
                    }
                }
            }
        }
    }

    const jackRate = nonLn.length > 0 ? jackIds.size / nonLn.length : 0;
    return [jackRate, colDom];
}

function entropy(counts) {
    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) {
        return 0.0;
    }
    let e = 0.0;
    for (const c of counts) {
        if (c > 0) {
            const p = c / total;
            e -= p * Math.log2(p);
        }
    }
    return counts.length > 1 ? e / Math.log2(counts.length) : 0.0;
}

function avgColumnSpan(notes) {
    if (notes.length < 2) {
        return 0.0;
    }
    const chords = groupChords(notes);
    const centers = chords.filter(c => c.length > 0).map(c => 
        c.reduce((sum, n) => sum + n.column, 0) / c.length
    );
    if (centers.length < 2) {
        return 0.0;
    }
    let spanSum = 0;
    for (let i = 0; i < centers.length - 1; i++) {
        spanSum += Math.abs(centers[i + 1] - centers[i]);
    }
    return spanSum / (centers.length - 1);
}

function intervalVariance(chords) {
    if (chords.length < 3) {
        return 0.0;
    }
    const times = chords.filter(c => c.length > 0).map(c => c[0].time);
    const intervals = [];
    for (let i = 0; i < times.length - 1; i++) {
        const diff = times[i + 1] - times[i];
        if (diff > 0) {
            intervals.push(diff);
        }
    }
    if (intervals.length === 0) {
        return 0.0;
    }
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean === 0) {
        return 0.0;
    }
    let varSum = 0;
    for (const iv of intervals) {
        varSum += Math.pow(iv - mean, 2);
    }
    const variance = varSum / intervals.length;
    return Math.sqrt(variance) / mean;
}

function countChordTypes(chords) {
    const counts = [0, 0, 0, 0];
    for (const c of chords) {
        const size = c.length;
        if (size === 1) {
            counts[0]++;
        } else if (size === 2) {
            counts[1]++;
        } else if (size === 3) {
            counts[2]++;
        } else if (size >= 4) {
            counts[3]++;
        }
    }
    return counts;
}

function calculateJackDensity(notes, chords) {
    const nonLn = notes.filter(n => !n.isHold);
    if (nonLn.length < 3) {
        return 0.0;
    }

    const groupCols = chords.map(c => new Set(c.map(n => n.column)));

    const keyCount = notes.length > 0 ? Math.max(...notes.map(n => n.column)) + 1 : 4;
    let jackColCount = 0;
    for (let col = 0; col < keyCount; col++) {
        let streakCount = 0;
        let maxStreak = 0;
        for (const gc of groupCols) {
            if (gc.has(col)) {
                streakCount++;
                maxStreak = Math.max(maxStreak, streakCount);
            } else {
                streakCount = 0;
            }
        }

        if (maxStreak >= 3) {
            jackColCount++;
        }
    }

    const totalGroups = groupCols.length;
    if (totalGroups === 0) {
        return 0.0;
    }

    const avgGroupSize = chords.reduce((sum, c) => sum + c.length, 0) / totalGroups;

    return (jackColCount / keyCount) * (avgGroupSize / 2);
}

function computeJbarSunny(notes, windowSizeMs = 15000) {
    const nonLn = notes.filter(n => !n.isHold);
    if (nonLn.length < 2) {
        return 0.0;
    }

    const colNotes = {};
    for (const n of nonLn) {
        if (!colNotes[n.column]) {
            colNotes[n.column] = [];
        }
        colNotes[n.column].push(n.time);
    }

    let jbarSum = 0.0;
    let count = 0;
    const keyCount = notes.length > 0 ? Math.max(...notes.map(n => n.column)) + 1 : 4;
    for (let col = 0; col < keyCount; col++) {
        const times = (colNotes[col] || []).sort((a, b) => a - b);
        for (let i = 0; i < times.length - 1; i++) {
            const delta = times[i + 1] - times[i];
            if (delta > 0 && delta < windowSizeMs) {
                jbarSum += 1.0 / delta;
                count++;
            }
        }
    }

    return count > 0 ? jbarSum / count : 0.0;
}

function computeXbarSunny(notes, windowSizeMs = 15000) {
    const nonLn = notes.filter(n => !n.isHold);
    if (nonLn.length < 2) {
        return 0.0;
    }

    const colNotes = {};
    for (const n of nonLn) {
        if (!colNotes[n.column]) {
            colNotes[n.column] = [];
        }
        colNotes[n.column].push(n.time);
    }

    let xbarSum = 0.0;
    let count = 0;
    const keyCount = notes.length > 0 ? Math.max(...notes.map(n => n.column)) + 1 : 4;
    for (let col = 0; col < keyCount - 1; col++) {
        const times1 = (colNotes[col] || []).sort((a, b) => a - b);
        const times2 = (colNotes[col + 1] || []).sort((a, b) => a - b);
        const merged = [];
        let i = 0, j = 0;
        while (i < times1.length && j < times2.length) {
            if (times1[i] < times2[j]) {
                merged.push(['a', times1[i]]);
                i++;
            } else {
                merged.push(['b', times2[j]]);
                j++;
            }
        }
        while (i < times1.length) {
            merged.push(['a', times1[i]]);
            i++;
        }
        while (j < times2.length) {
            merged.push(['b', times2[j]]);
            j++;
        }

        for (let k = 0; k < merged.length - 1; k++) {
            if (merged[k][0] !== merged[k + 1][0]) {
                const delta = merged[k + 1][1] - merged[k][1];
                if (delta > 0 && delta < windowSizeMs) {
                    xbarSum += 1.0 / delta;
                    count++;
                }
            }
        }
    }

    return count > 0 ? xbarSum / count : 0.0;
}

function computePbarSunny(notes, windowSizeMs = 15000) {
    const nonLn = notes.filter(n => !n.isHold);
    if (nonLn.length < 2) {
        return 0.0;
    }

    const sortedNotes = [...nonLn].sort((a, b) => a.time - b.time);

    let pbarSum = 0.0;
    let count = 0;

    for (let i = 0; i < sortedNotes.length - 1; i++) {
        const delta = sortedNotes[i + 1].time - sortedNotes[i].time;
        if (delta <= 0 || delta >= windowSizeMs) {
            continue;
        }

        const colPrev = sortedNotes[i].column;
        const colCurr = sortedNotes[i + 1].column;

        let baseValue = 1.0 / delta;

        let irregularityFactor;
        if (colPrev !== colCurr) {
            const switchPattern = Math.abs(colCurr - colPrev);
            if (switchPattern === 1) {
                irregularityFactor = 1.0;
            } else if (switchPattern === 2) {
                irregularityFactor = 1.3;
            } else {
                irregularityFactor = 1.6;
            }
        } else {
            irregularityFactor = 0.5;
        }

        pbarSum += baseValue * irregularityFactor;
        count++;
    }

    let basePbar = count > 0 ? pbarSum / count : 0.0;

    if (sortedNotes.length >= 4) {
        const colSequence = sortedNotes.map(n => n.column);
        let patternVariance = 0.0;
        for (let i = 0; i < colSequence.length - 2; i++) {
            const diff1 = Math.abs(colSequence[i + 1] - colSequence[i]);
            const diff2 = Math.abs(colSequence[i + 2] - colSequence[i + 1]);
            patternVariance += Math.abs(diff1 - diff2);
        }

        const avgPatternVariance = colSequence.length > 2 ? patternVariance / (colSequence.length - 2) : 0;
        const patternBoost = 1.0 + avgPatternVariance * 0.2;
        basePbar *= patternBoost;
    }

    return basePbar;
}

function computeAbarSunny(notes, windowSizeMs = 15000) {
    const nonLn = notes.filter(n => !n.isHold);
    if (nonLn.length < 2) {
        return 0.0;
    }

    const keyCount = notes.length > 0 ? Math.max(...notes.map(n => n.column)) + 1 : 4;
    const colCounts = new Array(keyCount).fill(0);
    for (const n of nonLn) {
        colCounts[n.column]++;
    }

    const total = colCounts.reduce((a, b) => a + b, 0);
    if (total === 0) {
        return 0.0;
    }

    const avg = total / keyCount;
    let varianceSum = 0;
    for (const c of colCounts) {
        varianceSum += Math.pow(c - avg, 2);
    }
    const variance = varianceSum / keyCount;
    return avg > 0 ? variance / (avg * avg) : 0;
}

function classify(density, jackRate, chordRatio, colEntropy, colDom, iv, colSpan, lnRatio) {
    if (USE_OLD_ALGORITHM) {
        if (jackRate > 0.30) {
            return [PatternType.JACK, jackRate * 100];
        }
        if (iv > 0.55 && jackRate < 0.35 && chordRatio > 0.25) {
            return [PatternType.TECH, iv * 60];
        }
        if (chordRatio < 0.40) {
            return [PatternType.STREAM, (1.0 - chordRatio) * 60];
        }
        return [PatternType.JHS, chordRatio * 60];
    }

    if (jackRate > 0.30) {
        if (iv > 0.75 && chordRatio < 0.50) {
            return [PatternType.TECH, iv * 60];
        }
        if (iv > 0.85 && chordRatio < 0.60 && density < 1.2) {
            return [PatternType.TECH, iv * 60];
        }
        return [PatternType.JACK, jackRate * 100];
    }

    if (lnRatio > 0.15) {
        if (density < 0.4) {
            return [PatternType.STREAM, (1.0 - chordRatio) * 60];
        }
        if (chordRatio >= 0.55) {
            return [PatternType.JHS, chordRatio * 60];
        }
        return [PatternType.TECH, iv * 60];
    }

    if (iv > 0.80) {
        if (chordRatio >= 0.70 && density > 1.5) {
            return [PatternType.JHS, chordRatio * 60];
        }
        if (chordRatio >= 0.65 && density > 2.5) {
            return [PatternType.JHS, chordRatio * 60];
        }
        return [PatternType.TECH, iv * 60];
    }

    if (iv > 0.75) {
        if (chordRatio >= 0.70 && density > 1.2) {
            return [PatternType.JHS, chordRatio * 60];
        }
        if (chordRatio >= 0.60 && density > 2.2) {
            return [PatternType.JHS, chordRatio * 60];
        }
        return [PatternType.TECH, iv * 60];
    }

    if (iv > 0.70) {
        if (chordRatio >= 0.70 && density > 1.2 && jackRate < 0.15) {
            return [PatternType.JHS, chordRatio * 60];
        }
        if (chordRatio >= 0.60 && density > 2.5 && jackRate < 0.15) {
            return [PatternType.JHS, chordRatio * 60];
        }
        if (chordRatio >= 0.35) {
            return [PatternType.TECH, iv * 60];
        }
    }

    if (iv > 0.65) {
        if (chordRatio >= 0.50 && jackRate < 0.15) {
            return [PatternType.JHS, chordRatio * 60];
        }
        if (chordRatio >= 0.35) {
            return [PatternType.TECH, iv * 60];
        }
    }

    if (iv > 0.60) {
        if (chordRatio >= 0.45) {
            return [PatternType.JHS, chordRatio * 60];
        }
        if (chordRatio >= 0.30 && jackRate > 0.10) {
            return [PatternType.TECH, iv * 60];
        }
        if (chordRatio >= 0.35) {
            return [PatternType.TECH, iv * 60];
        }
    }

    if (iv > 0.55) {
        if (chordRatio >= 0.45) {
            return [PatternType.JHS, chordRatio * 60];
        }
        if (chordRatio >= 0.35 && jackRate > 0.10) {
            return [PatternType.TECH, iv * 60];
        }
    }

    if (chordRatio >= 0.55) {
        if (iv < 0.90 && density > 0.8) {
            return [PatternType.JHS, chordRatio * 60];
        }
        if (density > 1.2) {
            return [PatternType.JHS, chordRatio * 60];
        }
        return [PatternType.TECH, iv * 60];
    }

    if (chordRatio >= 0.50) {
        if (iv < 0.85) {
            return [PatternType.JHS, chordRatio * 60];
        }
        if (iv < 1.00 && density > 1.5) {
            return [PatternType.JHS, chordRatio * 60];
        }
        return [PatternType.TECH, iv * 60];
    }

    if (chordRatio >= 0.45) {
        if (iv < 0.70) {
            return [PatternType.JHS, chordRatio * 60];
        }
        if (density > 1.5) {
            return [PatternType.JHS, chordRatio * 60];
        }
        return [PatternType.TECH, iv * 60];
    }

    if (chordRatio >= 0.40) {
        if (iv < 0.45 && density > 1.5) {
            return [PatternType.JHS, chordRatio * 60];
        }
        if (jackRate > 0.15) {
            return [PatternType.TECH, iv * 60];
        }
    }

    if (chordRatio >= 0.35) {
        if (iv < 0.50 && density > 1.2) {
            return [PatternType.JHS, chordRatio * 60];
        }
    }

    if (chordRatio >= 0.30) {
        if (colSpan > 1.35 && iv < 0.60) {
            return [PatternType.JHS, chordRatio * 60];
        }
    }

    if (chordRatio >= 0.20) {
        if (colSpan > 1.35 && iv < 0.60 && density > 1.2) {
            return [PatternType.JHS, chordRatio * 60];
        }
    }

    if (chordRatio < 0.30) {
        return [PatternType.STREAM, (1.0 - chordRatio) * 60];
    }

    if (chordRatio < 0.35) {
        if (iv < 0.75) {
            return [PatternType.STREAM, (1.0 - chordRatio) * 60];
        }
        if (iv < 0.80) {
            return [PatternType.STREAM, (1.0 - chordRatio) * 60];
        }
    }

    return [PatternType.STREAM, (1.0 - chordRatio) * 60];
}

function classifySub(pattern, jackRate, density, jackDensity, chordCounts, chordRatio, iv) {
    const singles = chordCounts[0];
    const doubles = chordCounts[1];
    const triples = chordCounts[2];
    const quads = chordCounts[3];
    const totalChords = chordCounts.reduce((a, b) => a + b, 0);

    if (pattern === PatternType.JACK) {
        if (jackRate >= 0.80 && jackDensity >= 1.2) {
            return SubPatternType.JACK_LARGE;
        } else if (jackRate >= 0.60 && jackDensity >= 1.0) {
            return SubPatternType.JACK_MEDIUM;
        } else if (jackRate >= 0.50 && jackDensity >= 0.8) {
            return SubPatternType.JACK_MEDIUM;
        } else if (jackRate >= 0.70) {
            return SubPatternType.JACK_MEDIUM;
        } else if (jackDensity >= 1.1) {
            return SubPatternType.JACK_MEDIUM;
        } else {
            return SubPatternType.JACK_SMALL;
        }
    }

    else if (pattern === PatternType.JHS) {
        if (quads >= 5) {
            return SubPatternType.JHS_QS;
        }
        if (totalChords > 0) {
            const tripleRatio = triples / totalChords;
            const tripleDoubleRatio = doubles > 0 ? triples / doubles : 0;
            if (tripleRatio > 0.03 || tripleDoubleRatio > 0.10) {
                return SubPatternType.JHS_HS;
            }
        }
        return SubPatternType.JHS_JS;
    }

    else if (pattern === PatternType.STREAM) {
        if (totalChords > 0) {
            const highChordRatio = (doubles + triples + quads) / totalChords;
            const chaosScore = doubles * 1 + triples * 2 + quads * 4;
            const chaosRatio = totalChords > 0 ? chaosScore / (totalChords * 2) : 0;
            if (chaosRatio > 0.5 || highChordRatio > 0.3) {
                return SubPatternType.STREAM_CHAOS;
            }
        }
        return SubPatternType.STREAM_NORMAL;
    }

    else if (pattern === PatternType.TECH) {
        if (jackRate > 0.2) {
            return SubPatternType.TECH_JACK;
        }
        if (chordRatio < 0.3) {
            return SubPatternType.TECH_STREAM;
        }
        if (chordRatio > 0.4) {
            return SubPatternType.TECH_JHS;
        }
        return SubPatternType.TECH_PURE;
    }

    return SubPatternType.UNKNOWN;
}

class PatternAnalyzer {
    constructor(beatmap) {
        this.beatmap = beatmap;
        this.WINDOW_NOTES = 150;
        this.OVERLAP_NOTES = 50;
    }

    analyze() {
        const notes = this.beatmap.notes;
        const totalTime = this.beatmap.totalTime;
        if (totalTime <= 0 || !notes || notes.length === 0) {
            return [];
        }

        const results = [];
        let idx = 0;

        const sortedNotes = [...notes].sort((a, b) => a.time - b.time);
        const totalNotes = sortedNotes.length;
        const step = this.WINDOW_NOTES - this.OVERLAP_NOTES;

        const globalAvgDensity = totalTime > 0 ? notes.length / (totalTime / 1000) : 0;

        for (let startIdx = 0; startIdx < totalNotes; startIdx += step) {
            const endIdx = Math.min(startIdx + this.WINDOW_NOTES, totalNotes);
            if (endIdx - startIdx < 10) {
                continue;
            }

            const winNotes = sortedNotes.slice(startIdx, endIdx);

            const t0 = winNotes[0].time;
            const t1 = winNotes[winNotes.length - 1].time;
            const dur = t1 - t0;
            const n = winNotes.length;
            const density = dur > 0 ? n / (dur / 1000) : 0;
            const relDensity = globalAvgDensity > 0 ? density / globalAvgDensity : 0;
            const lnRatio = n > 0 ? winNotes.filter(x => x.isHold).length / n : 0;

            const chords = groupChords(winNotes);
            const singles = chords.filter(c => c.length === 1).length;
            const totalChordNotes = chords.reduce((sum, c) => sum + c.length, 0);
            const chordRatio = totalChordNotes > 0 ? (totalChordNotes - singles) / totalChordNotes : 0;

            const [jackRate, colDom] = detectJacks(winNotes);

            const keyCount = this.beatmap.keyCount;
            const colCounts = [];
            for (let c = 0; c < keyCount; c++) {
                colCounts.push(winNotes.filter(n => n.column === c).length);
            }
            const colEntropy = entropy(colCounts);

            const colSpan = avgColumnSpan(winNotes);

            const iv = intervalVariance(chords);

            const chordCounts = countChordTypes(chords);

            const jackDensity = calculateJackDensity(winNotes, chords);

            const jbar = computeJbarSunny(winNotes);
            const xbar = computeXbarSunny(winNotes);
            const pbar = computePbarSunny(winNotes);
            const abar = computeAbarSunny(winNotes);

            const [pattern, score] = classify(relDensity, jackRate, chordRatio, colEntropy,
                                               colDom, iv, colSpan, lnRatio);

            let rawDifficulty;
            if (pattern === PatternType.JACK) {
                rawDifficulty = (jbar * 3.0 + xbar * 0.5 + pbar * 0.5 + abar * 0.3) * 1000;
            } else if (pattern === PatternType.STREAM) {
                let ivBoost = 1.0 + iv * 0.3;
                if (chordRatio < 0.35 && iv > 0.5) {
                    ivBoost += 0.2;
                }
                rawDifficulty = (jbar * 0.5 + xbar * 1.0 + pbar * 3.0 * ivBoost + abar * 0.5) * 1000;
            } else if (pattern === PatternType.JHS) {
                rawDifficulty = (jbar * 1.5 + xbar * 1.5 + pbar * 1.0 + abar * 0.5) * 1000;
            } else {
                rawDifficulty = (jbar * 1.0 + xbar * 1.0 + pbar * 1.0 + abar * 1.0) * 1000;
            }

            const densityFactor = density > 0 ? Math.min(1.0, density / 15) : 0.0;
            const difficulty = rawDifficulty * densityFactor;

            const subPattern = classifySub(pattern, jackRate, relDensity, jackDensity,
                                            chordCounts, chordRatio, iv);

            const result = new WindowResult();
            result.windowIdx = idx;
            result.startTime = t0;
            result.endTime = t1;
            result.noteCount = n;
            result.density = Math.round(density * 100) / 100;
            result.jackRate = Math.round(jackRate * 1000) / 10;
            result.chordRatio = Math.round(chordRatio * 1000) / 1000;
            result.columnEntropy = Math.round(colEntropy * 1000) / 1000;
            result.colDominance = Math.round(colDom * 1000) / 1000;
            result.intervalVariance = Math.round(iv * 100) / 100;
            result.avgColumnSpan = Math.round(colSpan * 100) / 100;
            result.longNoteRatio = Math.round(lnRatio * 1000) / 1000;
            result.pattern = pattern;
            result.patternScore = Math.round(score * 10) / 10;
            result.subPattern = subPattern;
            result.chordCounts = chordCounts;
            result.jackDensity = Math.round(jackDensity * 1000) / 1000;
            result.jbar = Math.round(jbar * 1000 * 1000) / 1000;
            result.xbar = Math.round(xbar * 1000 * 1000) / 1000;
            result.pbar = Math.round(pbar * 1000 * 1000) / 1000;
            result.abar = Math.round(abar * 1000) / 1000;
            result.difficulty = Math.round(difficulty * 1000) / 1000;

            results.push(result);
            idx++;
        }
        return results;
    }
}

class AnalysisOutput {
    constructor(beatmap, windows) {
        this.beatmap = beatmap;
        this.windows = windows;
        this.windowPatterns = windows.map(w => w.pattern);
        this.windowSubPatterns = windows.map(w => w.subPattern);

        const counts = {};
        for (const p of this.windowPatterns) {
            counts[p] = (counts[p] || 0) + 1;
        }
        const total = this.windowPatterns.length;
        this.patternRatios = {};
        for (const p of Object.values(PatternType)) {
            this.patternRatios[p] = total > 0 ? (counts[p] || 0) / total * 100 : 0;
        }

        const activeWindows = windows.filter(w => w.noteCount > 5);
        let mapPattern;
        if (activeWindows.length > 0) {
            const activeCounts = {};
            for (const w of activeWindows) {
                activeCounts[w.pattern] = (activeCounts[w.pattern] || 0) + 1;
            }
            let maxCount = 0;
            mapPattern = PatternType.UNKNOWN;
            for (const [p, cnt] of Object.entries(activeCounts)) {
                if (cnt > maxCount) {
                    maxCount = cnt;
                    mapPattern = p;
                }
            }
        } else if (total > 0) {
            let maxCount = 0;
            mapPattern = PatternType.UNKNOWN;
            for (const [p, cnt] of Object.entries(counts)) {
                if (cnt > maxCount) {
                    maxCount = cnt;
                    mapPattern = p;
                }
            }
        } else {
            mapPattern = PatternType.UNKNOWN;
        }

        this.dominant = mapPattern;

        const difficultyScores = {};
        for (const w of activeWindows) {
            let baseDiff = w.difficulty;
            if (w.pattern === PatternType.TECH && w.intervalVariance > 0.5) {
                baseDiff *= 1.5;
            } else if (w.pattern === PatternType.JACK && w.jackRate > 30) {
                baseDiff *= 1.3;
            }
            difficultyScores[w.pattern] = (difficultyScores[w.pattern] || 0) + baseDiff;
        }

        const totalDifficulty = Object.values(difficultyScores).reduce((a, b) => a + b, 0);
        this.patternDifficultyRatios = {};
        for (const p of Object.values(PatternType)) {
            this.patternDifficultyRatios[p] = totalDifficulty > 0 ?
                (difficultyScores[p] || 0) / totalDifficulty * 100 : 0;
        }

        const subCounts = {};
        for (const sp of this.windowSubPatterns) {
            subCounts[sp] = (subCounts[sp] || 0) + 1;
        }
        this.subPatternRatios = {};
        for (const sp of Object.values(SubPatternType)) {
            this.subPatternRatios[sp] = total > 0 ? (subCounts[sp] || 0) / total * 100 : 0;
        }
    }

    toDict() {
        const patternRatios = {};
        for (const [p, v] of Object.entries(this.patternRatios)) {
            patternRatios[p] = Math.round(v * 10) / 10;
        }

        const patternDifficultyRatios = {};
        for (const [p, v] of Object.entries(this.patternDifficultyRatios)) {
            patternDifficultyRatios[p] = Math.round(v * 10) / 10;
        }

        const subPatternRatios = {};
        for (const [sp, v] of Object.entries(this.subPatternRatios)) {
            subPatternRatios[sp] = Math.round(v * 10) / 10;
        }

        return {
            beatmap: {
                title: this.beatmap.title,
                artist: this.beatmap.artist,
                version: this.beatmap.version,
                creator: this.beatmap.creator,
                key_count: this.beatmap.keyCount,
                total_time: Math.round(this.beatmap.totalTime * 10) / 10,
                note_count: this.beatmap.noteCount,
            },
            dominant_pattern: this.dominant,
            pattern_ratios: patternRatios,
            pattern_difficulty_ratios: patternDifficultyRatios,
            sub_pattern_ratios: subPatternRatios,
            timeline: this.windows.map(w => ({
                window_idx: w.windowIdx,
                start_time: Math.round(w.startTime * 10) / 10,
                end_time: Math.round(w.endTime * 10) / 10,
                pattern: w.pattern,
                sub_pattern: w.subPattern,
                difficulty: w.difficulty,
                density: w.density,
                jack_rate: w.jackRate,
                chord_ratio: w.chordRatio,
            })),
        };
    }
}

export function analyzeBeatmap(osuContent) {
    try {
        const bm = parseOsuFromText(osuContent);
        const analyzer = new PatternAnalyzer(bm);
        const windows = analyzer.analyze();
        const result = new AnalysisOutput(bm, windows);
        return { success: true, data: result.toDict() };
    } catch (error) {
        console.error("[KeyAnalyzer] Analysis error:", error);
        return { success: false, error: error.message };
    }
}