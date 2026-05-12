// Tab switching
const navBtns = document.querySelectorAll('.profile-sidebar__nav-item[data-tab]');
const panels  = document.querySelectorAll('.profile-section[data-tab-panel]');
const ACTIVE  = 'profile-sidebar__nav-item--active';
const HIDDEN  = 'profile-section--hidden';

function showTab(tabId) {
  panels.forEach(p => p.classList.toggle(HIDDEN, p.dataset.tabPanel !== tabId));
  navBtns.forEach(b => b.classList.toggle(ACTIVE, b.dataset.tab === tabId));
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
