export type ServiceTown = {
  name: string;
  postcode: string;
  driveTime: string;
  route: string;
  description: string;
};

export const serviceTowns: ServiceTown[] = [
  {
    name: 'Falkirk',
    postcode: 'FK1 / FK2',
    driveTime: '2–5 minutes',
    route: 'Castlelaurie Industrial Estate, just off the town centre',
    description:
      'The workshop is in Falkirk, so a Class 4 MOT, service or brake job is a short hop from the town centre. Drop the car in the morning or wait in reception.',
  },
  {
    name: 'Grangemouth',
    postcode: 'FK3',
    driveTime: 'about 8 minutes',
    route: 'A904 / A9',
    description:
      'Grangemouth drivers use the A904 or A9 for a Class 4 MOT, servicing or repairs. Same-day MOT slots are booked online; other work is quoted by phone.',
  },
  {
    name: 'Larbert',
    postcode: 'FK5',
    driveTime: 'about 7 minutes',
    route: 'Bellsdyke Road / Main Street',
    description:
      'From Larbert it is a straightforward drive across Bellsdyke. Many customers drop the car before work and collect after the MOT or service.',
  },
  {
    name: 'Polmont',
    postcode: 'FK2',
    driveTime: 'about 10 minutes',
    route: 'A9 towards Falkirk',
    description:
      'Polmont and Brightons are about ten minutes along the A9. Book a £50 Class 4 MOT online, or call if you need discs, pads or a diagnostic.',
  },
  {
    name: 'Stenhousemuir',
    postcode: 'FK5',
    driveTime: 'about 6 minutes',
    route: 'via Larbert towards Castlelaurie',
    description:
      'Stenhousemuir is a few minutes from the bays. Useful if you want an MOT before a trip, or a quote on brakes and servicing the same week.',
  },
  {
    name: 'Denny',
    postcode: 'FK6',
    driveTime: 'about 12 minutes',
    route: 'M876 / A9',
    description:
      'Denny and Dunipace reach Castlelaurie in around twelve minutes via the M876 or A9. We handle MOTs, servicing and everyday repairs at workshop rates.',
  },
];
