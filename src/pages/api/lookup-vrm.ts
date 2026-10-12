import type { APIRoute } from 'astro';
import { jsonNoStore } from '../../lib/booking/http';
import { consumeRateLimit, rateLimits } from '../../lib/booking/rate-limit';
import { lookupVehicleByVrm, VehicleLookupError } from '../../lib/booking/vehiclesmart';
import { isValidVrm } from '../../lib/booking/validate';

export const prerender = false;

export const GET: APIRoute = async ({ url, clientAddress }) => {
  const vrm = url.searchParams.get('vrm') ?? '';
  if (!isValidVrm(vrm)) {
    return jsonNoStore({ error: 'Enter a valid UK registration (letters and numbers only).' }, 400);
  }

  const ip = clientAddress || 'unknown';
  if (!(await consumeRateLimit('lookup', ip, rateLimits.lookup.limit, rateLimits.lookup.windowMs))) {
    return jsonNoStore({ error: 'Too many lookups. Try again in a few minutes, or book with the registration.' }, 429);
  }

  try {
    return jsonNoStore(await lookupVehicleByVrm(vrm));
  } catch (error) {
    if (error instanceof VehicleLookupError) {
      return jsonNoStore({ error: error.message }, error.status);
    }
    return jsonNoStore({ error: 'Could not look up that registration. You can still book.' }, 502);
  }
};
