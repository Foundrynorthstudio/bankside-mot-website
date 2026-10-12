import Alpine from 'alpinejs';
import { serviceByName } from '../lib/booking/config';

const CONSENT_COOKIE = 'bankside_cookie_consent';

function readCookieConsent(): '' | 'accepted' | 'rejected' {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]+)`));
  return match?.[1] === 'accepted' || match?.[1] === 'rejected' ? match[1] : '';
}

function writeCookieConsent(value: 'accepted' | 'rejected') {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax${secure}`;
}

function loadAnalytics() {
  const config = window.__BANKSIDE_ANALYTICS;
  if (!config || !(config.gaId || config.adsId)) return;
  if (document.querySelector('script[data-bankside-analytics]')) return;

  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${config.gaId || config.adsId}`;
  script.async = true;
  script.dataset.banksideAnalytics = '1';
  document.head.append(script);
  window.gtag('js', new Date());
  if (config.gaId) window.gtag('config', config.gaId);
  if (config.adsId) window.gtag('config', config.adsId);
}

function trackConversion(event: 'phone' | 'booking' | 'lead', value?: number) {
  if (readCookieConsent() !== 'accepted') return;
  const config = window.__BANKSIDE_ANALYTICS;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: `bankside_${event}`, value });

  if (typeof window.gtag !== 'function' || !config) return;

  if (event === 'phone') {
    window.gtag('event', 'phone_click', { event_category: 'engagement' });
    if (config.adsId && config.phoneLabel) {
      window.gtag('event', 'conversion', { send_to: `${config.adsId}/${config.phoneLabel}` });
    }
    return;
  }

  if (event === 'booking') {
    window.gtag('event', 'generate_lead', { currency: 'GBP', value: value ?? 50 });
    if (config.adsId && config.bookingLabel) {
      window.gtag('event', 'conversion', {
        send_to: `${config.adsId}/${config.bookingLabel}`,
        value: value ?? 50,
        currency: 'GBP',
      });
    }
    return;
  }

  window.gtag('event', 'generate_lead', { event_category: 'contact' });
}

function londonISO(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDaysISO(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function nextWeekdayISO() {
  let iso = londonISO();
  for (let i = 0; i < 7; i += 1) {
    const [year, month, day] = iso.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday >= 1 && weekday <= 5) return iso;
    iso = addDaysISO(iso, 1);
  }
  return iso;
}

Alpine.data('banksideApp', () => ({
  mobileMenuOpen: false,
  cookieConsent: '' as '' | 'accepted' | 'rejected',
  cookieBannerOpen: false,

  vrmInput: '',
  isSearchingVehicle: false,
  vrmFound: false,
  vrmLookupError: '',
  vehicleData: {
    makeModel: '',
    engineFuel: '',
    motDue: '',
    motTone: 'unknown' as 'ok' | 'due' | 'expired' | 'unknown',
    colour: '',
  },

  financeAmount: 300,

  contactForm: { name: '', phone: '', message: '' },
  contactSent: false,
  contactError: '',
  contactMessage: '',
  isSubmittingContact: false,

  bookingModalOpen: false,
  bookingStep: 1,
  selectedService: 'Class 4 MOT',
  servicePrice: 50,
  servicePriceFrom: false,
  bookingDate: nextWeekdayISO(),
  minDate: londonISO(),
  maxDate: addDaysISO(londonISO(), 56),
  availableSlots: [] as { time: string; label?: string; available: boolean; reason: string | null }[],
  slotsLoading: false,
  selectedTime: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  bookingNotes: '',
  paymentMethod: 'Pay at Garage',
  bookingRef: '',
  bookingError: '',
  isSubmittingBooking: false,
  emailSent: false,

  init() {
    this.cookieConsent = readCookieConsent();
    this.cookieBannerOpen = !this.cookieConsent;
    if (this.cookieConsent === 'accepted') loadAnalytics();
  },

  setCookieConsent(value: 'accepted' | 'rejected') {
    writeCookieConsent(value);
    this.cookieConsent = value;
    this.cookieBannerOpen = false;
    if (value === 'accepted') loadAnalytics();
  },

  openCookieSettings() {
    this.cookieBannerOpen = true;
  },

  compactVrm() {
    return this.vrmInput.toUpperCase().replace(/[^A-Z0-9]/g, '');
  },

  async lookupVehicle() {
    const vrm = this.compactVrm();
    if (vrm.length < 2) {
      this.vrmFound = false;
      this.vrmLookupError = 'Enter a valid UK registration.';
      return false;
    }

    this.isSearchingVehicle = true;
    this.vrmFound = false;
    this.vrmLookupError = '';

    try {
      const response = await fetch(`/api/lookup-vrm?vrm=${encodeURIComponent(vrm)}`);
      const data = await response.json();
      if (!response.ok) {
        this.vrmLookupError = data.error || 'Could not look up that registration. You can still book.';
        return false;
      }
      this.vehicleData = {
        makeModel: data.makeModel ?? '',
        engineFuel: data.engineFuel ?? '',
        motDue: data.motStatus ?? '',
        motTone: data.motTone ?? 'unknown',
        colour: data.colour ?? '',
      };
      this.vrmFound = true;
      return true;
    } catch {
      this.vrmLookupError = 'Could not look up that registration. You can still book.';
      return false;
    } finally {
      this.isSearchingVehicle = false;
    }
  },

  quickBook(serviceName: string, price: number) {
    this.selectedService = serviceName;
    this.servicePrice = price;
    this.servicePriceFrom = Boolean(serviceByName(serviceName)?.from);
    this.bookingStep = 1;
    this.bookingError = '';
    this.bookingModalOpen = true;
  },

  openBookingModal() {
    this.bookingStep = 1;
    this.bookingError = '';
    this.bookingModalOpen = true;
  },

  async submitContactForm() {
    if (!this.contactForm.name.trim() || !this.contactForm.phone.trim()) {
      this.contactError = 'Enter your name and phone number.';
      return;
    }
    this.isSubmittingContact = true;
    this.contactError = '';
    this.contactSent = false;
    this.contactMessage = '';
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.contactForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send that request.');
      this.contactSent = true;
      this.contactMessage = data.message || 'Callback requested. Reception will call you shortly.';
      if (data.sent) trackConversion('lead');
      this.contactForm = { name: '', phone: '', message: '' };
    } catch (error) {
      this.contactError = error instanceof Error ? error.message : 'Could not send that request. Please call 01324 613007.';
    } finally {
      this.isSubmittingContact = false;
    }
  },

  confirmBooking() {
    if (!this.customerName || !this.customerPhone || !this.customerEmail) {
      this.bookingError = 'Please enter your name, phone number and email.';
      return;
    }
    if (!this.vrmInput || !this.selectedTime) {
      this.bookingError = 'Vehicle registration and time slot are required.';
      return;
    }

    this.isSubmittingBooking = true;
    this.bookingError = '';

    fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: this.selectedService,
        date: this.bookingDate,
        time: this.selectedTime,
        vrm: this.vrmInput,
        vehicle_make_model: this.vrmFound ? this.vehicleData.makeModel : '',
        vehicle_engine: this.vrmFound ? this.vehicleData.engineFuel : '',
        customer_name: this.customerName,
        customer_phone: this.customerPhone,
        customer_email: this.customerEmail,
        payment_method: this.paymentMethod,
        notes: this.bookingNotes,
      }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          if (Array.isArray(data.slots)) this.availableSlots = data.slots;
          if (response.status === 409) this.bookingStep = 2;
          throw new Error(data.error || 'Could not complete the booking.');
        }
        this.bookingRef = data.ref;
        this.emailSent = Boolean(data.emailSent);
        this.bookingStep = 4;
        trackConversion('booking', this.servicePrice);
        if (Array.isArray(data.slots)) this.availableSlots = data.slots;
      })
      .catch((error: Error) => {
        this.bookingError = error.message;
      })
      .finally(() => {
        this.isSubmittingBooking = false;
      });
  },

  async loadSlots() {
    if (!this.bookingDate) return;
    this.slotsLoading = true;
    try {
      const response = await fetch(`/api/slots?date=${this.bookingDate}&service=${encodeURIComponent(this.selectedService)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load times. Please call 01324 613007.');
      this.availableSlots = data.slots ?? [];
      const stillOpen = this.availableSlots.find((slot) => slot.time === this.selectedTime && slot.available);
      if (!stillOpen) {
        this.selectedTime = this.availableSlots.find((slot) => slot.available)?.time ?? '';
      }
    } catch (error) {
      this.bookingError = error instanceof Error ? error.message : 'Could not load times. Please call 01324 613007.';
      this.availableSlots = [];
    } finally {
      this.slotsLoading = false;
    }
  },

  async goToSlotStep() {
    if (this.compactVrm().length < 2) {
      this.bookingError = 'Enter the vehicle registration first.';
      return;
    }
    this.bookingError = '';
    if (!this.vrmFound && !this.isSearchingVehicle) {
      await this.lookupVehicle();
    }
    this.bookingStep = 2;
    await this.loadSlots();
  },

  goToDetailsStep() {
    if (!this.selectedTime) {
      this.bookingError = 'Choose an available time slot.';
      return;
    }
    this.bookingError = '';
    this.bookingStep = 3;
  },
}));

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const link = target.closest('a[href^="tel:"]');
  if (link) trackConversion('phone');
});

Alpine.start();
