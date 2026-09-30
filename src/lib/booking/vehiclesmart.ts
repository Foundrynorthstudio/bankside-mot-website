import { env } from './config';
import { todayISO } from './dates';
import { isValidVrm, normaliseVrm } from './validate';

export type MotTone = 'ok' | 'due' | 'expired' | 'unknown';

export type VehicleLookup = {
  vrm: string;
  make: string;
  model: string;
  year: string;
  makeModel: string;
  engineFuel: string;
  colour: string;
  fuel: string;
  engineCc: string;
  motStatus: string;
  motTone: MotTone;
  motExpiry: string;
};

type VehicleSmartDetails = {
  Make?: string;
  Model?: string;
  Year?: string;
  Fuel?: string;
  CylinderCapacity?: number | string;
  Colour?: string;
  Motd?: boolean;
  MotExpiryDate?: string;
  RawDvlaMotStatus?: string;
  Registration?: string;
};

type VehicleSmartMot = {
  Title?: string;
  Subtitle?: string;
  ValidMot?: boolean;
  MotDateString?: string;
  MotDaysLeft?: string;
  MotDate?: string;
};

type VehicleSmartResponse = {
  Success?: boolean;
  ServiceMessage?: string;
  VehicleDetails?: VehicleSmartDetails;
  CalculatedMot?: VehicleSmartMot;
};

const DEFAULT_URL = 'https://vehiclesmart.com/rest/vehicleData';
const LOOKUP_CACHE_MS = 60 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 20;

const lookupCache = new Map<string, { expires: number; vehicle: VehicleLookup }>();
const rateHits = new Map<string, number[]>();

export class VehicleLookupError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'VehicleLookupError';
  }
}

export function vehicleSmartApiKey() {
  return env('VEHICLESMART_API_KEY', env('VEHICLE_SMART_API_KEY'));
}

export function isVehicleSmartConfigured() {
  return vehicleSmartApiKey().length > 0;
}

export function allowVehicleLookup(ip: string) {
  const now = Date.now();
  const recent = (rateHits.get(ip) ?? []).filter((stamp) => now - stamp < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    rateHits.set(ip, recent);
    return false;
  }
  recent.push(now);
  rateHits.set(ip, recent);
  return true;
}

function titleCase(value: string) {
  const acronyms = new Set(['BMW', 'VW', 'MG', 'SEAT', 'MINI', 'DS', 'TVR', 'V8', 'GTi', 'GTI', 'TDI', 'TSI']);
  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase();
      if (acronyms.has(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function datePart(value?: string) {
  const match = clean(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? '';
}

function daysUntil(isoDate: string) {
  if (!isoDate) return null;
  const today = todayISO();
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

function formatDayCount(days: number) {
  const abs = Math.abs(days);
  return `${abs} day${abs === 1 ? '' : 's'}`;
}

function formatUkDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function motSummary(details: VehicleSmartDetails, calculated?: VehicleSmartMot): { status: string; tone: MotTone; expiry: string } {
  const expiry = datePart(calculated?.MotDate) || datePart(details.MotExpiryDate);
  const days = daysUntil(expiry);
  const valid = calculated?.ValidMot ?? details.Motd;
  const raw = clean(details.RawDvlaMotStatus);

  if (valid === false || (days !== null && days < 0) || /not valid|expired/i.test(raw)) {
    return {
      status: expiry ? `MOT expired ${formatUkDate(expiry)}` : 'MOT expired',
      tone: 'expired',
      expiry,
    };
  }

  if (days !== null && days <= 30) {
    return {
      status: days === 0 ? 'MOT due today' : `MOT due in ${formatDayCount(days)}`,
      tone: days <= 7 ? 'expired' : 'due',
      expiry,
    };
  }

  if (valid === true || /valid/i.test(raw)) {
    const leftover = clean(calculated?.MotDaysLeft);
    return {
      status: expiry
        ? `MOT valid until ${formatUkDate(expiry)}${days !== null ? ` · ${formatDayCount(days)} left` : leftover ? ` · ${leftover}` : ''}`
        : leftover
          ? `MOT valid · ${leftover} left`
          : 'MOT valid',
      tone: 'ok',
      expiry,
    };
  }

  const subtitle = clean(calculated?.Subtitle) || clean(calculated?.MotDateString) || clean(calculated?.Title) || raw;
  return { status: subtitle || 'MOT status unavailable', tone: 'unknown', expiry };
}

function mapVehicle(vrm: string, payload: VehicleSmartResponse): VehicleLookup | null {
  const details = payload.VehicleDetails;
  if (!details) return null;

  const make = titleCase(clean(details.Make));
  const model = titleCase(clean(details.Model));
  const year = clean(details.Year);
  const fuel = titleCase(clean(details.Fuel).replace(/heavy oil/i, 'Diesel'));
  const engineCc = clean(details.CylinderCapacity);
  const colour = titleCase(clean(details.Colour));
  const makeModel = [year, make, model].filter(Boolean).join(' ');
  if (!make && !model) return null;

  const engineFuel = [engineCc ? `${engineCc}cc` : '', fuel].filter(Boolean).join(' ');
  const mot = motSummary(details, payload.CalculatedMot);

  return {
    vrm: normaliseVrm(clean(details.Registration) || vrm),
    make,
    model,
    year,
    makeModel: makeModel || 'Vehicle found',
    engineFuel: engineFuel || '—',
    colour,
    fuel,
    engineCc,
    motStatus: mot.status,
    motTone: mot.tone,
    motExpiry: mot.expiry,
  };
}

function lookupUrl(vrm: string, apiKey: string) {
  const template = env('VEHICLESMART_API_URL', DEFAULT_URL);
  if (template.includes('{vrm}') || template.includes('{key}')) {
    return template.replaceAll('{vrm}', encodeURIComponent(vrm)).replaceAll('{key}', encodeURIComponent(apiKey));
  }

  const url = new URL(template);
  url.searchParams.set('reg', vrm);
  url.searchParams.set('appid', apiKey);
  return url.toString();
}

function publicMessage(serviceMessage: string) {
  if (/api key|licence|license|access (to service )?denied|obtain a licence/i.test(serviceMessage)) {
    return 'Vehicle lookup is temporarily unavailable. You can still book with the registration.';
  }
  if (/not found|no (vehicle|data|results)|invalid (reg|vrm|registration)/i.test(serviceMessage)) {
    return 'No vehicle found for that registration.';
  }
  return serviceMessage || 'Could not look up that registration.';
}

export async function lookupVehicleByVrm(rawVrm: string): Promise<VehicleLookup> {
  const vrm = normaliseVrm(rawVrm);
  if (!isValidVrm(vrm)) {
    throw new VehicleLookupError(400, 'Enter a valid UK registration (letters and numbers only).');
  }

  const cached = lookupCache.get(vrm);
  if (cached && cached.expires > Date.now()) return cached.vehicle;

  const apiKey = vehicleSmartApiKey();
  if (!apiKey) {
    throw new VehicleLookupError(503, 'Vehicle lookup is not configured yet. You can still book with the registration.');
  }

  let response: Response;
  try {
    response = await fetch(lookupUrl(vrm, apiKey), {
      headers: {
        Accept: 'application/json',
        'x-api-key': apiKey,
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new VehicleLookupError(502, 'Vehicle lookup timed out. You can still book with the registration.');
  }

  const text = await response.text();
  let payload: VehicleSmartResponse = {};
  try {
    payload = text ? (JSON.parse(text) as VehicleSmartResponse) : {};
  } catch {
    throw new VehicleLookupError(502, 'Vehicle lookup returned an unexpected response.');
  }

  if (!response.ok || payload.Success === false) {
    const message = publicMessage(clean(payload.ServiceMessage));
    let status = 502;
    if (/temporarily unavailable/i.test(message)) status = 503;
    else if (/no vehicle found/i.test(message) || response.ok) status = 404;
    throw new VehicleLookupError(status, message);
  }

  const vehicle = mapVehicle(vrm, payload);
  if (!vehicle) {
    throw new VehicleLookupError(404, 'No vehicle found for that registration.');
  }

  lookupCache.set(vrm, { expires: Date.now() + LOOKUP_CACHE_MS, vehicle });
  return vehicle;
}
