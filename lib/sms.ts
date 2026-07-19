/**
 * Optional SMS via Twilio REST API.
 * Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER on Vercel.
 */

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Normalize Ghana-style and international numbers to E.164 when possible. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = digitsOnly(raw);
  if (!digits) return null;

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) {
    digits = `233${digits.slice(1)}`;
  }
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

export type SmsSendResult = {
  configured: boolean;
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
};

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

export async function sendSmsToPhones(
  phones: string[],
  message: string,
): Promise<SmsSendResult> {
  const unique = Array.from(
    new Set(
      phones
        .map((p) => normalizePhone(p))
        .filter((p): p is string => Boolean(p)),
    ),
  );

  if (!isSmsConfigured()) {
    return {
      configured: false,
      sent: 0,
      failed: 0,
      skipped: unique.length,
      errors: ["SMS not configured (set Twilio env vars)."],
    };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Sequential to avoid Twilio rate spikes on free tier
  for (const to of unique) {
    try {
      const body = new URLSearchParams({ To: to, From: from, Body: message });
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      if (!res.ok) {
        failed += 1;
        const text = await res.text();
        errors.push(`${to}: ${text.slice(0, 120)}`);
      } else {
        sent += 1;
      }
    } catch (err) {
      failed += 1;
      errors.push(`${to}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { configured: true, sent, failed, skipped: 0, errors };
}
