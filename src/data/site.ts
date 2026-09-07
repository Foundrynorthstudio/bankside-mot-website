export const SITE_URL = 'https://banksidemot.co.uk';

export const motRetestGuidanceUrl = 'https://www.gov.uk/getting-an-mot/retests';

export const business = {
  name: 'Bankside MOT & Repair',
  legalName: 'Bankside MOT & Repair',
  shortName: 'Bankside MOT & Repair',
  description:
    'Independent DVSA-approved MOT testing station and repair workshop in Falkirk. Class 4 MOTs, servicing, diagnostics and repairs at Castlelaurie Industrial Estate.',
  telephoneDisplay: '01324 613007',
  telephone: '+441324613007',
  url: SITE_URL,
  email: 'bookings@banksidemot.co.uk',
  priceRange: '£',
  streetAddress: 'Unit 1b, Castlelaurie Industrial Estate',
  addressLocality: 'Falkirk',
  addressRegion: 'Stirlingshire',
  postalCode: 'FK2 7XJ',
  addressCountry: 'GB',
  latitude: 56.01225,
  longitude: -3.778919,
  mapsUrl: 'https://maps.google.com/?cid=1414482120106289820',
  mapsEmbed:
    'https://maps.google.com/maps?q=Bankside+MOT+%26+Repair+Unit+1b+Castlelaurie+Industrial+Estate+Falkirk+FK2+7XJ&z=16&output=embed',
  googleListingUrl: 'https://maps.google.com/?cid=1414482120106289820',
  sameAs: ['https://maps.google.com/?cid=1414482120106289820'] as const,
  openingHours: [
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:30', closes: '17:00' },
  ],
  openingHoursDisplay: 'Monday to Friday, 8:30am – 5:00pm',
  openingHoursShort: 'Mon–Fri: 8:30am – 5:00pm',
  saturdayDisplay: 'By appointment',
  sundayDisplay: 'Closed',
  googleRating: 4.9,
  googleReviewCount: 67,
  areaServed: ['Falkirk', 'Grangemouth', 'Larbert', 'Polmont', 'Stenhousemuir', 'Denny'],
  services: [
    { name: 'Class 4 MOT', description: 'DVSA MOT test for cars, small vans and taxis up to 3,000kg.' },
    { name: 'Interim servicing', description: 'Oil, filter and multi-point safety inspection.' },
    { name: 'Major servicing', description: 'Full annual service and mechanical health check.' },
    { name: 'Vehicle diagnostics', description: 'Dealer-level diagnostic scans and warning-light investigation.' },
    { name: 'Discs and pads', description: 'Brake disc and pad replacement on all makes and models, quoted before work starts.' },
    { name: 'Wheel alignment', description: 'Front two wheels from £45, all four wheels from £65.' },
    { name: 'Air-con regassing', description: 'Air conditioning recharge and performance check.' },
  ],
} as const;

export const defaultTitle = 'MOT Test Falkirk | Class 4 MOT £50, Servicing | Bankside MOT & Repair';
export const defaultDescription =
  'DVSA-approved Class 4 MOT tests in Falkirk for £50. Interim servicing from £175, major servicing from £260, plus diagnostics and repairs at Castlelaurie Industrial Estate. Book online.';

export function absoluteUrl(path = '/') {
  const normalised = path === '/' ? '/' : path.startsWith('/') ? path.replace(/\/$/, '') : `/${path.replace(/\/$/, '')}`;
  return new URL(normalised, SITE_URL).href;
}

export function canonicalPath(pathname: string) {
  const clean = pathname.replace(/\/$/, '') || '/';
  return absoluteUrl(clean);
}
