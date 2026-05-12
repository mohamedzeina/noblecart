// Tab switching
const navBtns = document.querySelectorAll('.profile-sidebar__nav-item[data-tab]');
const panels  = document.querySelectorAll('.profile-section[data-tab-panel]');
const ACTIVE  = 'profile-sidebar__nav-item--active';
const HIDDEN  = 'profile-section--hidden';

function showTab(tabId) {
  panels.forEach(p => {
    const isActive = p.dataset.tabPanel === tabId;
    p.classList.toggle(HIDDEN, !isActive);
    if (!isActive) {
      const alert = p.querySelector('.profile-section__alert');
      if (alert) alert.remove();
    }
  });
  navBtns.forEach(b => b.classList.toggle(ACTIVE, b.dataset.tab === tabId));
  history.replaceState(null, '', '#' + tabId);
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

// On load: activate the tab matching the URL hash (from server redirect after save)
const hash = window.location.hash.replace('#', '');
const validTabs = ['info', 'address', 'security'];
showTab(validTabs.includes(hash) ? hash : 'info');

// Address show/hide toggle
const addressEmpty   = document.getElementById('address-empty');
const addressDisplay = document.getElementById('address-display');
const addressForm    = document.getElementById('address-form');
const addressShowBtn = document.getElementById('address-show-form');
const addressCancel  = document.getElementById('address-cancel');

if (addressShowBtn) {
  addressShowBtn.addEventListener('click', () => {
    if (addressEmpty)   addressEmpty.style.display   = 'none';
    if (addressDisplay) addressDisplay.style.display = 'none';
    if (addressForm)    addressForm.classList.remove('profile-form--hidden');
  });
}

if (addressCancel) {
  addressCancel.addEventListener('click', () => {
    if (addressForm)    addressForm.classList.add('profile-form--hidden');
    if (addressDisplay) addressDisplay.style.display = '';
  });
}

// ── Cascading country → state → city ──────────────────────
const countrySelect  = document.getElementById('country');
const countryCodeIn  = document.getElementById('countryCode');
const stateField     = document.getElementById('state-field');
const stateSelect    = document.getElementById('state');
const stateLabel     = document.getElementById('state-label');
const stateCodeIn    = document.getElementById('stateCode');
const citySelect     = document.getElementById('city');
const cityLabel      = document.getElementById('city-label');

// Countries that use State → City order with those exact labels
const STATE_CITY_COUNTRIES = ['US', 'CA', 'AU', 'IN', 'BR', 'MX', 'NG', 'PH'];

function updateAddressLabels(countryCode) {
  if (!stateLabel || !cityLabel) return;
  if (STATE_CITY_COUNTRIES.includes(countryCode)) {
    stateLabel.innerHTML = 'State / Province <span class="form-required">*</span>';
    cityLabel.innerHTML  = 'City <span class="form-required">*</span>';
  } else {
    stateLabel.innerHTML = 'City / Province <span class="form-required">*</span>';
    cityLabel.innerHTML  = 'District <span class="form-required">*</span>';
  }
}

function setSelectLoading(sel, loading) {
  sel.disabled = loading;
  if (loading) sel.innerHTML = '<option value="">Loading…</option>';
}

async function loadStates(countryCode, selectedState) {
  if (!stateSelect) return;
  citySelect.innerHTML  = '<option value="">Select</option>';
  citySelect.disabled   = true;

  if (!countryCode) {
    stateField.classList.add('profile-form--hidden');
    stateSelect.required = false;
    return;
  }

  updateAddressLabels(countryCode);
  setSelectLoading(stateSelect, true);
  stateField.classList.remove('profile-form--hidden');

  const res    = await fetch(`/api/states/${countryCode}`);
  const states = await res.json();
  stateSelect.disabled = false;

  if (!states.length) {
    stateField.classList.add('profile-form--hidden');
    stateSelect.required = false;
    stateCodeIn.value    = '';
    citySelect.disabled  = false;
    citySelect.innerHTML = '<option value="">Select</option>';
    return;
  }

  stateSelect.required = true;
  const savedCode = stateCodeIn.value;
  stateSelect.innerHTML = '<option value="">Select</option>';
  states.forEach(s => {
    const opt = document.createElement('option');
    opt.value        = s.name;
    opt.dataset.code = s.isoCode;
    opt.textContent  = s.name;
    if (s.name === selectedState || s.isoCode === savedCode) opt.selected = true;
    stateSelect.appendChild(opt);
  });

  const selected = stateSelect.options[stateSelect.selectedIndex];
  stateCodeIn.value = selected ? (selected.dataset.code || '') : '';
}

async function loadCities(countryCode, stateCode, selectedCity) {
  if (!citySelect) return;
  if (!countryCode || !stateCode) { citySelect.disabled = true; return; }

  setSelectLoading(citySelect, true);

  const res    = await fetch(`/api/cities/${countryCode}/${stateCode}`);
  const cities = await res.json();

  citySelect.disabled  = false;
  citySelect.innerHTML = '<option value="">Select</option>';
  cities.forEach(name => {
    const opt = document.createElement('option');
    opt.value       = name;
    opt.textContent = name;
    if (name === selectedCity) opt.selected = true;
    citySelect.appendChild(opt);
  });
}

if (countrySelect) {
  // City starts disabled until a state is chosen
  if (!stateCodeIn.value) citySelect.disabled = true;

  countrySelect.addEventListener('change', () => {
    const selected      = countrySelect.options[countrySelect.selectedIndex];
    countryCodeIn.value = selected ? (selected.dataset.code || '') : '';
    stateCodeIn.value   = '';
    citySelect.disabled = true;
    loadStates(countryCodeIn.value, '');
  });

  stateSelect.addEventListener('change', () => {
    const selected    = stateSelect.options[stateSelect.selectedIndex];
    stateCodeIn.value = selected ? (selected.dataset.code || '') : '';
    loadCities(countryCodeIn.value, stateCodeIn.value, '');
  });

  // On page load: restore saved state+city into selects
  const savedCountryCode = countryCodeIn.value;
  const savedState       = stateCodeIn.value ? (stateSelect.querySelector('option[selected]')?.value || '') : '';
  const savedStateCode   = stateCodeIn.value;
  const savedCity        = citySelect.querySelector('option[selected]')?.getAttribute('value') || '';

  if (savedCountryCode) {
    loadStates(savedCountryCode, savedState).then(() => {
      if (savedStateCode) loadCities(savedCountryCode, savedStateCode, savedCity);
    });
  }
}

// Submit loading state for address form
const addressSubmit = addressForm?.querySelector('button[type="submit"]');
if (addressForm && addressSubmit) {
  addressForm.addEventListener('submit', () => {
    addressSubmit.disabled    = true;
    addressSubmit.textContent = 'Saving…';
  });
}

// Avatar preview
const avatarInput   = document.getElementById('profile-avatar-input');
const avatarImg     = document.getElementById('profile-avatar-img');
const avatarInitial = document.getElementById('profile-avatar-initial');

if (avatarInput) {
  avatarInput.addEventListener('change', () => {
    const file = avatarInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (avatarImg) {
        avatarImg.src = e.target.result;
        avatarImg.classList.remove('hidden');
      }
      if (avatarInitial) avatarInitial.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });
}
