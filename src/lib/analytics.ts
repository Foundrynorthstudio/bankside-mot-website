export type AnalyticsConfig = {
  gaId: string;
  adsId: string;
  bookingLabel: string;
  phoneLabel: string;
};

export function analyticsConfig(): AnalyticsConfig {
  return {
    gaId: import.meta.env.PUBLIC_GA_MEASUREMENT_ID?.trim() ?? '',
    adsId: import.meta.env.PUBLIC_GOOGLE_ADS_ID?.trim() ?? '',
    bookingLabel: import.meta.env.PUBLIC_GOOGLE_ADS_BOOKING_LABEL?.trim() ?? '',
    phoneLabel: import.meta.env.PUBLIC_GOOGLE_ADS_PHONE_LABEL?.trim() ?? '',
  };
}

export function analyticsEnabled(config: AnalyticsConfig) {
  return Boolean(config.gaId || config.adsId);
}
