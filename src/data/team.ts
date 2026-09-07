export type TeamMember = {
  name: string;
  role: string;
  bio: string;
  note: string;
  icon: string;
};

export const teamIntro =
  'The breadth of experience in the garage is second to none. Between them they have decades on the tools, with youth and motivation coming from Olivia.';

export const team: TeamMember[] = [
  {
    name: 'Stephen',
    role: 'General Manager',
    bio: 'Stephen runs Bankside, and has worked as a mechanic for over 30 years. He has also been an MOT tester and MOT manager for over 25 years, and has managed three garages in the past.',
    note: 'Manager, mechanic & MOT tester',
    icon: 'fa-clipboard-list',
  },
  {
    name: 'Gordon',
    role: 'General Mechanic',
    bio: 'Our general mechanic and MOT tester, with over 25 years’ experience working on all types of cars.',
    note: 'Mechanic & MOT tester',
    icon: 'fa-screwdriver-wrench',
  },
  {
    name: 'Mel',
    role: 'Mechanic',
    bio: 'Trained as a mechanic with Lada, Mel has been with Bankside for over ten years.',
    note: 'Bankside for 10+ years',
    icon: 'fa-screwdriver-wrench',
  },
  {
    name: 'Olivia',
    role: 'Junior Mechanic',
    bio: 'Our junior mechanic. Trained with Citroën and thrown in at the deep end, she’s turning her hand to everything with enthusiasm.',
    note: 'Fresh energy in the bays',
    icon: 'fa-screwdriver-wrench',
  },
  {
    name: 'Mack',
    role: 'MOT Tester',
    bio: 'An army mechanic in a former life, specialising in tank artillery before turning his hand to cars. Twenty-four years in the Falkirk area before joining Bankside as our MOT tester.',
    note: 'DVSA MOT tester',
    icon: 'fa-clipboard-check',
  },
  {
    name: 'Alison',
    role: 'Office Admin',
    bio: 'Alison has been with the business almost 20 years, so she knows it inside and out — the mother of the team.',
    note: 'Reception and customer care',
    icon: 'fa-headset',
  },
];
