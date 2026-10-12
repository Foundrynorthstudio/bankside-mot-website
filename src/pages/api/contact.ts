import type { APIRoute } from 'astro';
import { sendCallbackEmail } from '../../lib/booking/email';
import { jsonNoStore } from '../../lib/booking/http';
import { consumeRateLimit, rateLimits } from '../../lib/booking/rate-limit';
import { normalisePhone } from '../../lib/booking/validate';

export const prerender = false;

const PHONE_PATTERN = /^[0-9+]{10,16}$/;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!(await consumeRateLimit('contact', clientAddress, rateLimits.contact.limit, rateLimits.contact.windowMs))) {
    return jsonNoStore({ error: 'Too many callback requests. Please call 01324 613007.' }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonNoStore({ error: 'Invalid callback details.' }, 400);
  }

  const name = String(body.name ?? '').trim();
  const phone = normalisePhone(String(body.phone ?? ''));
  const message = String(body.message ?? '').trim();

  if (name.length < 2) return jsonNoStore({ error: 'Enter your name.' }, 400);
  if (!PHONE_PATTERN.test(phone)) return jsonNoStore({ error: 'Enter a valid phone number.' }, 400);

  try {
    const result = await sendCallbackEmail({ name, phone, message });
    return jsonNoStore({
      ok: true,
      sent: result.sent,
      message: result.sent
        ? 'Callback requested. Reception will call you shortly.'
        : result.reason,
    });
  } catch (error) {
    console.error(error);
    return jsonNoStore({ error: 'Could not send that request. Please call 01324 613007.' }, 502);
  }
};
