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

function initDirectoryLookup() {
  const form = document.querySelector<HTMLElement>('[data-directory-form]');
  const results = document.querySelector<HTMLElement>('[data-directory-results]');
  if (!form || !results) return;

  const inputs = [...form.querySelectorAll<HTMLInputElement>('[data-directory-field]')];
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
    const vrm = field(form, 'vrm');
    const name = field(form, 'customer_name');
    const phone = field(form, 'customer_phone');
    const email = field(form, 'customer_email');
    const makeModel = field(form, 'vehicle_make_model');
    const engine = field(form, 'vehicle_engine');
    if (vrm && match.vrm) vrm.value = match.vrm;
    if (name && match.name) name.value = match.name;
    if (phone && match.phone) phone.value = match.phone;
    if (email) email.value = match.email;
    if (makeModel) makeModel.value = match.make_model;
    if (engine) engine.value = match.engine;
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
      const detail = [match.phone, match.vrm, match.make_model].filter(Boolean).join(' · ');
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
    input.addEventListener('input', () => schedule(input.value));
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

initDirectoryLookup();
