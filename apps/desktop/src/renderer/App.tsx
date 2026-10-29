import { useEffect, useRef, useState } from "react";
import { LANGUAGES, type LanguageCode, type ServerMessage } from "@omonginaja/shared";
import { captureDevice, listDevices, PcmPlayer } from "./audio";
import { RealtimeClient } from "./realtime";

interface Line {
  direction: "outgoing" | "incoming";
  original: string;
  translated: string;
}

const VIRTUAL_HINTS = /blackhole|cable|omongin|loopback|virtual/i;

export function App() {
  const [serverUrl, setServerUrl] = useState("ws://localhost:8787/realtime");
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
  const cleanup = useRef<(() => void)[]>([]);

  useEffect(() => {
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

  function addLine(line: Line) {
    setLines((prev) => [...prev.slice(-49), line]);
    if (line.direction === "incoming") window.omongin?.showSubtitle(line);
  }

  async function startDirection(direction: Line["direction"], deviceId: string) {
    const player = new PcmPlayer();
    let lastTranscript = "";
    const client = new RealtimeClient(serverUrl, {
      onMessage: (msg: ServerMessage) => {
        if (msg.type === "transcript" && msg.final) lastTranscript = msg.text;
        if (msg.type === "translation") addLine({ direction, original: lastTranscript, translated: msg.text });
        if (msg.type === "speech_start") void player.open(virtualMicId, msg.sampleRate);
        if (msg.type === "error") setStatus(msg.message);
      },
      onAudio: (pcm) => player.play(pcm),
      onClose: () => setRunning(false),
    });
    await client.opened();
    client.send(
      direction === "outgoing"
        ? { type: "start", direction, sourceLang: myLang, targetLang: theirLang, speak: true }
        : { type: "start", direction, sourceLang: "auto", targetLang: myLang, speak: false },
    );
    const stopCapture = await captureDevice(deviceId, (pcm) => client.sendAudio(pcm));
    cleanup.current.push(() => {
      stopCapture();
      client.close();
      void player.close();
    });
  }

  async function start() {
    setStatus("");
    try {
      if (!virtualMicId) throw new Error("Pilih perangkat mic virtual dulu (mis. BlackHole / VB-Cable).");
      await startDirection("outgoing", micId);
      if (meetingAudioId) await startDirection("incoming", meetingAudioId);
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

  return (
    <main>
      <h1>OmonginAja</h1>
      <p className="tagline">Ngomong pakai bahasamu, lawan bicara dengar bahasanya.</p>

      <section className="langs">
        <label>
          Bahasaku
          <select value={myLang} onChange={(e) => setMyLang(e.target.value as LanguageCode)} disabled={running}>
            {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        <label>
          Bahasa lawan bicara
          <select value={theirLang} onChange={(e) => setTheirLang(e.target.value as LanguageCode)} disabled={running}>
            {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
      </section>

      <section>
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
