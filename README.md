# OmonginAja

Ngomong pakai bahasamu, lawan bicara dengar bahasanya. OmonginAja menerjemahkan suaramu secara realtime dan mengirimkannya ke Google Meet, Zoom, Teams, atau aplikasi meeting lain lewat **mic virtual**. Suara lawan bicara diterjemahkan balik dan muncul sebagai subtitle di atas layar.

## Cara kerja

OmonginAja memakai **model speech-to-speech simultan**: model menerjemahkan sambil kamu masih bicara, bukan menunggu kalimat selesai, jadi jedanya terasa seperti penerjemah simultan.

```
Jalur keluar:  mic asli → model simultan (Gemini / OpenAI) → mic virtual → Meet/Zoom/Teams
Jalur masuk:   audio meeting (loopback) → model simultan → subtitle overlay
```

Audio mengalir langsung dari app ke provider. Server OmonginAja hanya membuat token sementara, jadi API key tidak pernah ada di app dan tidak ada hop jaringan tambahan.

| Bagian | Lokasi | Isi |
| --- | --- | --- |
| Desktop app | `apps/desktop` | Electron + React: pilih bahasa, mesin penerjemah & perangkat, koneksi ke provider, putar ke mic virtual, overlay subtitle, pengukur jeda |
| Token server | `apps/server` | `POST /session` → token sementara Gemini Live / OpenAI Realtime |
| Shared | `packages/shared` | Adapter protokol tiap provider, pengukur latensi, daftar bahasa |

Mesin penerjemah yang didukung:

- **Gemini 3.5 Live Translate** (`gemini-3.5-live-translate-preview`), 70+ bahasa.
- **OpenAI gpt-realtime-translate**, input 70+ bahasa, output 13 bahasa.

App menampilkan **jeda terakhir dan rata-rata** (dari kamu mulai bicara sampai suara terjemahan pertama keluar) supaya kedua mesin bisa dibandingkan.

## Menjalankan

Butuh Node.js 20+.

```bash
npm install
cp .env.example apps/server/.env   # isi GEMINI_API_KEY dan/atau OPENAI_API_KEY
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
