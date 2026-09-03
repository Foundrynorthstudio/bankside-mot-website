import { getDb } from './database';
import { nextId } from './ids';
import { jobBalance, jobStatus, poundsToPence } from './money';

export const JOB_PAYMENT_METHODS = ['Cash', 'Card', 'Bank transfer', 'Account', 'Other'] as const;

export type Job = {
  id: string;
  created_at: string;
  customer_id: string;
  vehicle_id: string;
  booking_id: string;
  job_date: string;
  description: string;
  invoice_ref: string;
  amount_pence: number;
  paid_pence: number;
  payment_method: string;
  notes: string;
  vrm: string;
  make_model: string;
};

export type JobInput = {
  customer_id: string;
  vehicle_id?: string;
  booking_id?: string;
  job_date: string;
  description: string;
  invoice_ref?: string;
  amount: string | number;
  paid?: string | number;
  payment_method?: string;
  notes?: string;
};

function mapJob(row: Record<string, unknown>): Job {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    customer_id: String(row.customer_id),
    vehicle_id: String(row.vehicle_id ?? ''),
    booking_id: String(row.booking_id ?? ''),
    job_date: String(row.job_date),
    description: String(row.description),
    invoice_ref: String(row.invoice_ref ?? ''),
    amount_pence: Number(row.amount_pence ?? 0),
    paid_pence: Number(row.paid_pence ?? 0),
    payment_method: String(row.payment_method ?? ''),
    notes: String(row.notes ?? ''),
    vrm: String(row.vrm ?? ''),
    make_model: String(row.make_model ?? ''),
  };
}

const JOB_SELECT = `SELECT j.*, COALESCE(v.vrm, '') AS vrm, COALESCE(v.make_model, '') AS make_model
  FROM jobs j
  LEFT JOIN vehicles v ON v.id = j.vehicle_id`;

export function getJob(id: string) {
  const row = getDb().prepare(`${JOB_SELECT} WHERE j.id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? mapJob(row) : null;
}

export function listCustomerJobs(customerId: string) {
  const rows = getDb()
    .prepare(`${JOB_SELECT} WHERE j.customer_id = ? ORDER BY j.job_date DESC, j.created_at DESC`)
    .all(customerId) as Record<string, unknown>[];
  return rows.map(mapJob);
}

export function listVehicleJobs(vehicleId: string) {
  const rows = getDb()
    .prepare(`${JOB_SELECT} WHERE j.vehicle_id = ? ORDER BY j.job_date DESC, j.created_at DESC`)
    .all(vehicleId) as Record<string, unknown>[];
  return rows.map(mapJob);
}

export function customerJobTotals(customerId: string) {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount_pence), 0) AS amount, COALESCE(SUM(paid_pence), 0) AS paid
       FROM jobs WHERE customer_id = ?`,
    )
    .get(customerId) as { amount: number; paid: number };
  const amount = Number(row.amount ?? 0);
  const paid = Number(row.paid ?? 0);
  return { amount, paid, outstanding: Math.max(0, amount - paid) };
}

export function parseJobForm(form: FormData) {
  return {
    vehicle_id: String(form.get('vehicle_id') ?? ''),
    job_date: String(form.get('job_date') ?? ''),
    description: String(form.get('description') ?? '').trim(),
    invoice_ref: String(form.get('invoice_ref') ?? '').trim(),
    amount: String(form.get('amount') ?? '0'),
    paid: String(form.get('paid') ?? '0'),
    payment_method: String(form.get('payment_method') ?? ''),
    notes: String(form.get('job_notes') ?? '').trim(),
  };
}

export function validateJobFields(fields: { description: string; job_date: string }) {
  if (!fields.description) return 'Describe the job before saving.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.job_date)) return 'Enter a valid job date.';
  return '';
}

export function createJob(input: JobInput) {
  const description = input.description.trim();
  if (!description) return null;
  const id = nextId('JOB');
  const now = new Date().toISOString();
  const amountPence = poundsToPence(input.amount);
  const paidPence = poundsToPence(input.paid ?? 0);
  getDb()
    .prepare(
      `INSERT INTO jobs (
        id, created_at, customer_id, vehicle_id, booking_id, job_date, description,
        invoice_ref, amount_pence, paid_pence, payment_method, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      now,
      input.customer_id,
      input.vehicle_id ?? '',
      input.booking_id ?? '',
      input.job_date,
      description,
      (input.invoice_ref ?? '').trim(),
      amountPence,
      paidPence,
      input.payment_method ?? '',
      (input.notes ?? '').trim(),
    );
  getDb().prepare('UPDATE customers SET updated_at = ? WHERE id = ?').run(now, input.customer_id);
  return getJob(id);
}

export function updateJob(id: string, input: Omit<JobInput, 'customer_id'>) {
  const job = getJob(id);
  if (!job) return null;
  const description = input.description.trim();
  if (!description) return null;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE jobs
       SET vehicle_id = ?, job_date = ?, description = ?, invoice_ref = ?,
           amount_pence = ?, paid_pence = ?, payment_method = ?, notes = ?
       WHERE id = ?`,
    )
    .run(
      input.vehicle_id ?? '',
      input.job_date,
      description,
      (input.invoice_ref ?? '').trim(),
      poundsToPence(input.amount),
      poundsToPence(input.paid ?? 0),
      input.payment_method ?? '',
      (input.notes ?? '').trim(),
      id,
    );
  getDb().prepare('UPDATE customers SET updated_at = ? WHERE id = ?').run(now, job.customer_id);
  return getJob(id);
}

export function recordJobPayment(jobId: string, amount: string | number, paymentMethod = '') {
  const job = getJob(jobId);
  if (!job) return null;
  const extra = poundsToPence(amount);
  if (extra <= 0) return job;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE jobs
       SET paid_pence = paid_pence + ?,
           payment_method = CASE WHEN length(?) > 0 THEN ? ELSE payment_method END
       WHERE id = ?`,
    )
    .run(extra, paymentMethod, paymentMethod, jobId);
  getDb().prepare('UPDATE customers SET updated_at = ? WHERE id = ?').run(now, job.customer_id);
  return getJob(jobId);
}

export function jobSummary(job: Job) {
  return {
    balance: jobBalance(job.amount_pence, job.paid_pence),
    status: jobStatus(job.amount_pence, job.paid_pence),
  };
}
