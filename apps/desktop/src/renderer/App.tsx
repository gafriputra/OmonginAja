import { useEffect, useRef, useState } from "react";
import {
  LANGUAGES,
  LatencyMeter,
  S2S_PROVIDERS,
  type Direction,
  type LanguageCode,
  type S2SProvider,
  UsageTracker,
} from "@omonginaja/shared";
import { captureDevice, listDevices, PcmPlayer, playThrough } from "./audio";
import { History } from "./History";
import { LineView } from "./LineView";
import { loadHistory, loadUsage, saveHistory, saveUsage, type Conversation, type Line } from "./storage";

/** Only the latest exchanges stay on the main screen; the full conversation lives in Riwayat. */
const LIVE_LINES = 4;

const VIRTUAL_HINTS = /blackhole|cable|omongin|loopback|virtual/i;

/**
 * One virtual cable shows up under slightly different labels: "BlackHole 2ch (Virtual)" and
 * "Default - BlackHole 2ch (Virtual)", or VB-Cable's "CABLE Input" (playback) and "CABLE Output" (recording).
 */
function deviceName(label: string) {
  return label
    .replace(/^(default|communications) - /i, "")
    .replace(/\s*\(.*\)$/, "")
    .replace(/\b(input|output)\b/gi, "")
    .trim()
    .toLowerCase();
}

export function App() {
  const [serverUrl, setServerUrl] = useState("http://localhost:8787");
  const [provider, setProvider] = useState<S2SProvider>("gemini");
  const [myLang, setMyLang] = useState<LanguageCode>("id");
  const [theirLang, setTheirLang] = useState<LanguageCode>("en");
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState("");
  const [virtualMicId, setVirtualMicId] = useState("");
  const [meetingAudioId, setMeetingAudioId] = useState("");
  /** Headset to speak the other side's translation into; empty = subtitles only. */
  const [listenId, setListenId] = useState("");
  const [originalVolume, setOriginalVolume] = useState(0.3);
  const passthrough = useRef<{ setVolume(v: number): void }>();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<"translate" | "history">("translate");
  const [lines, setLines] = useState<Line[]>([]);
  const [history, setHistory] = useState<Conversation[]>(loadHistory);
  const [elapsed, setElapsed] = useState(0);
  const usage = useRef(new UsageTracker(loadUsage()));
  const conversation = useRef<Conversation>();
  const linesRef = useRef<Line[]>([]);
  linesRef.current = lines;
  const [latency, setLatency] = useState<{ last: number; average: number }>();
  const cleanup = useRef<(() => void)[]>([]);
  const handlers = useRef(
    new Map<string, (event: Parameters<Parameters<Window["omongin"]["s2s"]["onEvent"]>[0]>[1]) => void>(),
  );

  useEffect(() => {
    window.omongin.s2s.onEvent((id, event) => handlers.current.get(id)?.(event));
    listDevices()
      .then(({ inputs, outputs }) => {
        setInputs(inputs);
        setOutputs(outputs);
        setMicId(inputs.find((d) => !VIRTUAL_HINTS.test(d.label))?.deviceId ?? inputs[0]?.deviceId ?? "");
        setVirtualMicId(outputs.find((d) => VIRTUAL_HINTS.test(d.label))?.deviceId ?? "");
        // Meeting audio needs a second virtual cable; never guess it, or it may be the
        // virtual mic itself and the app would translate its own output.
      })
      .catch((e: Error) => setStatus(`Akses mikrofon ditolak: ${e.message}`));
  }, []);

  /** Starts one provider session; transcripts stream in as deltas and are grouped into lines. */
  async function startDirection(direction: Direction, deviceId: string, targetLang: LanguageCode) {
    const id = `${direction}-${Date.now()}`;
    const player = new PcmPlayer();
    const meter = new LatencyMeter();
    const line: Line = { direction, original: "", translated: "" };
    let lineIndex = -1;

    const flush = () => {
      setLines((prev) => {
        const next = [...prev];
        if (lineIndex < 0 || lineIndex >= next.length) {
          next.push({ ...line });
          lineIndex = next.length - 1;
        } else next[lineIndex] = { ...line };
        return next;
      });
      if (direction === "incoming")
        window.omongin.showSubtitle({ original: line.original, translated: line.translated });
    };

    handlers.current.set(id, (event) => {
      if (event.type === "reconnecting") return setStatus("Menyambung ulang ke mesin penerjemah…");
      if (event.type === "closed") return stop();
      if (event.type !== "error") setStatus((s) => (s.startsWith("Menyambung ulang") ? "" : s));
      if (event.type === "audio") {
        if (direction === "incoming") {
          if (listenId) player.play(event.pcm);
          return;
        }
        player.play(event.pcm);
        const measured = meter.onOutput(performance.now());
        if (measured !== undefined) setLatency({ last: measured, average: meter.average! });
      } else if (event.type === "source_text") {
        line.original += event.text;
        flush();
      } else if (event.type === "translated_text") {
        line.translated += event.text;
        flush();
      } else if (event.type === "error") setStatus(event.message);
    });

    const rates = await window.omongin.s2s
      .start(id, serverUrl, { provider, targetLang, echoTargetLanguage: direction === "incoming" && !!listenId })
      .catch((e) => {
        handlers.current.delete(id);
        throw e;
      });
    if (direction === "outgoing") await player.open(virtualMicId, rates.output);
    if (direction === "incoming" && listenId) {
      await player.open(listenId, rates.output);
      // The meeting app now plays only into the virtual cable, so its voices reach the headset
      // through us, turned down under the translation.
      const through = await playThrough(deviceId, listenId, originalVolume);
      passthrough.current = through;
      cleanup.current.push(() => {
        through.stop();
        passthrough.current = undefined;
      });
    }

    let silentSince = performance.now();
    const stopCapture = await captureDevice(deviceId, rates.input, direction === "outgoing", (pcm) => {
      const now = performance.now();
      meter.onInput(pcm, now);
      window.omongin.s2s.audio(id, new Uint8Array(pcm.buffer));
      // Start a new line after a pause so the log reads as separate utterances.
      if (pcm.some((s) => Math.abs(s) > 650)) {
        if (now - silentSince > 1500 && (line.original || line.translated)) {
          line.original = "";
          line.translated = "";
          lineIndex = -1;
        }
        silentSince = now;
      }
    });

    const startedAt = Date.now();
    cleanup.current.push(() => {
      usage.current.record(provider, Math.round((Date.now() - startedAt) / 1000), new Date());
      saveUsage(usage.current.toJSON());
      stopCapture();
      window.omongin.s2s.stop(id);
      handlers.current.delete(id);
      void player.close();
    });
  }

  async function start() {
    setStatus("");
    setLatency(undefined);
    setLines([]);
    setElapsed(0);
    conversation.current = { id: crypto.randomUUID(), startedAt: Date.now(), provider, myLang, theirLang, lines: [] };
    try {
      if (!virtualMicId) throw new Error("Pilih perangkat mic virtual dulu (mis. BlackHole / VB-Cable).");
      const virtualMicLabel = outputs.find((d) => d.deviceId === virtualMicId)?.label ?? "";
      const meetingLabel = inputs.find((d) => d.deviceId === meetingAudioId)?.label ?? "";
      if (meetingLabel && deviceName(meetingLabel) === deviceName(virtualMicLabel)) {
        throw new Error(
          'Audio meeting tidak boleh sama dengan mic virtual, nanti terjemahanmu ikut diterjemahkan ulang. Pilih "Tidak dipakai" atau kabel virtual kedua.',
        );
      }
      if (listenId && listenId === virtualMicId) {
        throw new Error("Terjemahan mereka harus dibacakan ke headset, bukan ke mic virtual.");
      }
      await startDirection("outgoing", micId, theirLang);
      if (meetingAudioId) await startDirection("incoming", meetingAudioId, myLang);
      setRunning(true);
    } catch (e) {
      stop();
      setStatus((e as Error).message);
    }
  }

  function stop() {
    cleanup.current.splice(0).forEach((fn) => fn());
    setRunning(false);
    const finished = conversation.current;
    conversation.current = undefined;
    if (finished && linesRef.current.length) {
      setHistory((prev) => {
        const next = [{ ...finished, lines: linesRef.current }, ...prev];
        saveHistory(next);
        return next;
      });
    }
  }

  function deleteConversation(id: string) {
    setHistory((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveHistory(next);
      return next;
    });
  }

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const sessions = meetingAudioId ? 2 : 1;
  const usedToday = Math.round(
    (usage.current.secondsOn(provider, new Date()) + (running ? elapsed * sessions : 0)) / 60,
  );

  const deviceSelect = (
    devices: MediaDeviceInfo[],
    value: string,
    onChange: (id: string) => void,
    optional = false,
  ) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={running}>
      {optional && <option value="">Tidak dipakai</option>}
      {!optional && !value && <option value="">Pilih perangkat…</option>}
      {devices.map((d) => (
        <option key={d.deviceId} value={d.deviceId}>
          {d.label || d.deviceId}
        </option>
      ))}
    </select>
  );

  const languageSelect = (value: LanguageCode, onChange: (code: LanguageCode) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value as LanguageCode)} disabled={running}>
      {Object.entries(LANGUAGES).map(([code, name]) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
    </select>
  );

  return (
    <main>
      <h1>OmonginAja</h1>
      <p className="tagline">Ngomong pakai bahasamu, lawan bicara dengar bahasanya.</p>

      <nav className="tabs">
        <button className={tab === "translate" ? "active" : ""} onClick={() => setTab("translate")}>
          Terjemah
        </button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
          Riwayat{history.length ? ` (${history.length})` : ""}
        </button>
      </nav>

      {tab === "history" ? (
        <History conversations={history} onDelete={deleteConversation} />
      ) : (
        <>
          <section className="langs">
            <label>Bahasaku{languageSelect(myLang, setMyLang)}</label>
            <label>Bahasa lawan bicara{languageSelect(theirLang, setTheirLang)}</label>
          </section>

          <section>
            <label>
              Mesin penerjemah
              <select value={provider} onChange={(e) => setProvider(e.target.value as S2SProvider)} disabled={running}>
                {Object.entries(S2S_PROVIDERS).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>Mikrofon asli{deviceSelect(inputs, micId, setMicId)}</label>
            <label>Kirim terjemahan ke (mic virtual){deviceSelect(outputs, virtualMicId, setVirtualMicId)}</label>
            <label>Audio meeting (untuk subtitle){deviceSelect(inputs, meetingAudioId, setMeetingAudioId, true)}</label>
            {meetingAudioId && (
              <label>
                Bacakan terjemahan mereka ke (headset)
                {deviceSelect(outputs, listenId, setListenId, true)}
              </label>
            )}
            {meetingAudioId && listenId && (
              <label>
                Volume suara asli mereka: {Math.round(originalVolume * 100)}%
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={originalVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setOriginalVolume(v);
                    passthrough.current?.setVolume(v);
                  }}
                />
              </label>
            )}
            <label>
              Server
              <input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} disabled={running} />
            </label>
          </section>

          <button className={running ? "stop" : "start"} onClick={running ? stop : start}>
            {running ? "Berhenti" : "Mulai menerjemahkan"}
          </button>
          {status && <p className="status">{status}</p>}
          {latency && (
            <p className="latency">
              Jeda terakhir <strong>{(latency.last / 1000).toFixed(2)} dtk</strong> · rata-rata{" "}
              {(latency.average / 1000).toFixed(2)} dtk
            </p>
          )}

          <p className="usage">
            {running && <>Sesi ini {formatDuration(elapsed)} · </>}
            Pemakaian {S2S_PROVIDERS[provider].split(" ")[0]} hari ini ±{usedToday} menit
            {meetingAudioId && " (subtitle aktif: dihitung 2×)"}
          </p>

          {lines.length > 0 && (
            <section className="log">
              {lines.slice(-LIVE_LINES).map((l, i) => (
                <LineView key={i} line={l} />
              ))}
              {lines.length > LIVE_LINES && (
                <p className="more">Percakapan lengkap tersimpan di Riwayat setelah kamu berhenti.</p>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
}
