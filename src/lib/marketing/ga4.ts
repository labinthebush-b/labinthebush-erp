// Server-only GA4 Data API client. The service-account key never reaches the
// browser: this module is only imported by app/api/marketing/route.ts.

import { createSign } from "node:crypto";
import { FUNNEL_EVENTS, type Ga4Summary, type MarketingPeriodDays } from "./types";
import { describeApiError, parseGa4 } from "./normalize";

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** OAuth2 "JWT bearer" da conta de serviço, assinado à mão com o crypto do Node — sem dependência nova. */
async function getAccessToken(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(privateKey));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(describeApiError("GA4", res.status, body));
  return body.access_token as string;
}

export async function fetchGa4Summary(days: MarketingPeriodDays): Promise<Ga4Summary> {
  const email = process.env.GA4_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY;
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!email || !rawKey || !propertyId) throw new Error("GA4 não configurado neste ambiente.");

  // Em .env/Vercel a chave costuma vir com "\n" literais em vez de quebras de linha.
  const token = await getAccessToken(email, rawKey.replace(/\\n/g, "\n"));
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];

  async function runReport(body: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ dateRanges, ...body }),
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(describeApiError("GA4", res.status, json));
    return json;
  }

  const [totals, events] = await Promise.all([
    runReport({ metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "activeUsers" }] }),
    runReport({
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: [...FUNNEL_EVENTS] } } },
    }),
  ]);
  return parseGa4(totals, events);
}
