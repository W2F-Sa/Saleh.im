"use client";

import { useCallback, useEffect, useState } from "react";
import { Reveal } from "./reveal";

type IpInfo = {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  postal?: string;
  latitude?: number | string;
  longitude?: number | string;
  timezone?: string;
  isp?: string;
  asn?: string;
  source?: string;
};

async function fetchIpInfo(): Promise<IpInfo> {
  try {
    const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const res = await fetch(`${bp}/api/ip`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) return { ...data, source: data.source || "saleh.im/api" };
    }
  } catch {
    /* fall through */
  }
  const res = await fetch("https://ipwho.is/", { cache: "no-store" });
  const d = await res.json();
  return {
    ip: d.ip,
    city: d.city,
    region: d.region,
    country: d.country,
    countryCode: d.country_code,
    postal: d.postal,
    latitude: d.latitude,
    longitude: d.longitude,
    timezone: d.timezone?.id,
    isp: d.connection?.isp,
    asn: d.connection?.asn ? `AS${d.connection.asn}` : undefined,
    source: "ipwho.is",
  };
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5" style={{ borderTop: "1px solid var(--line)" }}>
      <span className="label">{label}</span>
      <span className="mono max-w-[58%] truncate text-right text-sm font-medium">{value ?? "—"}</span>
    </div>
  );
}

export function IpTool() {
  const [info, setInfo] = useState<IpInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo(await fetchIpInfo());
    } catch {
      setError("Couldn't reach the geolocation service.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flag = info?.countryCode
    ? String.fromCodePoint(
        ...info.countryCode.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0))
      )
    : "";

  return (
    <section id="ip" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="wrap">
        <Reveal>
          <p className="label">Bonus / Live edge API</p>
          <h2 className="display mt-3 max-w-3xl text-4xl sm:text-5xl">
            A tiny edge function that knows{" "}
            <span className="display-italic accent-text">where you are.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-[var(--fg-2)]">
            A Cloudflare Pages Function reads your request geo-data at the edge and returns
            JSON from <code className="mono rounded px-1.5 py-0.5" style={{ background: "var(--bg-3)" }}>/api/ip</code>.
            Running live, right now — nothing stored.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="panel overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
                <span className="mono text-xs" style={{ color: "var(--accent)" }}>GET /api/ip</span>
                <button
                  onClick={load}
                  className="mono rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-[var(--bg-3)]"
                  style={{ borderColor: "var(--line-2)" }}
                >
                  {loading ? "…" : "↻ refresh"}
                </button>
              </div>
              <div className="p-5">
                {error ? (
                  <p className="mono text-sm" style={{ color: "var(--accent)" }}>{error}</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-4 pb-2.5">
                      <span className="label">IP address</span>
                      <span className="mono text-lg font-semibold" style={{ color: "var(--accent)" }}>
                        {loading ? "resolving…" : info?.ip}
                      </span>
                    </div>
                    <Row label="City" value={loading ? "…" : info?.city} />
                    <Row label="Region" value={loading ? "…" : info?.region} />
                    <Row label="Country" value={loading ? "…" : info?.country ? `${flag} ${info.country}` : "—"} />
                    <Row label="Coordinates" value={loading ? "…" : info?.latitude ? `${info.latitude}, ${info.longitude}` : "—"} />
                    <Row label="Timezone" value={loading ? "…" : info?.timezone} />
                    <Row label="ISP" value={loading ? "…" : info?.isp} />
                    <Row label="ASN" value={loading ? "…" : info?.asn} />
                    <Row label="Source" value={loading ? "…" : info?.source} />
                  </>
                )}
              </div>
            </div>

            <div className="panel flex flex-col justify-between p-5">
              <div>
                <p className="label">Raw response</p>
                <pre
                  className="mono mt-4 max-h-[340px] overflow-auto rounded-xl p-4 text-xs leading-relaxed"
                  style={{ background: "var(--bg-3)", color: "var(--fg-2)" }}
                >
{loading ? "// resolving…" : JSON.stringify(info ?? {}, null, 2)}
                </pre>
              </div>
              <p className="mt-4 text-xs text-[var(--fg-2)]">
                Lookups run in your browser against the edge function, falling back to a
                public provider off-Cloudflare. No logging, no storage.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
