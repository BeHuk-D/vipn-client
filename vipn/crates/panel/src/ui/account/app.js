const state = {
  mode: "login",
  me: null,
  refreshTimer: null,
};

const REF_KEY = "vipn_ref";
const REF_PATTERN = /^[a-z0-9]{4,16}$/i;

function readRef() {
  try { return localStorage.getItem(REF_KEY) || ""; } catch { return ""; }
}

function saveRefFromUrl() {
  let code;
  try { code = new URLSearchParams(location.search).get("ref") || ""; } catch { return; }
  code = code.trim().toLowerCase();
  if (!REF_PATTERN.test(code)) return;
  try { localStorage.setItem(REF_KEY, code); } catch {}
}

function clearRef() {
  try { localStorage.removeItem(REF_KEY); } catch {}
}

const $ = (selector, root = document) => root.querySelector(selector);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmtBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} Б`;
  const units = ["КБ", "МБ", "ГБ", "ТБ"];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

function daysLabel(days) {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return `${days} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${days} дня`;
  return `${days} дней`;
}

const moneyFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function fmtMoney(kopecks) {
  return `${moneyFormat.format((Number(kopecks) || 0) / 100)} ₽`;
}

const TELEGRAM_URL = "https://t.me/BeHukD";
const RELEASES_MANIFEST = "/downloads/releases.json";
const GITHUB_RELEASES = "https://github.com/BeHuk-D/vipn-client/releases/latest";
const PLATFORM_NAMES = { linux: "Linux", windows: "Windows", android: "Android" };

const PLANS = [
  { name: "Старт", price: 7500, devices: 1 },
  { name: "Семья", price: 12000, devices: 2 },
  { name: "Максимум", price: 20000, devices: 4 },
];

function pluralDevices(count) {
  if (count === 1) return "1 устройство";
  if (count >= 2 && count <= 4) return `${count} устройства`;
  return `${count} устройств`;
}

function assetLabel(asset) {
  const os = PLATFORM_NAMES[asset.platform] || asset.platform;
  return String(asset.name || "").endsWith(".msi") ? `${os} ${asset.arch} MSI` : `${os} ${asset.arch}`;
}

function isRecommended(asset) {
  if (asset.platform === "linux") return asset.arch === "x64";
  if (asset.platform === "windows") return String(asset.name || "").endsWith(".exe");
  if (asset.platform === "android") return asset.arch === "arm64-v8a";
  return false;
}

function releaseDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function downloadRows(assets) {
  return assets.map((asset) => `
    <a class="download-row" href="${esc(asset.url)}" download>
      <span class="dl-label">${esc(assetLabel(asset))}</span>
      <span class="dl-file mono">${esc(asset.name)}</span>
      <span class="dl-size">${Math.round((Number(asset.size) || 0) / (1024 * 1024))} МБ</span>
      <span class="download-badge">${isRecommended(asset) ? "*Подходит для большинства устройств" : ""}</span>
      <span class="dl-arrow" aria-hidden="true">↓</span>
    </a>`).join("");
}

function githubRows() {
  return [
    ["Linux", "Установщик .run"],
    ["Windows", ".exe или .msi"],
    ["Android", "APK"],
  ].map(([os, note]) => `
    <a class="download-row" href="${GITHUB_RELEASES}" target="_blank" rel="noopener">
      <span class="dl-label">${os}</span>
      <span class="dl-file">${note}</span>
      <span class="dl-size"></span>
      <span class="download-badge"></span>
      <span class="dl-arrow" aria-hidden="true">↗</span>
    </a>`).join("");
}

function downloadsSection() {
  return `
    <h3 class="section-title">Скачать приложение</h3>
    <div class="card download-card">
      <div id="downloads-area">${githubRows()}</div>
      <div class="download-foot">
        <a href="/downloads/">Все файлы и инструкции по установке</a>
      </div>
    </div>`;
}

async function loadDownloads() {
  const area = $("#downloads-area");
  if (!area) return;
  try {
    const response = await fetch(RELEASES_MANIFEST, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (!data || !Array.isArray(data.assets)) return;
    const assets = data.assets.filter((asset) =>
      asset && typeof asset.url === "string" && asset.url.startsWith("/downloads/"));
    if (!assets.length) return;
    const date = releaseDate(data.published_at);
    area.innerHTML = `
      <div class="download-version">Версия ${esc(data.version)}${date ? ` · ${date}` : ""}</div>
      ${downloadRows(assets)}`;
  } catch {}
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    ...options,
  });
  const authAttempt = path === "/api/account/login" || path === "/api/account/register";
  if (response.status === 401 && !authAttempt) {
    showAuth();
    throw new Error("Требуется вход");
  }
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    if (response.status === 401) throw new Error("Неверный логин или пароль");
    throw new Error(data?.error || `Ошибка ${response.status}`);
  }
  return data;
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"), 2400);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Скопировано");
  } catch {
    toast("Не удалось скопировать");
  }
}

/* ---------- auth ---------- */

function showAuth() {
  clearInterval(state.refreshTimer);
  $("#cabinet-screen").classList.add("hidden");
  $("#auth-screen").classList.remove("hidden");
  setMode("login");
}

function showCabinet() {
  $("#auth-screen").classList.add("hidden");
  $("#cabinet-screen").classList.remove("hidden");
  $("#account-login").textContent = state.me?.login || "";
}

function setMode(mode) {
  state.mode = mode;
  const registering = mode === "register";
  $("#mode-login").classList.toggle("active", !registering);
  $("#mode-register").classList.toggle("active", registering);
  $("#mode-login").setAttribute("aria-selected", String(!registering));
  $("#mode-register").setAttribute("aria-selected", String(registering));
  $("#auth-submit").textContent = registering ? "Создать аккаунт" : "Войти";
  $("#auth-form").password.autocomplete = registering ? "new-password" : "current-password";
  const hint = $("#auth-hint");
  hint.classList.toggle("hidden", !registering);
  hint.textContent = registering
    ? `Логин: от 3 до 32 символов, латиница, цифры, _ и -. Пароль: от 8 символов.${readRef() ? " По приглашению вас ждёт скидка 25 ₽ на первый месяц." : ""}`
    : "";
  $("#auth-error").textContent = "";
}

$("#mode-login").addEventListener("click", () => setMode("login"));
$("#mode-register").addEventListener("click", () => setMode("register"));

$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  $("#auth-error").textContent = "";
  $("#auth-submit").disabled = true;
  try {
    const path = state.mode === "register" ? "/api/account/register" : "/api/account/login";
    const payload = { login: form.login.value, password: form.password.value };
    if (state.mode === "register") {
      const ref = readRef();
      if (ref) payload.ref = ref;
    }
    await api(path, { method: "POST", body: JSON.stringify(payload) });
    if (state.mode === "register") clearRef();
    form.password.value = "";
    await boot();
  } catch (error) {
    $("#auth-error").textContent = error.message;
  } finally {
    $("#auth-submit").disabled = false;
  }
});

$("#logout").addEventListener("click", async () => {
  clearInterval(state.refreshTimer);
  await api("/api/account/logout", { method: "POST" }).catch(() => {});
  state.me = null;
  showAuth();
});

/* ---------- cabinet ---------- */

async function boot() {
  try {
    state.me = await api("/api/account/me");
  } catch {
    showAuth();
    return;
  }
  showCabinet();
  renderCabinet();
  clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(() => {
    if (document.visibilityState === "visible") loadSubscription();
  }, 15000);
}

function renderCabinet() {
  $("#account-view").innerHTML = `
    ${state.me.must_change_password ? `
      <div class="banner" role="status">
        Пароль был сброшен администратором. Установите новый пароль.
      </div>` : ""}
    <div class="page-head">
      <div>
        <h2>Личный кабинет</h2>
        <p class="muted">Аккаунт ${esc(state.me.login)}</p>
      </div>
      <div><button class="ghost" id="refresh">Обновить</button></div>
    </div>
    <div id="subscription-area"><p class="muted">Загрузка…</p></div>
    ${downloadsSection()}
    ${plansSection()}
    ${state.me.referral ? referralSection(state.me) : ""}
    <h3 class="section-title">Аккаунт</h3>
    <div class="card cabinet-card">
      <div class="card-head">
        <div>
          <strong>Смена пароля</strong>
          <p class="muted">После смены пароля остальные устройства выйдут из аккаунта.</p>
        </div>
      </div>
      <form id="password-form" class="form">
        <label>Текущий пароль
          <input name="current_password" type="password" autocomplete="current-password" required>
        </label>
        <div class="form-row">
          <label>Новый пароль
            <input name="new_password" type="password" autocomplete="new-password" required minlength="8" maxlength="128">
          </label>
          <label>Повторите пароль
            <input name="repeat_password" type="password" autocomplete="new-password" required minlength="8" maxlength="128">
          </label>
        </div>
        <p id="password-error" class="error" role="alert"></p>
        <div class="form-actions">
          <button type="submit" class="primary">Сменить пароль</button>
        </div>
      </form>
    </div>`;

  $("#refresh").addEventListener("click", () => loadSubscription(true));

  document.querySelectorAll(".plans-grid [data-plan]").forEach((button) => {
    button.addEventListener("click", () => showBuyNotice(Number(button.dataset.plan)));
  });

  if (state.me.referral) {
    $("#copy-referral").addEventListener("click", () => copyText(state.me.referral.url));
    $("#referral-url").addEventListener("focus", (event) => event.target.select());
  }

  $("#password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    $("#password-error").textContent = "";
    if (form.new_password.value !== form.repeat_password.value) {
      $("#password-error").textContent = "Пароли не совпадают";
      return;
    }
    try {
      await api("/api/account/password", {
        method: "POST",
        body: JSON.stringify({
          current_password: form.current_password.value,
          new_password: form.new_password.value,
        }),
      });
      form.reset();
      state.me.must_change_password = false;
      document.querySelector(".banner")?.remove();
      toast("Пароль обновлён");
    } catch (error) {
      $("#password-error").textContent = error.message;
    }
  });

  loadSubscription();
  loadDownloads();
}

async function loadSubscription(showSpinner = false) {
  const area = $("#subscription-area");
  if (!area) return;
  if (showSpinner) area.innerHTML = `<p class="muted">Загрузка…</p>`;
  let data;
  try {
    data = await api("/api/account/subscription");
  } catch (error) {
    if ($("#subscription-area")) area.innerHTML = `<p class="error">${esc(error.message)}</p>`;
    return;
  }
  if (!$("#subscription-area")) return;
  area.innerHTML = data.subscription
    ? subscriptionCard(data.subscription, data.devices)
    : emptyCard();

  if (data.subscription) {
    $("#copy-link").addEventListener("click", () => copyText(data.subscription.url));
    $("#subscription-url").addEventListener("focus", (event) => event.target.select());
  }
}

function plansSection() {
  const cards = PLANS.map((plan, index) => `
    <div class="plan-card">
      <div class="plan-name">${esc(plan.name)}</div>
      <div class="plan-price">${fmtMoney(plan.price)}<span class="muted"> / 30 дней</span></div>
      <div class="muted small-note">${pluralDevices(plan.devices)}</div>
      <button type="button" class="primary plan-buy" data-plan="${index}">Купить</button>
    </div>`).join("");
  return `
    <h3 class="section-title">Тарифы</h3>
    <div class="plans-grid">${cards}</div>
    <div class="buy-notice hidden" id="buy-notice" role="status"></div>`;
}

function showBuyNotice(index) {
  const plan = PLANS[index];
  const notice = $("#buy-notice");
  if (!plan || !notice) return;
  notice.innerHTML = `Онлайн-оплата пока не подключена. Напишите в Telegram <a href="${TELEGRAM_URL}" target="_blank" rel="noopener">@BeHukD</a>: оформим подписку «${esc(plan.name)}» за ${fmtMoney(plan.price)} и учтём бонусный баланс и скидку.`;
  notice.classList.remove("hidden");
  notice.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function referralSection(me) {
  const referral = me.referral;
  return `
    <h3 class="section-title">Приглашения</h3>
    <div class="card cabinet-card referral-card">
      <div class="card-head">
        <div>
          <strong>Пригласите друга</strong>
          <p class="muted">За каждого друга вы получаете 25 ₽ на баланс, а друг — 25 ₽ скидки на первый месяц.</p>
        </div>
      </div>
      <label class="subscription-link">Ваша ссылка
        <div class="secret">
          <input id="referral-url" readonly value="${esc(referral.url)}">
          <button type="button" class="ghost" id="copy-referral">Копировать</button>
        </div>
      </label>
      <div class="referral-stats">
        <div><span class="muted">Приглашено</span><strong>${Number(referral.invited) || 0}</strong></div>
        <div><span class="muted">Заработано</span><strong>${fmtMoney(referral.earned_kopecks)}</strong></div>
        <div><span class="muted">Баланс</span><strong>${fmtMoney(me.balance_kopecks)}</strong></div>
        ${me.discount_kopecks > 0 ? `<div><span class="muted">Скидка на первый месяц</span><strong>${fmtMoney(me.discount_kopecks)}</strong></div>` : ""}
      </div>
      <p class="muted small-note">Баланс и скидка сохранятся и будут учтены при оформлении подписки.</p>
    </div>`;
}

function subscriptionCard(subscription, devices) {
  const slots = `${subscription.device_count} из ${subscription.max_devices}`;
  return `
    <div class="card subscription-card">
      <div class="subscription-main">
        <div>
          <div class="card-kicker">Подписка</div>
          <div class="subscription-status">Активна</div>
          <div class="subscription-meta">
            <div><span class="muted">Действует до</span> ${fmtDate(subscription.expires_at)}</div>
            <div><span class="muted">Осталось</span> ${daysLabel(subscription.days_left)}</div>
            <div><span class="muted">Устройства</span> ${slots}</div>
          </div>
        </div>
        <img class="qr" src="${esc(subscription.qr_data_uri)}" alt="QR-код ссылки-подписки" width="180" height="180">
      </div>
      <label class="subscription-link">Ссылка-подписка
        <div class="secret">
          <input id="subscription-url" readonly value="${esc(subscription.url)}">
          <button type="button" class="ghost" id="copy-link">Копировать</button>
        </div>
      </label>
      <p class="muted small-note">Добавьте ссылку в приложение ViPN. Она действует до окончания срока подписки.</p>
    </div>
    <h3 class="section-title">Устройства</h3>
    ${devicesTable(devices, subscription.max_devices)}`;
}

function devicesTable(devices, maxDevices) {
  if (!devices.length) {
    return `<div class="card empty-card">
      <strong>Устройств пока нет</strong>
      <p class="muted">Откройте ссылку-подписку в приложении ViPN, и устройство появится здесь.</p>
    </div>`;
  }
  const rows = devices.map((device) => `
    <tr>
      <td><strong>${esc(device.name)}</strong></td>
      <td class="mono">${esc(device.address)}</td>
      <td>${device.online ? `<span class="badge active">онлайн</span>` : `<span class="badge">офлайн</span>`}</td>
      <td>${fmtBytes(device.rx_total)} / ${fmtBytes(device.tx_total)}</td>
      <td>${fmtDate(device.last_handshake)}</td>
    </tr>`).join("");
  return `<div class="table-wrap"><table>
    <thead><tr><th>Устройство</th><th>Адрес</th><th>Статус</th><th>Принято / отправлено</th><th>Последнее подключение</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <p class="muted small-note">Занято ${devices.length} из ${maxDevices} слотов.</p>`;
}

function emptyCard() {
  return `<div class="card empty-card">
    <strong>Подписка не активна</strong>
    <p class="muted">Оформите её в Telegram: <a href="${TELEGRAM_URL}" target="_blank" rel="noopener">@BeHukD</a>. Ссылка и устройства появятся здесь после выдачи.</p>
  </div>`;
}

saveRefFromUrl();
setMode("login");
boot();
