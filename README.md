# OmonginAja

Ngomong pakai bahasamu, lawan bicara dengar bahasanya. OmonginAja menerjemahkan suaramu secara realtime dan mengirimkannya ke Google Meet, Zoom, Teams, atau aplikasi meeting lain lewat **mic virtual**. Suara lawan bicara diterjemahkan balik dan muncul sebagai subtitle di atas layar.

## Cara kerja

```
Jalur keluar:  mic asli → server (STT → terjemahan → TTS) → mic virtual → Meet/Zoom/Teams
Jalur masuk:   audio meeting (loopback) → server (STT → terjemahan) → subtitle overlay
```

| Bagian | Lokasi | Isi |
| --- | --- | --- |
| Desktop app | `apps/desktop` | Electron + React: pilih bahasa & perangkat, tangkap audio, putar ke mic virtual, overlay subtitle |
| Server realtime | `apps/server` | WebSocket `/realtime`, pipeline STT → terjemahan → TTS dengan provider yang bisa ditukar |
| Protokol bersama | `packages/shared` | Tipe pesan WebSocket dan daftar bahasa |

Provider default (mode `live`): Deepgram (STT), Claude (terjemahan), ElevenLabs (TTS). Mode `mock` jalan tanpa API key untuk pengembangan.

## Menjalankan

Butuh Node.js 20+.

```bash
npm install
cp .env.example apps/server/.env   # isi API key kalau mau mode live
npm run build -w @omonginaja/shared
npm run dev:server                  # terminal 1
npm run dev:desktop                 # terminal 2
```

### Menyiapkan mic virtual (MVP)

Untuk sekarang OmonginAja memakai kabel audio virtual yang sudah ada:

- **macOS**: install [BlackHole 2ch](https://existential.audio/blackhole/).
- **Windows**: install [VB-Cable](https://vb-audio.com/Cable/).

Lalu:

1. Di OmonginAja, pilih **Kirim terjemahan ke** = `BlackHole 2ch` / `CABLE Input`.
2. Di Meet/Zoom/Teams, pilih mikrofon = `BlackHole 2ch` / `CABLE Output`.
3. Untuk subtitle, arahkan output speaker meeting ke kabel virtual kedua (atau Multi-Output Device di macOS) dan pilih sebagai **Audio meeting**.

Driver audio bawaan OmonginAja sendiri menyusul setelah MVP.

## Tes

```bash
npm test
```
