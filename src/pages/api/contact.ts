import type { APIRoute } from 'astro';
import { sendCallbackEmail } from '../../lib/booking/email';
import { normalisePhone } from '../../lib/booking/validate';

export const prerender = false;

const PHONE_PATTERN = /^[0-9+]{10,16}$/;

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid callback details.' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  const phone = normalisePhone(String(body.phone ?? ''));
  const message = String(body.message ?? '').trim();

  if (name.length < 2) return Response.json({ error: 'Enter your name.' }, { status: 400 });
  if (!PHONE_PATTERN.test(phone)) return Response.json({ error: 'Enter a valid phone number.' }, { status: 400 });

  try {
    const result = await sendCallbackEmail({ name, phone, message });
    return Response.json({
      ok: true,
      sent: result.sent,
      message: result.sent
        ? 'Callback requested. Reception will call you shortly.'
        : result.reason,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Could not send that request. Please call 01324 613007.' }, { status: 502 });
  }
};
