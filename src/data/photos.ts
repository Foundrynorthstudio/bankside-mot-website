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
    label: 'MOT in progress',
    brief: 'Landscape crop. Rollers, headlamp aligner, or tester at the console.',
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
  serviceDiagnostics: {
    src: '/images/service-diagnostics.jpg',
    label: 'Diagnostics',
    brief: 'Landscape crop. Laptop or scan tool on the dash / in the footwell.',
  },
  teamBand: {
    src: '/images/team-band.jpg',
    label: 'Team in the bay',
    brief: 'Wide landscape. Dave and Craig in overalls in the workshop. A wider hero crop works until then.',
  },
  teamDave: {
    src: '/images/team-dave.jpg',
    label: 'Dave MacIntyre',
    brief: 'Portrait, 4:5. Overalls, same wall or bay background as the rest of the team.',
  },
  teamCraig: {
    src: '/images/team-craig.jpg',
    label: 'Craig Henderson',
    brief: 'Portrait, 4:5. Same background and framing as Dave, Callum and Sarah.',
  },
  teamCallum: {
    src: '/images/team-callum.jpg',
    label: 'Callum Smith',
    brief: 'Portrait, 4:5. Same background and framing as the rest of the team.',
  },
  teamSarah: {
    src: '/images/team-sarah.jpg',
    label: 'Sarah Jenkins',
    brief: 'Portrait, 4:5. Same background and framing as the rest of the team.',
  },
  exterior: {
    src: '/images/exterior.jpg',
    label: 'Unit 1b exterior',
    brief: 'The building as drivers will see it on Castlelaurie. Include any signage.',
  },
  waitingLounge: {
    src: '/images/waiting-lounge.jpg',
    label: 'Waiting lounge',
    brief: 'Landscape. The customer area you already mention — clean lounge and Wi-Fi.',
  },
  aboutWorkshop: {
    src: '/images/about-workshop.jpg',
    label: 'Workshop interior',
    brief: 'A second bay angle for About. A tighter crop of the hero shot is fine.',
  },
} as const;
