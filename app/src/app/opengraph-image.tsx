import { ImageResponse } from "next/og";

export const alt = "Halal (HLC) — CPI-indexed stablecoin DAO";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0b1220",
          color: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "76px 86px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ color: "#34d399", display: "flex", fontSize: 30, fontWeight: 700 }}>HALAL / HLC</div>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, letterSpacing: "-3px", lineHeight: 1.05 }}>
            Stable purchasing power.
          </div>
          <div style={{ color: "#cbd5e1", display: "flex", fontSize: 32, lineHeight: 1.25, maxWidth: 850 }}>
            A CPI-indexed, DAO-governed stablecoin protocol with a collateralized PSM and transparent vesting.
          </div>
        </div>
        <div style={{ color: "#94a3b8", display: "flex", fontSize: 24 }}>
          Open source · Ethereum / Arbitrum · MIT licensed
        </div>
      </div>
    ),
    { ...size },
  );
}
