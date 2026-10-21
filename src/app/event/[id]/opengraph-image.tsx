import { ImageResponse } from "next/og";
import { loadEvent, shareFacts } from "@/lib/events";

export const runtime = "nodejs";
export const alt = "Plan summary";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CREAM = "#FDF2D9";
const SURFACE = "#FFF8EA";
const INK = "#2C2623";
const MUTED = "#5C524D";
const GRAPE = "#D6C7F0";
const PEACH = "#F9C6B4";
const MINT = "#A8DADC";

/** Link-preview card: the plan at a glance for group chats and socials. */
export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { event } = await loadEvent(id);

  const title = event?.title ?? "See Ya!";
  const facts = event ? shareFacts(event) : null;
  const rows = facts
    ? [
        [facts.confirmed ? "Date" : "Dates", facts.when],
        ["Time", facts.time],
        ["Where", facts.where],
      ].filter((r): r is [string, string] => Boolean(r[1]))
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: CREAM,
          padding: 48,
          fontFamily: "sans-serif",
          color: INK,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: SURFACE,
            border: `4px solid ${INK}`,
            borderRadius: 36,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: GRAPE,
              padding: "20px 44px",
              borderBottom: `4px solid ${INK}`,
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            <span>See Ya!</span>
            {facts && (
              <span
                style={{
                  background: facts.confirmed ? MINT : PEACH,
                  border: `3px solid ${INK}`,
                  borderRadius: 999,
                  padding: "6px 22px",
                  fontSize: 24,
                }}
              >
                {facts.confirmed
                  ? "Confirmed"
                  : `${facts.replies} ${facts.replies === 1 ? "reply" : "replies"} so far`}
              </span>
            )}
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "36px 44px",
            }}
          >
            {facts && (
              <div
                style={{ display: "flex", fontSize: 28, color: MUTED, fontWeight: 600 }}
              >
                {`${facts.host} is inviting you`}
              </div>
            )}
            <div
              style={{
                marginTop: 10,
                fontSize: title.length > 40 ? 56 : 72,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                display: "flex",
              }}
            >
              {title.length > 90 ? `${title.slice(0, 88)}…` : title}
            </div>
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {rows.map(([label, value]) => (
                <div
                  key={label}
                  style={{ display: "flex", alignItems: "baseline", gap: 20 }}
                >
                  <span
                    style={{
                      width: 120,
                      fontSize: 22,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: MUTED,
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ fontSize: 34, fontWeight: 700 }}>
                    {value.length > 60 ? `${value.slice(0, 58)}…` : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
