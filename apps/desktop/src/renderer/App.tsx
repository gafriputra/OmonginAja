import { useEffect, useRef, useState } from "react";
import {
  LANGUAGES,
  LatencyMeter,
  S2S_PROVIDERS,
  type Direction,
  type LanguageCode,
  type S2SProvider,
} from "@omonginaja/shared";
import { captureDevice, listDevices, PcmPlayer } from "./audio";

interface Line {
  direction: Direction;
  original: string;
  translated: string;
}

const VIRTUAL_HINTS = /blackhole|cable|omongin|loopback|virtual/i;

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
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [latency, setLatency] = useState<{ last: number; average: number }>();
  const cleanup = useRef<(() => void)[]>([]);
  const handlers = useRef(new Map<string, (event: Parameters<Parameters<Window["omongin"]["s2s"]["onEvent"]>[0]>[1]) => void>());

  useEffect(() => {
    window.omongin.s2s.onEvent((id, event) => handlers.current.get(id)?.(event));
    listDevices()
      .then(({ inputs, outputs }) => {
        setInputs(inputs);
        setOutputs(outputs);
        setMicId(inputs.find((d) => !VIRTUAL_HINTS.test(d.label))?.deviceId ?? inputs[0]?.deviceId ?? "");
        setVirtualMicId(outputs.find((d) => VIRTUAL_HINTS.test(d.label))?.deviceId ?? "");
        setMeetingAudioId(inputs.find((d) => VIRTUAL_HINTS.test(d.label))?.deviceId ?? "");
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
        return next.slice(-50);
      });
      if (direction === "incoming") window.omongin.showSubtitle({ original: line.original, translated: line.translated });
    };

    handlers.current.set(id, (event) => {
      if (event.type === "audio") {
        if (direction !== "outgoing") return;
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
      else if (event.type === "closed") setRunning(false);
    });

    const rates = await window.omongin.s2s.start(id, serverUrl, { provider, targetLang });
    if (direction === "outgoing") await player.open(virtualMicId, rates.output);

    let silentSince = performance.now();
    const stopCapture = await captureDevice(deviceId, rates.input, (pcm) => {
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

    cleanup.current.push(() => {
      stopCapture();
      window.omongin.s2s.stop(id);
      handlers.current.delete(id);
      void player.close();
    });
  }

  async function start() {
    setStatus("");
    setLatency(undefined);
    try {
      if (!virtualMicId) throw new Error("Pilih perangkat mic virtual dulu (mis. BlackHole / VB-Cable).");
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
  }

  const deviceSelect = (devices: MediaDeviceInfo[], value: string, onChange: (id: string) => void, optional = false) => (
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

      <section className="log">
        {lines.map((l, i) => (
          <div key={i} className={`line ${l.direction}`}>
            <span className="who">{l.direction === "outgoing" ? "Kamu" : "Mereka"}</span>
            <span className="original">{l.original}</span>
            <span className="translated">{l.translated}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
