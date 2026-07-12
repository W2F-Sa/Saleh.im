/**
 * Cloudflare Pages Function — GET /api/ip
 *
 * Reads the visitor's IP and geolocation from the Cloudflare edge
 * (request.cf + headers) and returns it as JSON. No data is stored or logged.
 *
 * Deployed automatically by Cloudflare Pages from the /functions directory.
 */

interface CfProperties {
  city?: string;
  region?: string;
  regionCode?: string;
  country?: string;
  postalCode?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
  asOrganization?: string;
  asn?: number;
  colo?: string;
}

interface EventContext {
  request: Request & { cf?: CfProperties };
}

export const onRequestGet = async (context: EventContext): Promise<Response> => {
  const { request } = context;
  const cf = request.cf ?? {};

  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "unknown";

  const body = {
    ip,
    city: cf.city ?? null,
    region: cf.region ?? null,
    regionCode: cf.regionCode ?? null,
    country: cf.country ?? null,
    countryCode: cf.country ?? null,
    postal: cf.postalCode ?? null,
    latitude: cf.latitude ?? null,
    longitude: cf.longitude ?? null,
    timezone: cf.timezone ?? null,
    isp: cf.asOrganization ?? null,
    asn: cf.asn ? `AS${cf.asn}` : null,
    colo: cf.colo ?? null,
    source: "saleh.im/api (Cloudflare edge)",
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
};
