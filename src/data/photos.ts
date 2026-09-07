import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function photoExists(src: string) {
  return existsSync(resolve(process.cwd(), `public${src}`));
}

export const photos = {
  heroWorkshop: {
    src: '/images/hero-workshop.jpg',
    label: 'Workshop bay',
    brief: 'Wide landscape, 16:9. Car on the lift, bays lit. Slightly cinematic, not posed.',
  },
  serviceMot: {
    src: '/images/service-mot.jpg',
    label: 'MOT bay',
    brief: 'Landscape crop. MOT tools board, emissions console, or the car on the lift.',
  },
  serviceClass7: {
    src: '/images/service-class7.jpg',
    label: 'Class 7 / van bay',
    brief: 'Optional. Van on the high-bay lift. If you skip this, duplicate service-mot.jpg with this filename.',
  },
  serviceServicing: {
    src: '/images/service-servicing.jpg',
    label: 'Servicing',
    brief: 'Landscape crop. Under the bonnet — oil, filters, hands at work.',
  },
  serviceMajor: {
    src: '/images/service-major.jpg',
    label: 'Wheel off on the lift',
    brief: 'Mechanic with an impact wrench on a wheel — a bigger job in the bay.',
  },
  workshopRepairs: {
    src: '/images/workshop-repairs.jpg',
    label: 'Workshop tools',
    brief: 'Close-up of lined-up spanners in the tool chest.',
  },
  brakeBefore: {
    src: '/images/brake-before.jpg',
    label: 'Discs and pads — before',
    brief: 'Wheel off, worn rusty disc and pads before replacement.',
  },
  brakeAfter: {
    src: '/images/brake-after.jpg',
    label: 'Discs and pads — after',
    brief: 'Same corner after new discs and pads are fitted.',
  },
  serviceDiagnostics: {
    src: '/images/service-diagnostics.jpg',
    label: 'Diagnostics',
    brief: 'Landscape crop. Laptop or scan tool on the dash / in the footwell.',
  },
  serviceAlignment: {
    src: '/images/service-alignment.jpg',
    label: 'Wheel alignment',
    brief: 'Optional. Alignment machine on the wheels, or a tracking printout. Can reuse a bay shot until then.',
  },
  serviceAircon: {
    src: '/images/service-aircon.jpg',
    label: 'Air-con regassing',
    brief: 'Air-con machine connected under the bonnet.',
  },
  teamBand: {
    src: '/images/team-band.jpg',
    label: 'Workshop in action',
    brief: 'Wide landscape of the bays at work. Cars on the lifts is fine — no posed staff portraits needed.',
  },
  exterior: {
    src: '/images/exterior.jpg',
    label: 'Unit 1b exterior',
    brief: 'The building from Castlelaurie, with the Bankside MOT & Repair Centre sign.',
  },
  waitingLounge: {
    src: '/images/waiting-lounge.jpg',
    label: 'Reception',
    brief: 'Reception desk and a sofa if you wait. Honest, not a showroom.',
  },
  aboutWorkshop: {
    src: '/images/about-workshop.jpg',
    label: 'Workshop interior',
    brief: 'Engine bay or a second workshop angle for About.',
  },
} as const;
