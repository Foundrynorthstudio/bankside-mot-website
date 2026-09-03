import Alpine from 'alpinejs';

type Town = {
  name: string;
  postcode: string;
  driveTime: string;
  description: string;
};

const townList: Town[] = [
  {
    name: 'Falkirk',
    postcode: 'FK1 / FK2',
    driveTime: '2-5 Mins',
    description: 'Located directly at Castlelaurie Industrial Estate, convenient for central Falkirk drivers.',
  },
  {
    name: 'Grangemouth',
    postcode: 'FK3',
    driveTime: '8 Mins',
    description: 'Fast access via the A904 / A9 for Grangemouth drivers needing Class 4 & Class 7 commercial MOTs.',
  },
  {
    name: 'Larbert',
    postcode: 'FK5',
    driveTime: '7 Mins',
    description: 'Straightforward drive across Bellsdyke / Main Street. Drop your car off before work!',
  },
  {
    name: 'Polmont',
    postcode: 'FK2',
    driveTime: '10 Mins',
    description: 'Quick access along the A9 for Polmont and Brightons motorists.',
  },
  {
    name: 'Stenhousemuir',
    postcode: 'FK5',
    driveTime: '6 Mins',
    description: 'Just minutes away from Stenhousemuir shopping centre.',
  },
  {
    name: 'Denny',
    postcode: 'FK6',
    driveTime: '12 Mins',
    description: 'Easy commute down the M876 / A9 for honest local vehicle repairs.',
  },
];

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

  vrmInput: '',
  isSearchingVehicle: false,
  vrmFound: false,
  vehicleData: {
    makeModel: '2019 Vauxhall Corsa 1.4 EcoTec',
    engineFuel: '1398cc Petrol • Manual',
    motDue: 'MOT Due in 22 Days',
  },

  financeAmount: 300,

  townList,
  selectedTown: townList[0],

  contactForm: { name: '', phone: '', message: '' },
  contactSent: false,

  bookingModalOpen: false,
  bookingStep: 1,
  selectedService: 'Class 4 MOT',
  servicePrice: 40,
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

  lookupVehicle() {
    if (!this.vrmInput || this.vrmInput.trim() === '') {
      this.vrmInput = 'SK19 MOT';
    }
    this.isSearchingVehicle = true;
    this.vrmFound = false;

    setTimeout(() => {
      this.isSearchingVehicle = false;
      this.vrmFound = true;
    }, 800);
  },

  setDemoVRM(reg: string) {
    this.vrmInput = reg;
    this.lookupVehicle();
  },

  quickBook(serviceName: string, price: number) {
    this.selectedService = serviceName;
    this.servicePrice = price;
    this.bookingStep = 1;
    this.bookingError = '';
    this.bookingModalOpen = true;
  },

  openBookingModal() {
    this.bookingStep = 1;
    this.bookingError = '';
    this.bookingModalOpen = true;
  },

  submitContactForm() {
    if (this.contactForm.name && this.contactForm.phone) {
      this.contactSent = true;
      setTimeout(() => {
        this.contactForm = { name: '', phone: '', message: '' };
        this.contactSent = false;
      }, 4000);
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
      if (!response.ok) throw new Error(data.error || 'Could not load times.');
      this.availableSlots = data.slots ?? [];
      const stillOpen = this.availableSlots.find((slot) => slot.time === this.selectedTime && slot.available);
      if (!stillOpen) {
        this.selectedTime = this.availableSlots.find((slot) => slot.available)?.time ?? '';
      }
    } catch (error) {
      this.bookingError = error instanceof Error ? error.message : 'Could not load times.';
      this.availableSlots = [];
    } finally {
      this.slotsLoading = false;
    }
  },

  async goToSlotStep() {
    if (!this.vrmInput.trim()) {
      this.bookingError = 'Enter the vehicle registration first.';
      return;
    }
    this.bookingError = '';
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

Alpine.start();
