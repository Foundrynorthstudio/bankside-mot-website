import { sqlAll, sqlGet, sqlRun } from './database';
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

export async function getJob(id: string) {
  const row = await sqlGet(`${JOB_SELECT} WHERE j.id = $1`, [id]);
  return row ? mapJob(row) : null;
}

export async function listCustomerJobs(customerId: string) {
  const rows = await sqlAll(`${JOB_SELECT} WHERE j.customer_id = $1 ORDER BY j.job_date DESC, j.created_at DESC`, [
    customerId,
  ]);
  return rows.map(mapJob);
}

export async function listVehicleJobs(vehicleId: string) {
  const rows = await sqlAll(`${JOB_SELECT} WHERE j.vehicle_id = $1 ORDER BY j.job_date DESC, j.created_at DESC`, [
    vehicleId,
  ]);
  return rows.map(mapJob);
}

export async function customerJobTotals(customerId: string) {
  const row = await sqlGet(
    `SELECT COALESCE(SUM(amount_pence), 0) AS amount, COALESCE(SUM(paid_pence), 0) AS paid
     FROM jobs WHERE customer_id = $1`,
    [customerId],
  );
  const amount = Number(row?.amount ?? 0);
  const paid = Number(row?.paid ?? 0);
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

export async function createJob(input: JobInput) {
  const description = input.description.trim();
  if (!description) return null;
  const id = nextId('JOB');
  const now = new Date().toISOString();
  const amountPence = poundsToPence(input.amount);
  const paidPence = poundsToPence(input.paid ?? 0);
  await sqlRun(
    `INSERT INTO jobs (
      id, created_at, customer_id, vehicle_id, booking_id, job_date, description,
      invoice_ref, amount_pence, paid_pence, payment_method, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
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
    ],
  );
  await sqlRun('UPDATE customers SET updated_at = $1 WHERE id = $2', [now, input.customer_id]);
  return getJob(id);
}

export async function updateJob(id: string, input: Omit<JobInput, 'customer_id'>) {
  const job = await getJob(id);
  if (!job) return null;
  const description = input.description.trim();
  if (!description) return null;
  const now = new Date().toISOString();
  await sqlRun(
    `UPDATE jobs
     SET vehicle_id = $1, job_date = $2, description = $3, invoice_ref = $4,
         amount_pence = $5, paid_pence = $6, payment_method = $7, notes = $8
     WHERE id = $9`,
    [
      input.vehicle_id ?? '',
      input.job_date,
      description,
      (input.invoice_ref ?? '').trim(),
      poundsToPence(input.amount),
      poundsToPence(input.paid ?? 0),
      input.payment_method ?? '',
      (input.notes ?? '').trim(),
      id,
    ],
  );
  await sqlRun('UPDATE customers SET updated_at = $1 WHERE id = $2', [now, job.customer_id]);
  return getJob(id);
}

export async function recordJobPayment(jobId: string, amount: string | number, paymentMethod = '') {
  const job = await getJob(jobId);
  if (!job) return null;
  const extra = poundsToPence(amount);
  if (extra <= 0) return job;
  const now = new Date().toISOString();
  await sqlRun(
    `UPDATE jobs
     SET paid_pence = paid_pence + $1,
         payment_method = CASE WHEN length($2) > 0 THEN $2 ELSE payment_method END
     WHERE id = $3`,
    [extra, paymentMethod, jobId],
  );
  await sqlRun('UPDATE customers SET updated_at = $1 WHERE id = $2', [now, job.customer_id]);
  return getJob(jobId);
}

export function jobSummary(job: Job) {
  return {
    balance: jobBalance(job.amount_pence, job.paid_pence),
    status: jobStatus(job.amount_pence, job.paid_pence),
  };
}
