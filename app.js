/**
 * 내 맛집 다이어리 - 모바일 앱
 * 후기만: 50P, 사진 포함: 100P 적립
 */

const STORAGE_KEY = 'myRestaurantReviews';
const POINTS_KEY = 'myRestaurantPoints';
const POINT_HISTORY_KEY = 'myRestaurantPointHistory';
const AUTH_KEY = 'appAuthUser';
const AD_CONTENT_KEY = 'appAdContent';
const USERS_KEY = 'appUsers';
const MASTER_USER = 'master';
const MASTER_PASS = '1111';
const POINTS_REVIEW_ONLY = 50;
const POINTS_WITH_PHOTO = 100;
const POINTS_AD_WATCH = 10;
const POINTS_ATTENDANCE = 50;
const AD_WATCH_SECONDS = 30;
const ATTENDANCE_KEY = 'appLastAttendanceDate';
const INSTALL_BANNER_DISMISSED_KEY = 'appInstallBannerDismissed';
const HALL_SEED_ENABLED_KEY = 'appHallSeedEnabled';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** 음식 카테고리 */
const CATEGORIES = ['한식', '중식', '일식', '양식', '분식'];

/** 명예의 전당 - 다른 유저들이 평가한 식당 (시드, 10점 만점) */
const SEED_RESTAURANTS = [
  { name: '청담 스시오마카세', rating: 9.8, category: '일식' },
  { name: '강남 한우스테이크', rating: 9.6, category: '양식' },
  { name: '이태원 파스타집', rating: 9.4, category: '양식' },
  { name: '홍대 감성타코', rating: 9.3, category: '양식' },
  { name: '성수 브런치카페', rating: 9.2, category: '양식' },
  { name: '을지로 한정식', rating: 9.1, category: '한식' },
  { name: '잠실 맛집횟집', rating: 9.0, category: '일식' },
  { name: '압구정 디저트카페', rating: 8.9, category: '양식' },
  { name: '광화문 한식당', rating: 8.8, category: '한식' },
  { name: '이태원 와인바', rating: 8.7, category: '양식' },
];

/** 명예의 전당 - 한 주 포인트 시드 (다른 유저) */
const SEED_WEEKLY_USERS = [
  { name: '맛집탐험가', weeklyPoints: 320 },
  { name: '음식천재', weeklyPoints: 280 },
  { name: '배달의민족', weeklyPoints: 250 },
  { name: '요리사', weeklyPoints: 220 },
  { name: '푸드스타그램', weeklyPoints: 200 },
];

// ===== 데이터 =====
function getReviews() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveReviews(reviews) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
}

function getPoints() {
  const v = localStorage.getItem(POINTS_KEY);
  return v ? parseInt(v, 10) : 0;
}

function addPoints(amount) {
  const current = getPoints();
  const next = current + amount;
  localStorage.setItem(POINTS_KEY, String(next));
  const history = getPointHistory();
  history.push({ at: new Date().toISOString(), points: amount });
  try {
    localStorage.setItem(POINT_HISTORY_KEY, JSON.stringify(history.slice(-500)));
  } catch (e) {}
  return next;
}

function getPointHistory() {
  try {
    const raw = localStorage.getItem(POINT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** 회원 목록 { [username]: { password, isMaster? } } */
function getUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!data || !data[MASTER_USER]) {
      const init = { [MASTER_USER]: { password: MASTER_PASS, isMaster: true } };
      localStorage.setItem(USERS_KEY, JSON.stringify(init));
      return init;
    }
    return data;
  } catch {
    const init = { [MASTER_USER]: { password: MASTER_PASS, isMaster: true } };
    localStorage.setItem(USERS_KEY, JSON.stringify(init));
    return init;
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** 로그인 상태 */
function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_KEY);
}

function isMaster() {
  const u = getCurrentUser();
  return u && u.isMaster === true;
}

/** 광고 콘텐츠 (마스터만 등록, localStorage) */
function getAdContent() {
  try {
    const raw = localStorage.getItem(AD_CONTENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setAdContent(data) {
  if (data && (data.type === 'image' || data.type === 'iframe') && data.url) {
    localStorage.setItem(AD_CONTENT_KEY, JSON.stringify(data));
  } else {
    localStorage.removeItem(AD_CONTENT_KEY);
  }
}

/** 명예의 전당 시드 데이터 사용 여부 (마스터가 삭제 시 false) */
function getHallSeedEnabled() {
  const v = localStorage.getItem(HALL_SEED_ENABLED_KEY);
  return v !== '0';
}

function setHallSeedEnabled(enabled) {
  if (enabled) localStorage.removeItem(HALL_SEED_ENABLED_KEY);
  else localStorage.setItem(HALL_SEED_ENABLED_KEY, '0');
}

/** 출석: 마지막 출석일 YYYY-MM-DD */
function getLastAttendanceDate() {
  return localStorage.getItem(ATTENDANCE_KEY) || null;
}

function setLastAttendanceDate(dateStr) {
  if (dateStr) localStorage.setItem(ATTENDANCE_KEY, dateStr);
  else localStorage.removeItem(ATTENDANCE_KEY);
}

function hasAttendedToday() {
  const today = new Date().toISOString().slice(0, 10);
  return getLastAttendanceDate() === today;
}

function claimAttendance() {
  if (hasAttendedToday()) return false;
  const today = new Date().toISOString().slice(0, 10);
  setLastAttendanceDate(today);
  addPoints(POINTS_ATTENDANCE);
  return true;
}

/** 최근 7일간 획득한 포인트 합계 */
function getWeeklyPoints() {
  const cutoff = Date.now() - ONE_WEEK_MS;
  return getPointHistory()
    .filter((e) => new Date(e.at).getTime() >= cutoff)
    .reduce((sum, e) => sum + (e.points || 0), 0);
}

function getNextId() {
  const reviews = getReviews();
  if (reviews.length === 0) return 1;
  return Math.max(...reviews.map((r) => r.id)) + 1;
}

function getTop10() {
  const reviews = getReviews();
  return [...reviews]
    .sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0))
    .slice(0, 10);
}

/** 명예의 전당 식당: 내 리뷰 + 다른 유저 평가 가게 합친 최고 평점 (10점 만점, 소수점 1자리) */
function getHallOfFameRestaurants() {
  const map = new Map();
  getReviews().forEach((r) => {
    const name = (r.name || '').trim();
    if (!name) return;
    const rating = toRating10(r.rating);
    const cur = map.get(name);
    if (!cur || cur.rating < rating) map.set(name, { rating, category: r.category || '' });
  });
  if (getHallSeedEnabled()) {
    SEED_RESTAURANTS.forEach((s) => {
      const name = (s.name || '').trim();
      const rating = toRating10(s.rating);
      const cur = map.get(name);
      if (!cur || cur.rating < rating) map.set(name, { rating, category: s.category || '' });
    });
  }
  return Array.from(map.entries())
    .map(([name, o]) => ({ name, rating: o.rating, category: o.category }))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 15);
}

/** 명예의 전당 - 카테고리별 식당 순위 */
function getHallOfFameRestaurantsByCategory(category) {
  if (!(category || '').trim()) return [];
  const all = getHallOfFameRestaurants();
  return all
    .filter((r) => (r.category || '').trim() === (category || '').trim())
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 15);
}

/** 0~10점 소수점 1자리. 예전 5점제(1~5 정수)는 2배로 환산, 0은 0 유지 */
function toRating10(v) {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return 0;
  if (n >= 1 && n <= 5 && n === Math.round(n)) return Math.round(n * 20) / 10;
  return Math.round(Math.min(10, Math.max(0, n)) * 10) / 10;
}

/** 명예의 전당 사람: 한 주 최고 포인트 획득자 (나 + 시드 유저). 로그인 시 아이디로 표시 */
function getHallOfFameReviewers() {
  const currentUser = getCurrentUser();
  const me = {
    name: (currentUser && currentUser.username) ? currentUser.username : '나',
    weeklyPoints: getWeeklyPoints(),
    totalPoints: getPoints(),
    isMe: true,
  };
  const list = getHallSeedEnabled() ? [me, ...SEED_WEEKLY_USERS.map((u) => ({ ...u, isMe: false }))] : [me];
  list.sort((a, b) => (b.weeklyPoints || 0) - (a.weeklyPoints || 0));
  return list;
}

/** 같은 식당은 한 주에 한 번만: 동일 식당명으로 7일 이내 리뷰가 있으면 false */
function canAddReviewForRestaurant(name, newDateStr) {
  const norm = (n) => (n || '').trim().toLowerCase();
  const nameNorm = norm(name);
  if (!nameNorm) return true;
  const newDate = newDateStr ? new Date(newDateStr) : new Date();
  const reviews = getReviews();
  for (const r of reviews) {
    if (norm(r.name) !== nameNorm) continue;
    const existingDate = r.visitDate ? new Date(r.visitDate) : new Date(r.createdAt);
    const diffMs = Math.abs(newDate - existingDate);
    if (diffMs < ONE_WEEK_MS) return false;
  }
  return true;
}

// ===== DOM =====
const navItems = document.querySelectorAll('.nav-item');
const panels = document.querySelectorAll('.panel');
const top10List = document.getElementById('top10-list');
const top10Empty = document.getElementById('top10-empty');
const hallTabs = document.querySelectorAll('.hall-tab');
const hallPanels = document.querySelectorAll('.hall-panel');
const hallReviewersList = document.getElementById('hall-reviewers');
const hallReviewersEmpty = document.getElementById('hall-reviewers-empty');
const hallRestaurantsList = document.getElementById('hall-restaurants');
const hallRestaurantsEmpty = document.getElementById('hall-restaurants-empty');
const hallCategorySelect = document.getElementById('hall-category-select');
const hallCategoryList = document.getElementById('hall-category-list');
const hallCategoryEmpty = document.getElementById('hall-category-empty');
const adWatchBtn = document.getElementById('ad-watch-btn');
const adCountdownOverlay = document.getElementById('ad-countdown-overlay');
const adCountdownNum = document.getElementById('ad-countdown-num');
const panelAds = document.getElementById('panel-ads');
const btnLogin = document.getElementById('btn-login');
const headerUser = document.getElementById('header-user');
const headerUsername = document.getElementById('header-username');
const btnLogout = document.getElementById('btn-logout');
const loginModal = document.getElementById('login-modal');
const loginModalClose = document.getElementById('login-modal-close');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const adAdminSection = document.getElementById('ad-admin-section');
const adAdminForm = document.getElementById('ad-admin-form');
const adRemoveBtn = document.getElementById('ad-remove-btn');
const adPlaceholder = document.getElementById('ad-placeholder');
const attendanceBar = document.getElementById('attendance-bar');
const attendanceDone = document.getElementById('attendance-done');
const attendanceTodo = document.getElementById('attendance-todo');
const btnAttendance = document.getElementById('btn-attendance');
const installBanner = document.getElementById('install-banner');
const btnInstallPwa = document.getElementById('btn-install-pwa');
const btnInstallGuide = document.getElementById('btn-install-guide');
const installBannerClose = document.getElementById('install-banner-close');
const installGuide = document.getElementById('install-guide');
const mypageGuest = document.getElementById('mypage-guest');
const mypageUser = document.getElementById('mypage-user');
const mypageUsername = document.getElementById('mypage-username');
const mypageMasterSection = document.getElementById('mypage-master-section');
const btnHallSeedToggle = document.getElementById('btn-hall-seed-toggle');
const reviewsList = document.getElementById('reviews-list');
const reviewsEmpty = document.getElementById('reviews-empty');
const reviewForm = document.getElementById('review-form');
const ratingSlider = document.getElementById('rating-slider');
const ratingDisplay = document.getElementById('rating-display');
const photoInput = document.getElementById('photo-input');
const photoPreview = document.getElementById('photo-preview');
const btnAddPhoto = document.getElementById('btn-add-photo');
const btnRemovePhoto = document.getElementById('btn-remove-photo');
const pointsValue = document.getElementById('points-value');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modal-close');
const editForm = document.getElementById('edit-form');
const editPhotoPreview = document.getElementById('edit-photo-preview');
const editPhotoInput = document.getElementById('edit-photo-input');
const btnEditPhotoChange = document.getElementById('edit-photo-change');
const btnDelete = document.getElementById('btn-delete');

// ===== 포인트 표시 =====
function renderPoints() {
  pointsValue.textContent = getPoints();
}

// ===== 토스트 =====
function showToast(message) {
  toastMessage.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2500);
}

// ===== 로그인 / 광고 관리 UI =====
function renderAuthUI() {
  const user = getCurrentUser();
  if (btnLogin) btnLogin.classList.toggle('hidden', !!user);
  if (headerUser) headerUser.classList.toggle('hidden', !user);
  if (headerUsername && user) headerUsername.textContent = user.username;
}

function renderAdContent() {
  if (!adPlaceholder) return;
  const ad = getAdContent();
  const safe = (s) => (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  if (ad && ad.url) {
    if (ad.type === 'image') {
      adPlaceholder.innerHTML = '<img src="' + safe(ad.url) + '" alt="광고" class="ad-display-img" />';
    } else {
      adPlaceholder.innerHTML = '<iframe src="' + safe(ad.url) + '" class="ad-display-iframe" title="광고"></iframe>';
    }
  } else {
    adPlaceholder.innerHTML = '<span class="ad-placeholder-text">광고 영역</span><p class="ad-placeholder-desc">아래 버튼을 누르고 전체 시청을 완료하면 10P가 적립됩니다.</p>';
  }
}

function renderAdsPanel() {
  renderAdContent();
  if (adAdminSection) adAdminSection.classList.toggle('hidden', !isMaster());
  if (isMaster() && adAdminForm && getAdContent()) {
    const ad = getAdContent();
    const typeSel = document.getElementById('ad-type');
    const urlIn = document.getElementById('ad-url');
    if (typeSel) typeSel.value = ad.type || 'image';
    if (urlIn) urlIn.value = ad.url || '';
  }
}

// ===== 출석 (하루 50P) =====
function renderAttendance() {
  if (!attendanceDone || !attendanceTodo) return;
  if (hasAttendedToday()) {
    attendanceDone.classList.remove('hidden');
    attendanceTodo.classList.add('hidden');
  } else {
    attendanceDone.classList.add('hidden');
    attendanceTodo.classList.remove('hidden');
  }
}

if (btnAttendance) {
  btnAttendance.addEventListener('click', () => {
    if (hasAttendedToday()) return;
    if (claimAttendance()) {
      renderPoints();
      renderHallOfFame();
      renderAttendance();
      showToast('출석 완료! +50P');
    }
  });
}

// ===== 앱 설치 유도 (모바일) =====
let deferredInstallPrompt = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
}

function showInstallBannerIfNeeded() {
  if (!installBanner) return;
  if (isStandalone()) return;
  if (!isMobile()) return;
  if (localStorage.getItem(INSTALL_BANNER_DISMISSED_KEY)) return;
  installBanner.classList.remove('hidden');
}

if (window.addEventListener) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (btnInstallPwa) btnInstallPwa.classList.remove('hidden');
  });
}

if (btnInstallPwa) {
  btnInstallPwa.addEventListener('click', () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then(() => { deferredInstallPrompt = null; });
    }
    if (installBanner) installBanner.classList.add('hidden');
    localStorage.setItem(INSTALL_BANNER_DISMISSED_KEY, '1');
  });
}

if (btnInstallGuide) {
  btnInstallGuide.addEventListener('click', () => {
    if (installGuide) installGuide.classList.toggle('hidden');
  });
}

if (installBannerClose) {
  installBannerClose.addEventListener('click', () => {
    if (installBanner) installBanner.classList.add('hidden');
    localStorage.setItem(INSTALL_BANNER_DISMISSED_KEY, '1');
  });
}

// ===== 내 정보 탭 =====
function renderMypage() {
  const user = getCurrentUser();
  if (mypageGuest) mypageGuest.classList.toggle('hidden', !!user);
  if (mypageUser) mypageUser.classList.toggle('hidden', !user);
  if (!user) return;
  if (mypageUsername) mypageUsername.textContent = user.username;
  if (mypageMasterSection) mypageMasterSection.classList.toggle('hidden', !user.isMaster);
  if (btnHallSeedToggle) {
    btnHallSeedToggle.textContent = getHallSeedEnabled() ? '시드 삭제' : '씨드 다시 표시';
  }
}

if (document.getElementById('mypage-form-username')) {
  document.getElementById('mypage-form-username').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return;
    const newUsername = (document.getElementById('mypage-new-username').value || '').trim();
    if (newUsername.length < 2) { showToast('아이디는 2자 이상 입력해 주세요.'); return; }
    if (newUsername === user.username) { showToast('현재와 동일한 아이디예요.'); return; }
    const users = getUsers();
    if (users[newUsername]) { showToast('이미 사용 중인 아이디예요.'); return; }
    const oldData = users[user.username];
    if (!oldData) { showToast('오류가 발생했어요.'); return; }
    users[newUsername] = { ...oldData };
    delete users[user.username];
    saveUsers(users);
    setCurrentUser({ username: newUsername, isMaster: !!oldData.isMaster });
    renderAuthUI();
    renderMypage();
    document.getElementById('mypage-new-username').value = '';
    showToast('아이디가 변경되었어요.');
  });
}

if (document.getElementById('mypage-form-password')) {
  document.getElementById('mypage-form-password').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return;
    const current = (document.getElementById('mypage-current-pw').value || '');
    const newPw = (document.getElementById('mypage-new-pw').value || '');
    const confirmPw = (document.getElementById('mypage-new-pw-confirm').value || '');
    const users = getUsers();
    const u = users[user.username];
    if (!u || u.password !== current) { showToast('현재 비밀번호가 맞지 않아요.'); return; }
    if (newPw.length < 4) { showToast('새 비밀번호는 4자 이상이어야 해요.'); return; }
    if (newPw !== confirmPw) { showToast('새 비밀번호가 일치하지 않아요.'); return; }
    u.password = newPw;
    saveUsers(users);
    document.getElementById('mypage-current-pw').value = '';
    document.getElementById('mypage-new-pw').value = '';
    document.getElementById('mypage-new-pw-confirm').value = '';
    showToast('비밀번호가 변경되었어요.');
  });
}

if (btnHallSeedToggle) {
  btnHallSeedToggle.addEventListener('click', () => {
    if (!isMaster()) return;
    const enabled = getHallSeedEnabled();
    setHallSeedEnabled(!enabled);
    renderMypage();
    renderHallOfFame();
    showToast(enabled ? '시드가 삭제되었어요.' : '씨드가 다시 표시되었어요.');
  });
}

// ===== 탭(하단 네비) 전환 =====
navItems.forEach((item) => {
  item.addEventListener('click', () => {
    const targetId = 'panel-' + item.dataset.tab;
    navItems.forEach((i) => {
      i.classList.remove('active');
      i.setAttribute('aria-selected', 'false');
    });
    panels.forEach((p) => p.classList.toggle('active', p.id === targetId));
    item.classList.add('active');
    item.setAttribute('aria-selected', 'true');
    if (targetId === 'panel-top10') { renderTop10(); renderAttendance(); }
    if (targetId === 'panel-hall') renderHallOfFame();
    if (targetId === 'panel-reviews') renderReviews();
    if (targetId === 'panel-ads') { cancelAdCountdown(); renderAdsPanel(); }
    if (targetId === 'panel-mypage') renderMypage();
  });
});

// ===== 평점 (10점 만점, 소수점 1자리) =====
function formatRating(v) {
  const n = parseFloat(v);
  return Number.isNaN(n) ? '0.0' : toRating10(n).toFixed(1);
}

function initStarRating() {
  if (!ratingSlider || !ratingDisplay) return;
  const update = () => {
    const val = parseFloat(ratingSlider.value) || 5;
    const clamped = Math.min(10, Math.max(0, Math.round(val * 10) / 10));
    ratingSlider.value = String(clamped);
    ratingDisplay.textContent = formatRating(clamped);
  };
  ratingSlider.addEventListener('input', update);
  update();
}

// ===== 사진 (폼) =====
let pendingPhotoBase64 = null;

btnAddPhoto.addEventListener('click', () => photoInput.click());

photoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    pendingPhotoBase64 = reader.result;
    const safeSrc = (reader.result || '').replace(/"/g, '&quot;');
    photoPreview.innerHTML = '<img src="' + safeSrc + '" alt="미리보기" />';
    btnAddPhoto.classList.add('hidden');
    btnRemovePhoto.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

btnRemovePhoto.addEventListener('click', () => {
  pendingPhotoBase64 = null;
  photoInput.value = '';
  photoPreview.innerHTML = '';
  btnAddPhoto.classList.remove('hidden');
  btnRemovePhoto.classList.add('hidden');
});

// ===== 유틸 =====
function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function starsHtml(rating) {
  return '★ ' + formatRating(rating) + ' / 10';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== 카드 렌더 =====
function buildReviewCard(review, options = {}) {
  const { showRank, rank } = options;
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = review.id;
  const photoBlock = review.photo
    ? '<img class="card-photo" src="' + (review.photo.replace(/"/g, '&quot;')) + '" alt="" />'
    : '';
  card.innerHTML =
    photoBlock +
    `
    <div class="card-body">
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(review.name)}</h3>
        ${showRank && rank ? `<span class="card-rank">${rank}</span>` : ''}
      </div>
      <div class="card-meta">
        ${review.category ? `<span class="card-category">${escapeHtml(review.category)}</span>` : ''}
        ${review.location ? `<span>📍 ${escapeHtml(review.location)}</span>` : ''}
        ${review.visitDate ? `<span>📅 ${formatDate(review.visitDate)}</span>` : ''}
        <span class="card-stars">${starsHtml(review.rating)}</span>
      </div>
      ${review.comment ? `<p class="card-comment">${escapeHtml(review.comment)}</p>` : ''}
      ${review.detail ? `<pre class="card-detail">${escapeHtml(review.detail)}</pre>` : ''}
      <div class="card-actions">
        <button type="button" class="btn-edit">수정</button>
        <button type="button" class="btn-delete">삭제</button>
      </div>
    </div>
  `;

  card.querySelector('.btn-edit').addEventListener('click', () => openEditModal(review));
  card.querySelector('.btn-delete').addEventListener('click', () => deleteReview(review.id));
  return card;
}

// ===== Top10 / 전체 후기 =====
function renderTop10() {
  const top10 = getTop10();
  top10List.innerHTML = '';
  top10Empty.classList.add('hidden');
  if (top10.length === 0) {
    top10Empty.classList.remove('hidden');
    return;
  }
  top10.forEach((review, index) => {
    top10List.appendChild(buildReviewCard(review, { showRank: true, rank: index + 1 }));
  });
}

function renderReviews() {
  const reviews = getReviews();
  const sorted = [...reviews].sort((a, b) => (b.id || 0) - (a.id || 0));
  reviewsList.innerHTML = '';
  reviewsEmpty.classList.add('hidden');
  if (sorted.length === 0) {
    reviewsEmpty.classList.remove('hidden');
    return;
  }
  sorted.forEach((review) => reviewsList.appendChild(buildReviewCard(review)));
}

// ===== 명예의 전당 =====
function switchHallTab(tabKey) {
  hallTabs.forEach((t) => {
    const isActive = t.dataset.hall === tabKey;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  hallPanels.forEach((p) => {
    const id = p.id;
    const match = id === 'hall-panel-people' && tabKey === 'people' ||
      id === 'hall-panel-restaurants' && tabKey === 'restaurants' ||
      id === 'hall-panel-category' && tabKey === 'category';
    p.classList.toggle('active', !!match);
  });
  if (tabKey === 'category') renderHallCategoryList();
}

function renderHallCategoryList() {
  if (!hallCategoryList || !hallCategoryEmpty) return;
  const category = (hallCategorySelect && hallCategorySelect.value) || CATEGORIES[0];
  const list = getHallOfFameRestaurantsByCategory(category);
  hallCategoryList.innerHTML = '';
  hallCategoryEmpty.classList.add('hidden');
  if (list.length === 0) {
    hallCategoryEmpty.classList.remove('hidden');
  } else {
    list.forEach((r, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="hall-rank-num">' + (i + 1) + '</span><div class="hall-rank-content">' + escapeHtml(r.name) + '<div class="hall-rank-meta">★ ' + formatRating(r.rating) + ' / 10</div></div>';
      hallCategoryList.appendChild(li);
    });
  }
}

function renderHallOfFame() {
  const reviewers = getHallOfFameReviewers();
  hallReviewersList.innerHTML = '';
  hallReviewersEmpty.classList.add('hidden');
  if (reviewers.length === 0) {
    hallReviewersEmpty.classList.remove('hidden');
  } else {
    reviewers.forEach((u, i) => {
      const li = document.createElement('li');
      const points = u.isMe ? (u.totalPoints ?? getPoints()) : (u.weeklyPoints || 0);
      const label = u.isMe ? 'P (총)' : 'P (이번 주)';
      li.innerHTML = '<span class="hall-rank-num">' + (i + 1) + '</span><div class="hall-rank-content">' + escapeHtml(u.name) + '<div class="hall-rank-meta">' + points + label + '</div></div>';
      hallReviewersList.appendChild(li);
    });
  }

  const restaurants = getHallOfFameRestaurants();
  hallRestaurantsList.innerHTML = '';
  hallRestaurantsEmpty.classList.add('hidden');
  if (restaurants.length === 0) {
    hallRestaurantsEmpty.classList.remove('hidden');
  } else {
    restaurants.forEach((r, i) => {
      const li = document.createElement('li');
      const catText = r.category ? ' · ' + escapeHtml(r.category) : '';
      li.innerHTML = '<span class="hall-rank-num">' + (i + 1) + '</span><div class="hall-rank-content">' + escapeHtml(r.name) + '<div class="hall-rank-meta">★ ' + formatRating(r.rating) + ' / 10' + catText + '</div></div>';
      hallRestaurantsList.appendChild(li);
    });
  }

  renderHallCategoryList();
}

if (hallTabs.length) {
  hallTabs.forEach((t) => {
    t.addEventListener('click', () => switchHallTab(t.dataset.hall));
  });
}
if (hallCategorySelect) {
  hallCategorySelect.addEventListener('change', () => renderHallCategoryList());
}

// ===== 광고 시청 (전체 시청 시 10P) =====
let adCountdownTimer = null;

function cancelAdCountdown() {
  if (adCountdownTimer) {
    clearInterval(adCountdownTimer);
    adCountdownTimer = null;
  }
  if (adCountdownOverlay) adCountdownOverlay.classList.add('hidden');
  if (adCountdownNum) adCountdownNum.textContent = AD_WATCH_SECONDS;
  if (adWatchBtn) {
    adWatchBtn.disabled = false;
    adWatchBtn.textContent = '광고 시청하기 (10P)';
  }
}

function startAdWatch() {
  if (!adWatchBtn || !adCountdownOverlay || !adCountdownNum || !panelAds) return;
  adWatchBtn.disabled = true;
  adWatchBtn.textContent = '시청 중...';
  adCountdownOverlay.classList.remove('hidden');
  let left = AD_WATCH_SECONDS;
  adCountdownNum.textContent = String(left);

  adCountdownTimer = setInterval(() => {
    left -= 1;
    if (adCountdownNum) adCountdownNum.textContent = String(left);
    if (left > 0) {
      if (!panelAds || !panelAds.classList.contains('active')) {
        cancelAdCountdown();
        return;
      }
      return;
    }
    clearInterval(adCountdownTimer);
    adCountdownTimer = null;
    addPoints(POINTS_AD_WATCH);
    renderPoints();
    renderHallOfFame();
    showToast('+10P 적립!');
    adCountdownOverlay.classList.add('hidden');
    adCountdownNum.textContent = AD_WATCH_SECONDS;
    adWatchBtn.disabled = false;
    adWatchBtn.textContent = '광고 시청하기 (10P)';
  }, 1000);
}

if (adWatchBtn) {
  adWatchBtn.addEventListener('click', () => {
    if (adWatchBtn.disabled) return;
    startAdWatch();
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelAdCountdown();
});

// ===== 로그인 모달 =====
if (btnLogin) btnLogin.addEventListener('click', () => { loginModal.classList.remove('hidden'); showLoginView(); });
if (loginModal) loginModal.addEventListener('click', (e) => { if (e.target === loginModal) { loginModal.classList.add('hidden'); showLoginView(); } });

if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = (document.getElementById('login-username').value || '').trim();
    const password = (document.getElementById('login-password').value || '');
    if (loginError) loginError.classList.add('hidden');
    const users = getUsers();
    const user = users[username];
    if (user && user.password === password) {
      setCurrentUser({ username, isMaster: !!user.isMaster });
      renderAuthUI();
      loginModal.classList.add('hidden');
      loginForm.reset();
      showToast(user.isMaster ? '관리자로 로그인했습니다.' : '로그인했습니다.');
    } else {
      if (loginError) {
        loginError.textContent = '아이디 또는 비밀번호가 올바르지 않습니다.';
        loginError.classList.remove('hidden');
      }
    }
  });
}

// 로그인 ↔ 회원가입 화면 전환
const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');
const signupForm = document.getElementById('signup-form');
const signupError = document.getElementById('signup-error');

function showLoginView() {
  if (loginView) loginView.classList.remove('hidden');
  if (signupView) signupView.classList.add('hidden');
  if (loginError) loginError.classList.add('hidden');
  if (signupError) signupError.classList.add('hidden');
}

function showSignupView() {
  if (loginView) loginView.classList.add('hidden');
  if (signupView) signupView.classList.remove('hidden');
  if (loginError) loginError.classList.add('hidden');
  if (signupError) signupError.classList.add('hidden');
}

if (document.getElementById('btn-show-signup')) {
  document.getElementById('btn-show-signup').addEventListener('click', showSignupView);
}
if (document.getElementById('btn-show-login')) {
  document.getElementById('btn-show-login').addEventListener('click', showLoginView);
}

if (loginModalClose) loginModalClose.addEventListener('click', () => { loginModal.classList.add('hidden'); showLoginView(); });

if (signupForm) {
  signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = (document.getElementById('signup-username').value || '').trim();
    const password = (document.getElementById('signup-password').value || '');
    const passwordConfirm = (document.getElementById('signup-password-confirm').value || '');
    if (signupError) signupError.classList.add('hidden');
    if (username.length < 2) {
      if (signupError) { signupError.textContent = '아이디는 2자 이상 입력해 주세요.'; signupError.classList.remove('hidden'); }
      return;
    }
    if (password.length < 4) {
      if (signupError) { signupError.textContent = '비밀번호는 4자 이상 입력해 주세요.'; signupError.classList.remove('hidden'); }
      return;
    }
    if (password !== passwordConfirm) {
      if (signupError) { signupError.textContent = '비밀번호가 일치하지 않습니다.'; signupError.classList.remove('hidden'); }
      return;
    }
    const users = getUsers();
    if (users[username]) {
      if (signupError) { signupError.textContent = '이미 사용 중인 아이디입니다.'; signupError.classList.remove('hidden'); }
      return;
    }
    users[username] = { password, isMaster: false };
    saveUsers(users);
    signupForm.reset();
    showLoginView();
    showToast('회원가입이 완료되었습니다. 로그인해 주세요.');
  });
}

if (btnLogout) {
  btnLogout.addEventListener('click', () => {
    setCurrentUser(null);
    renderAuthUI();
    if (panelAds && panelAds.classList.contains('active')) renderAdsPanel();
    showToast('로그아웃했습니다.');
  });
}

// ===== 광고 등록 (마스터) =====
if (adAdminForm) {
  adAdminForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('ad-type').value || 'image';
    const url = (document.getElementById('ad-url').value || '').trim();
    if (!url) { showToast('URL을 입력해 주세요.'); return; }
    setAdContent({ type, url });
    renderAdContent();
    showToast('광고가 저장되었습니다.');
  });
}
if (adRemoveBtn) {
  adRemoveBtn.addEventListener('click', () => {
    setAdContent(null);
    renderAdContent();
    if (document.getElementById('ad-url')) document.getElementById('ad-url').value = '';
    showToast('광고가 제거되었습니다.');
  });
}

// ===== 후기 저장 (포인트 적립) =====
reviewForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(reviewForm);
  const hasPhoto = !!pendingPhotoBase64;
  const points = hasPhoto ? POINTS_WITH_PHOTO : POINTS_REVIEW_ONLY;

  const rawRating = parseFloat(formData.get('rating')) || 5;
  const review = {
    id: getNextId(),
    name: formData.get('name').trim(),
    location: (formData.get('location') || '').trim(),
    category: (formData.get('category') || '').trim(),
    rating: toRating10(rawRating),
    comment: (formData.get('comment') || '').trim(),
    detail: (formData.get('detail') || '').trim(),
    visitDate: formData.get('visitDate') || '',
    photo: pendingPhotoBase64 || null,
    createdAt: new Date().toISOString(),
  };
  if (!review.name) return;

  const reviewDate = review.visitDate || review.createdAt;
  if (!canAddReviewForRestaurant(review.name, reviewDate)) {
    showToast('같은 식당은 한 주에 한 번만 리뷰할 수 있어요.');
    return;
  }

  const reviews = getReviews();
  reviews.push(review);
  saveReviews(reviews);
  addPoints(points);
  renderPoints();

  reviewForm.reset();
  pendingPhotoBase64 = null;
  photoPreview.innerHTML = '';
  btnAddPhoto.classList.remove('hidden');
  btnRemovePhoto.classList.add('hidden');
  initStarRating();

  renderTop10();
  renderReviews();
  renderHallOfFame();

  showToast('+' + points + 'P 적립!');
  document.querySelector('.nav-item[data-tab="top10"]').click();
});

reviewForm.addEventListener('reset', () => {
  pendingPhotoBase64 = null;
  photoPreview.innerHTML = '';
  btnAddPhoto.classList.remove('hidden');
  btnRemovePhoto.classList.add('hidden');
  setTimeout(() => initStarRating(), 0);
});

// ===== 수정 모달 =====
let editingId = null;

function openEditModal(review) {
  editingId = review.id;
  modal.classList.remove('hidden');
  editForm.querySelector('[name="id"]').value = review.id;
  editForm.querySelector('[name="name"]').value = review.name || '';
  editForm.querySelector('[name="location"]').value = review.location || '';
  const editCategory = editForm.querySelector('[name="category"]');
  if (editCategory) editCategory.value = review.category || '';
  editForm.querySelector('[name="rating"]').value = formatRating(review.rating);
  editForm.querySelector('[name="comment"]').value = review.comment || '';
  editForm.querySelector('[name="detail"]').value = review.detail || '';
  editForm.querySelector('[name="visitDate"]').value = review.visitDate || '';

  editPhotoPreview.innerHTML = '';
  editPhotoInput.value = '';
  if (review.photo) {
    editPhotoPreview.innerHTML = '<img src="' + review.photo.replace(/"/g, '&quot;') + '" alt="" />';
  }
}

function closeModal() {
  modal.classList.add('hidden');
  editingId = null;
}

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

btnEditPhotoChange.addEventListener('click', () => editPhotoInput.click());

editPhotoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const reviews = getReviews();
    const idx = reviews.findIndex((r) => r.id === editingId);
    if (idx !== -1) {
      reviews[idx].photo = reader.result;
      saveReviews(reviews);
      editPhotoPreview.innerHTML = '<img src="' + reader.result.replace(/"/g, '&quot;') + '" alt="" />';
    }
  };
  reader.readAsDataURL(file);
});

editForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(editForm);
  const reviews = getReviews();
  const idx = reviews.findIndex((r) => r.id === editingId);
  if (idx === -1) {
    closeModal();
    return;
  }
  const editRating = parseFloat(editForm.querySelector('[name="rating"]').value);
  reviews[idx] = {
    ...reviews[idx],
    name: formData.get('name').trim(),
    location: (formData.get('location') || '').trim(),
    category: (formData.get('category') || '').trim(),
    rating: toRating10(editRating),
    comment: (formData.get('comment') || '').trim(),
    detail: (formData.get('detail') || '').trim(),
    visitDate: formData.get('visitDate') || '',
  };
  saveReviews(reviews);
  closeModal();
  renderTop10();
  renderReviews();
  renderHallOfFame();
});

btnDelete.addEventListener('click', () => {
  if (!editingId) return;
  if (!confirm('이 후기를 삭제할까요?')) return;
  deleteReview(editingId);
  closeModal();
});

function deleteReview(id) {
  const reviews = getReviews().filter((r) => r.id !== id);
  saveReviews(reviews);
  renderTop10();
  renderReviews();
  renderHallOfFame();
}

// ===== PWA: Service Worker 등록 (앱 설치·오프라인) =====
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// ===== 초기화 =====
function init() {
  initStarRating();
  renderPoints();
  renderTop10();
  renderReviews();
  renderAuthUI();
  renderAttendance();
  setTimeout(showInstallBannerIfNeeded, 500);
}

init();
