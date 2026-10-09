import { sqlAll, sqlGet, sqlRun, UniqueViolationError } from './database';

export const EMAIL_TEMPLATE_IDS = ['customer_booking', 'garage_booking', 'callback'] as const;
export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export type EmailTemplate = {
  id: EmailTemplateId;
  name: string;
  subject: string;
  body: string;
  updated_at: string;
};

export const EMAIL_TEMPLATE_FIELDS: Record<EmailTemplateId, string[]> = {
  customer_booking: [
    'booking_id',
    'customer_name',
    'customer_email',
    'customer_phone',
    'service',
    'price',
    'date',
    'time',
    'when',
    'date_iso',
    'time_raw',
    'vrm',
    'vehicle',
    'engine',
    'diary',
    'resource',
    'payment_method',
    'notes',
    'source',
    'combo_note',
    'booking_summary',
    'garage_name',
    'garage_address',
    'garage_phone',
  ],
  garage_booking: [
    'booking_id',
    'customer_name',
    'customer_email',
    'customer_phone',
    'service',
    'price',
    'date',
    'time',
    'when',
    'date_iso',
    'time_raw',
    'vrm',
    'vehicle',
    'engine',
    'diary',
    'resource',
    'payment_method',
    'notes',
    'source',
    'combo_note',
    'booking_summary',
    'garage_name',
    'garage_address',
    'garage_phone',
  ],
  callback: ['customer_name', 'phone', 'message', 'callback_summary', 'garage_name', 'garage_phone'],
};

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateId, Omit<EmailTemplate, 'updated_at'>> = {
  customer_booking: {
    id: 'customer_booking',
    name: 'Customer booking confirmation',
    subject: 'Booking confirmed — {{garage_name}} Falkirk ({{booking_id}})',
    body: `Thank you {{customer_name}}. Your {{service}} is booked for {{date}} at {{time}}.

{{combo_note}}

{{booking_summary}}

{{garage_name}}
{{garage_address}}
{{garage_phone}}`,
  },
  garage_booking: {
    id: 'garage_booking',
    name: 'Garage new-booking notice',
    subject: 'New booking {{booking_id}} — {{vrm}} — {{date_iso}} {{time_raw}}',
    body: `A new workshop booking has been made.

{{booking_summary}}

Manage the calendar: /admin`,
  },
  callback: {
    id: 'callback',
    name: 'Contact-form callback',
    subject: 'Callback request — {{customer_name}} — {{phone}}',
    body: `A customer asked for a callback from the website.

{{callback_summary}}`,
  },
};

function isTemplateId(value: string): value is EmailTemplateId {
  return (EMAIL_TEMPLATE_IDS as readonly string[]).includes(value);
}

function mapTemplate(row: Record<string, unknown>): EmailTemplate | null {
  const id = String(row.id ?? '');
  if (!isTemplateId(id)) return null;
  return {
    id,
    name: String(row.name ?? DEFAULT_EMAIL_TEMPLATES[id].name),
    subject: String(row.subject ?? ''),
    body: String(row.body ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

function fallbackTemplate(id: EmailTemplateId): EmailTemplate {
  return { ...DEFAULT_EMAIL_TEMPLATES[id], updated_at: '' };
}

async function seedMissingTemplates() {
  const now = new Date().toISOString();
  for (const id of EMAIL_TEMPLATE_IDS) {
    const existing = await sqlGet('SELECT id FROM email_templates WHERE id = $1', [id]);
    if (existing) continue;
    const seed = DEFAULT_EMAIL_TEMPLATES[id];
    try {
      await sqlRun(
        `INSERT INTO email_templates (id, name, subject, body, updated_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [seed.id, seed.name, seed.subject, seed.body, now],
      );
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
    }
  }
}

export async function listEmailTemplates(): Promise<EmailTemplate[]> {
  await seedMissingTemplates();
  const rows = await sqlAll<Record<string, unknown>>('SELECT * FROM email_templates');
  const byId = new Map<string, EmailTemplate>();
  for (const row of rows) {
    const template = mapTemplate(row);
    if (template) byId.set(template.id, template);
  }
  return EMAIL_TEMPLATE_IDS.map((id) => byId.get(id) ?? fallbackTemplate(id));
}

export async function getEmailTemplate(id: EmailTemplateId): Promise<EmailTemplate> {
  try {
    await seedMissingTemplates();
    const row = await sqlGet<Record<string, unknown>>('SELECT * FROM email_templates WHERE id = $1', [id]);
    return (row && mapTemplate(row)) || fallbackTemplate(id);
  } catch {
    return fallbackTemplate(id);
  }
}

export async function saveEmailTemplate(input: { id: string; subject: string; body: string }) {
  if (!isTemplateId(input.id)) return { error: 'Unknown email template.', template: null };
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) return { error: 'Enter a subject line.', template: null };
  if (!body) return { error: 'Enter the email body.', template: null };

  const now = new Date().toISOString();
  const seed = DEFAULT_EMAIL_TEMPLATES[input.id];
  const existing = await sqlGet('SELECT id FROM email_templates WHERE id = $1', [input.id]);
  if (existing) {
    await sqlRun('UPDATE email_templates SET subject = $1, body = $2, updated_at = $3 WHERE id = $4', [
      subject,
      body,
      now,
      input.id,
    ]);
  } else {
    await sqlRun(
      `INSERT INTO email_templates (id, name, subject, body, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [seed.id, seed.name, subject, body, now],
    );
  }
  return { error: '', template: await getEmailTemplate(input.id) };
}

export function renderEmailTemplate(text: string, fields: Record<string, string>) {
  const rendered = text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => fields[key] ?? '');
  return rendered.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
