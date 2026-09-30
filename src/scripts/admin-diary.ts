type DirectoryMatch = {
  customer_id: string;
  name: string;
  phone: string;
  email: string;
  vehicle_id: string;
  vrm: string;
  make_model: string;
  engine: string;
};

function field(form: HTMLElement, name: string) {
  return form.querySelector<HTMLInputElement>(`[name="${name}"]`);
}

function fill(el: HTMLInputElement | null, value: string, overwrite = true) {
  if (!el || !value) return;
  if (!overwrite && el.value.trim()) return;
  el.value = value;
}

function compactVrm(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function applyMatch(form: HTMLElement, match: DirectoryMatch) {
  const vrmField = field(form, 'vrm');
  const typedVrm = compactVrm(vrmField?.value ?? '');
  const matchVrm = compactVrm(match.vrm);
  const keepTypedVrm = Boolean(typedVrm && matchVrm && typedVrm !== matchVrm);

  fill(field(form, 'customer_id'), match.customer_id);
  fill(field(form, 'customer_name'), match.name);
  fill(field(form, 'name'), match.name);
  fill(field(form, 'customer_phone'), match.phone);
  fill(field(form, 'phone'), match.phone);
  fill(field(form, 'customer_email'), match.email);
  fill(field(form, 'email'), match.email);

  if (!keepTypedVrm) {
    fill(field(form, 'vehicle_id'), match.vehicle_id);
    fill(vrmField, match.vrm);
    fill(field(form, 'vehicle_make_model'), match.make_model);
    fill(field(form, 'make_model'), match.make_model);
    fill(field(form, 'vehicle_engine'), match.engine);
    fill(field(form, 'engine'), match.engine);
  }
}

function initDirectoryForm(form: HTMLElement) {
  const results = form.querySelector<HTMLElement>('[data-directory-results]');
  if (!results) return;

  const inputs = [...form.querySelectorAll<HTMLInputElement>('[data-directory-field]')];
  if (inputs.length === 0) return;

  let timer = 0;
  let activeIndex = -1;
  let matches: DirectoryMatch[] = [];

  function hide() {
    matches = [];
    activeIndex = -1;
    results.hidden = true;
    results.replaceChildren();
  }

  function highlight() {
    const buttons = [...results.querySelectorAll<HTMLButtonElement>('button[data-index]')];
    for (const button of buttons) {
      const selected = Number(button.dataset.index) === activeIndex;
      button.classList.toggle('bg-brand-50', selected);
      button.classList.toggle('ring-1', selected);
      button.classList.toggle('ring-brand-200', selected);
    }
  }

  function apply(match: DirectoryMatch) {
    applyMatch(form, match);
    hide();
  }

  function render() {
    if (matches.length === 0) {
      hide();
      return;
    }
    results.hidden = false;
    results.replaceChildren();
    for (const [index, match] of matches.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.index = String(index);
      button.className = 'w-full rounded-lg px-3 py-2 text-left hover:bg-brand-50';
      const title = document.createElement('div');
      title.className = 'font-semibold text-slate-900';
      title.textContent = match.name || match.vrm || 'Existing record';
      button.append(title);
      const detail = [match.phone, match.email, match.vrm, match.make_model].filter(Boolean).join(' · ');
      if (detail) {
        const line = document.createElement('div');
        line.className = 'text-[11px] text-slate-500';
        line.textContent = detail;
        button.append(line);
      }
      results.append(button);
    }
    highlight();
  }

  async function search(query: string) {
    if (query.trim().length < 2) {
      hide();
      return;
    }
    const response = await fetch(`/api/admin/directory?q=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      hide();
      return;
    }
    const data = (await response.json()) as { matches?: DirectoryMatch[] };
    matches = data.matches ?? [];
    activeIndex = matches.length > 0 ? 0 : -1;
    render();
  }

  function schedule(query: string) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      void search(query);
    }, 180);
  }

  for (const input of inputs) {
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', () => {
      const customerId = field(form, 'customer_id');
      const vehicleId = field(form, 'vehicle_id');
      if (customerId) customerId.value = '';
      if (vehicleId) vehicleId.value = '';
      schedule(input.value);
    });
    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 2) schedule(input.value);
    });
    input.addEventListener('keydown', (event) => {
      if (results.hidden || matches.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        activeIndex = (activeIndex + 1) % matches.length;
        highlight();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        activeIndex = (activeIndex - 1 + matches.length) % matches.length;
        highlight();
      } else if (event.key === 'Enter' && activeIndex >= 0) {
        event.preventDefault();
        apply(matches[activeIndex]);
      } else if (event.key === 'Escape') {
        hide();
      }
    });
  }

  results.addEventListener('mousedown', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-index]');
    if (!button) return;
    event.preventDefault();
    const match = matches[Number(button.dataset.index)];
    if (match) apply(match);
  });

  document.addEventListener('click', (event) => {
    if (form.contains(event.target as Node)) return;
    hide();
  });
}

function initVrmLookup(form: HTMLElement) {
  const vrmField = field(form, 'vrm');
  if (!vrmField) return;

  let lastVrm = '';

  async function lookup() {
    const vrm = compactVrm(vrmField.value);
    if (vrm.length < 2 || vrm === lastVrm) return;
    lastVrm = vrm;

    const makeField = field(form, 'vehicle_make_model') || field(form, 'make_model');
    const engineField = field(form, 'vehicle_engine') || field(form, 'engine');
    if (makeField?.value.trim() && engineField?.value.trim()) return;

    try {
      const response = await fetch(`/api/lookup-vrm?vrm=${encodeURIComponent(vrm)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return;
      const data = (await response.json()) as { makeModel?: string; engineFuel?: string };
      fill(makeField, data.makeModel ?? '', false);
      fill(engineField, data.engineFuel ?? '', false);
    } catch {
      lastVrm = '';
    }
  }

  vrmField.addEventListener('blur', () => {
    void lookup();
  });
  vrmField.addEventListener('change', () => {
    void lookup();
  });
}

function initDirectoryLookup() {
  for (const form of document.querySelectorAll<HTMLElement>('[data-directory-form]')) {
    initDirectoryForm(form);
    initVrmLookup(form);
  }
}

initDirectoryLookup();
