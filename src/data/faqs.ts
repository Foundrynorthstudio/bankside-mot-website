import { motRetestGuidanceUrl } from './site';

export type ServiceFaq = {
  question: string;
  answer: string;
  link?: {
    href: string;
    label: string;
  };
};

export const serviceFaqs: ServiceFaq[] = [
  {
    question: 'How long does an MOT take?',
    answer:
      'A Class 4 MOT at Bankside MOT & Repair typically takes about 45 minutes. You can wait in reception, or drop the car and collect it later the same day.',
  },
  {
    question: 'Do you offer a free retest if the car fails?',
    answer:
      'Yes, where DVSA rules allow it. If the vehicle is left with us for repair and retested within 10 working days, the partial retest is free. If you take it away and bring it back before the end of the next working day for certain items (for example lamps, tyres, wipers or number plates), that partial retest is also free. If you take it away and return it within 10 working days, we may charge a partial retest fee. After that, a full retest and the full fee apply. Only one partial retest is allowed after a full test. Retests cannot be booked online — phone the office on 01324 613007 and we will give you a time slot.',
    link: {
      href: motRetestGuidanceUrl,
      label: 'Read the official MOT retest rules on GOV.UK',
    },
  },
  {
    question: 'How much does a service cost?',
    answer:
      'Servicing is priced from £175 for an interim service and from £260 for a major service, depending on the make and model. We use oil to the manufacturer’s recommendation for the vehicle, and confirm the price before any work starts.',
  },
  {
    question: 'Can I book an MOT online?',
    answer:
      'Yes. Use Book Online for a first MOT test: enter the registration, choose a weekday 45-minute slot from 8:30am, with the last booking at 4:00pm. The diary updates so that time is no longer offered to someone else. MOT retests cannot be booked online — call 01324 613007. Servicing is also booked by phone so the workshop can fit it into their own diary.',
  },
  {
    question: 'Can I book an MOT and a service together?',
    answer:
      'Yes. Book the MOT + major service combo online and drop the vehicle off in the morning. Leave it with us until the end of the day, or collect it the following morning. We confirm the service price for the make and model before work starts.',
  },
  {
    question: 'Do you offer 0% payment assist on repairs?',
    answer:
      'Yes, on repair bills over £100. Pay 25% when the work is done and spread the rest over three monthly payments with no interest.',
  },
];
