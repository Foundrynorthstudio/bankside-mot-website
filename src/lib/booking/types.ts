export type BookingStatus = 'confirmed' | 'cancelled' | 'completed' | 'blocked';
export type BookingSource = 'online' | 'phone' | 'walk-in' | 'admin';

export type Booking = {
  id: string;
  created_at: string;
  updated_at: string;
  status: BookingStatus;
  source: BookingSource;
  service: string;
  price: number;
  date: string;
  time: string;
  vrm: string;
  vehicle_make_model: string;
  vehicle_engine: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  payment_method: string;
  notes: string;
  customer_id: string;
  vehicle_id: string;
  diary: string;
  resource: string;
};

export type BookingInput = {
  service: string;
  price: number;
  date: string;
  time: string;
  vrm: string;
  vehicle_make_model?: string;
  vehicle_engine?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  payment_method?: string;
  notes?: string;
  source?: BookingSource;
  status?: BookingStatus;
  diary?: string;
  resource?: string;
};
