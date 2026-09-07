/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GA_MEASUREMENT_ID?: string;
  readonly PUBLIC_GOOGLE_ADS_ID?: string;
  readonly PUBLIC_GOOGLE_ADS_BOOKING_LABEL?: string;
  readonly PUBLIC_GOOGLE_ADS_PHONE_LABEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  dataLayer: unknown[];
  gtag: (...args: unknown[]) => void;
  __BANKSIDE_ANALYTICS?: {
    gaId: string;
    adsId: string;
    bookingLabel: string;
    phoneLabel: string;
  };
}
