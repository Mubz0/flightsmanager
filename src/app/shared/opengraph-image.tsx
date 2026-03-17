import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FlightsManager — Shared Itinerary";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 700, color: "white", marginBottom: 16 }}>
          FlightsManager
        </div>
        <div style={{ fontSize: 32, color: "rgba(255,255,255,0.85)", marginBottom: 40 }}>
          AI Travel Agent
        </div>
        <div
          style={{
            display: "flex",
            gap: 24,
            padding: "24px 48px",
            background: "rgba(255,255,255,0.15)",
            borderRadius: 16,
          }}
        >
          <div style={{ fontSize: 24, color: "white" }}>Shared Flight Itinerary</div>
        </div>
        <div style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", marginTop: 32 }}>
          Click to view flights and continue planning
        </div>
      </div>
    ),
    { ...size }
  );
}
