"use client";

export interface ContactRow {
  name: string;
  email: string;
}

/** Accepts "Name <email>", "Name, email", bare "email", or just "Name" per
 *  line. Commas only split when the second part looks like an email, so a
 *  plain comma-separated list of names works too. */
export function parseContactList(text: string): ContactRow[] {
  const parsed: ContactRow[] = [];
  for (const line of text.split(/[\n;]+/)) {
    const t = line.trim();
    if (!t) continue;
    const angle = t.match(/^(.*?)<([^>]+)>$/);
    if (angle) {
      parsed.push({ name: angle[1].trim(), email: angle[2].trim() });
      continue;
    }
    const comma = t.split(/[,\t]/).map((s) => s.trim());
    if (comma.length >= 2 && comma[1].includes("@")) {
      parsed.push({ name: comma[0], email: comma[1] });
      continue;
    }
    if (t.includes("@")) {
      parsed.push({ name: t.split("@")[0], email: t });
      continue;
    }
    for (const name of comma) if (name) parsed.push({ name, email: "" });
  }
  return parsed;
}

const looksLikeEmail = (v: string) => /.+@.+\..+/.test(v.trim());

/** Rows ready to send: a name, and an email only if one was typed. */
export function validContactRows(rows: ContactRow[]): ContactRow[] {
  return rows.filter(
    (r) => r.name.trim() && (!r.email.trim() || looksLikeEmail(r.email)),
  );
}

export function ContactListEditor({
  rows,
  onChange,
}: {
  rows: ContactRow[];
  onChange: (rows: ContactRow[]) => void;
}) {
  function setRow(i: number, patch: Partial<ContactRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    onChange([...rows, { name: "", email: "" }]);
  }
  function removeRow(i: number) {
    onChange(
      rows.length === 1
        ? [{ name: "", email: "" }]
        : rows.filter((_, idx) => idx !== i),
    );
  }
  function parseBulk(text: string) {
    const parsed = parseContactList(text);
    if (parsed.length) onChange(parsed);
  }

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
            <input
              className="field min-w-0"
              placeholder="Name"
              aria-label={`Guest ${i + 1} name`}
              autoComplete="off"
              maxLength={120}
              required={Boolean(r.email.trim())}
              value={r.name}
              onChange={(e) => setRow(i, { name: e.target.value })}
            />
            <input
              type="email"
              className="field min-w-0"
              placeholder="Email (optional)"
              aria-label={`Guest ${i + 1} email`}
              autoComplete="off"
              autoCapitalize="none"
              maxLength={200}
              value={r.email}
              onChange={(e) => setRow(i, { email: e.target.value })}
            />
          </div>
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="grid size-12 shrink-0 place-items-center rounded-xl border border-line-strong text-muted transition-colors hover:text-coral-ink"
            aria-label={`Remove guest ${i + 1}`}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="min-h-11 text-sm font-bold text-coral-ink underline underline-offset-2"
      >
        + Add another
      </button>

      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-3 text-muted">
          Paste a list instead
        </summary>
        <textarea
          className="field mt-2"
          rows={3}
          aria-label="Paste guest names, with or without emails"
          placeholder={
            "Aisha Khan <aisha@example.com>\nMarco, marco@example.com\nJo\nSam, Priya, Wei"
          }
          onChange={(e) => parseBulk(e.target.value)}
        />
      </details>
    </div>
  );
}
