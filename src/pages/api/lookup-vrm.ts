import type { APIRoute } from 'astro';
import { allowVehicleLookup, lookupVehicleByVrm, VehicleLookupError } from '../../lib/booking/vehiclesmart';
import { isValidVrm } from '../../lib/booking/validate';

export const prerender = false;

export const GET: APIRoute = async ({ url, clientAddress }) => {
  const vrm = url.searchParams.get('vrm') ?? '';
  if (!isValidVrm(vrm)) {
    return Response.json({ error: 'Enter a valid UK registration (letters and numbers only).' }, { status: 400 });
  }

  const ip = clientAddress || 'unknown';
  if (!allowVehicleLookup(ip)) {
    return Response.json({ error: 'Too many lookups. Try again in a few minutes, or book with the registration.' }, { status: 429 });
  }

  try {
    return Response.json(await lookupVehicleByVrm(vrm));
  } catch (error) {
    if (error instanceof VehicleLookupError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: 'Could not look up that registration. You can still book.' }, { status: 502 });
  }
};
