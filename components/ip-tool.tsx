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

/**
 * Fetches geo/IP info. Tries the site's own Cloudflare Pages Function first
 * (/api/ip — reads request.cf on the edge), then falls back to a public,
 * CORS-enabled provider so the widget works in dev and anywhere it's hosted.
 */
async function fetchIpInfo(): Promise<IpInfo> {
  try {
    const res = await fetch("/api/ip", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) return { ...data, source: data.source || "saleh.im/api" };
    }
  } catch {
    /* fall through to public provider */
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
    <div className="flex items-center justify-between gap-4 border-b py-2.5 text-sm last:border-0" style={{ borderColor: "var(--border)" }}>
      <span className="text-[var(--fg-muted)]">{label}</span>
      <span className="max-w-[60%] truncate text-right font-mono font-medium">
        {value ?? "—"}
      </span>
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
      setError("Couldn't reach the geolocation service. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flag = info?.countryCode
    ? String.fromCodePoint(
        ...info.countryCode
          .toUpperCase()
          .split("")
          .map((c) => 127397 + c.charCodeAt(0))
      )
    : "";

  return (
    <section id="ip" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-page">
        <Reveal>
          <span className="section-label">05 — Live API</span>
          <h2 className="heading-lg max-w-3xl">
            IP &amp; Location lookup{" "}
            <span className="text-[var(--fg-muted)]">— powered by the edge</span>
          </h2>
          <p className="mt-4 max-w-2xl text-[var(--fg-muted)]">
            A tiny Cloudflare Pages Function reads your request geo-data at the edge and
            returns it as JSON at <code className="rounded bg-[var(--bg-soft)] px-1.5 py-0.5 font-mono text-sm">/api/ip</code>.
            Here it is, running live:
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <span className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-400/80" />
                    <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
                    <span className="h-3 w-3 rounded-full bg-green-400/80" />
                  </span>
                  <span className="ml-2 font-mono text-xs text-[var(--fg-muted)]">
                    GET /api/ip
                  </span>
                </div>
                <button
                  onClick={load}
                  className="rounded-md border px-2.5 py-1 font-mono text-xs transition-colors hover:bg-[var(--bg-soft)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  {loading ? "…" : "↻ refresh"}
                </button>
              </div>
              <div className="p-5">
                {error ? (
                  <p className="font-mono text-sm text-red-400">{error}</p>
                ) : (
                  <>
                    <Row label="IP address" value={loading ? "resolving…" : info?.ip} />
                    <Row label="City" value={loading ? "…" : info?.city} />
                    <Row label="Region" value={loading ? "…" : info?.region} />
                    <Row
                      label="Country"
                      value={loading ? "…" : info?.country ? `${flag} ${info.country}` : "—"}
                    />
                    <Row label="Postal" value={loading ? "…" : info?.postal} />
                    <Row
                      label="Coordinates"
                      value={
                        loading
                          ? "…"
                          : info?.latitude
                            ? `${info.latitude}, ${info.longitude}`
                            : "—"
                      }
                    />
                    <Row label="Timezone" value={loading ? "…" : info?.timezone} />
                    <Row label="ISP" value={loading ? "…" : info?.isp} />
                    <Row label="ASN" value={loading ? "…" : info?.asn} />
                    <Row label="Source" value={loading ? "…" : info?.source} />
                  </>
                )}
              </div>
            </div>

            <div className="card flex flex-col justify-between p-5">
              <div>
                <h3 className="font-mono text-sm uppercase tracking-widest text-[var(--fg-muted)]">
                  Raw JSON
                </h3>
                <pre className="mt-4 max-h-[360px] overflow-auto rounded-xl bg-[var(--bg-soft)] p-4 font-mono text-xs leading-relaxed text-[var(--fg-muted)]">
{loading ? "// resolving…" : JSON.stringify(info ?? {}, null, 2)}
                </pre>
              </div>
              <p className="mt-4 text-xs text-[var(--fg-muted)]">
                No data is stored. Lookups run in your browser against the edge function
                (falls back to a public provider when hosted off-Cloudflare).
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
