import { useState } from "react";
import { LANGUAGES, S2S_PROVIDERS } from "@omonginaja/shared";
import { LineView } from "./LineView";
import type { Conversation } from "./storage";

export function History({
  conversations,
  onDelete,
}: {
  conversations: Conversation[];
  onDelete: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string>();

  if (!conversations.length) {
    return <p className="empty">Belum ada percakapan. Percakapan tersimpan di sini setelah kamu klik Berhenti.</p>;
  }

  return (
    <section className="history">
      {conversations.map((c) => {
        const open = c.id === openId;
        return (
          <article key={c.id} className="conversation">
            <button className="conversation-head" onClick={() => setOpenId(open ? undefined : c.id)}>
              <span>{new Date(c.startedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
              <span className="meta">
                {LANGUAGES[c.myLang]} ⇄ {LANGUAGES[c.theirLang]} · {S2S_PROVIDERS[c.provider].split(" ")[0]} ·{" "}
                {c.lines.length} kalimat
              </span>
            </button>
            {open && (
              <div className="log">
                {c.lines.map((l, i) => (
                  <LineView key={i} line={l} />
                ))}
                <button className="delete" onClick={() => onDelete(c.id)}>
                  Hapus percakapan ini
                </button>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
