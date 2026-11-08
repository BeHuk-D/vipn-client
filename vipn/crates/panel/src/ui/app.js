const state = {
  tab: "keys",
  keyId: null,
  userId: null,
  me: null,
  servers: [],
  monitorServer: null,
  speedtestResult: null,
};

const $ = (selector, root = document) => root.querySelector(selector);
const view = () => $("#view");

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

const moneyFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function fmtMoney(kopecks) {
  return `${moneyFormat.format((Number(kopecks) || 0) / 100)} ₽`;
}

function keyStatus(key) {
  if (key.revoked_at) return ["revoked", "отозван"];
  const now = Date.now() / 1000;
  if (now >= key.expires_at) return ["expired", "истёк"];
  if (now < key.starts_at) return ["", "ожидает"];
  return ["active", "активен"];
}

function badge([cls, label]) {
  return `<span class="badge ${cls}">${label}</span>`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    ...options,
  });
  if (response.status === 401) {
    showLogin();
    throw new Error("Требуется авторизация");
  }
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) throw new Error(data?.error || `Ошибка ${response.status}`);
  return data;
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"), 2400);
}

function openModal(title, bodyHtml) {
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = bodyHtml;
  $("#modal").classList.remove("hidden");
}

function closeModal() {
  $("#modal").classList.add("hidden");
  $("#modal-body").innerHTML = "";
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

function showLogin() {
  $("#login-screen").classList.remove("hidden");
  $("#app-screen").classList.add("hidden");
}

function showApp() {
  $("#login-screen").classList.add("hidden");
  $("#app-screen").classList.remove("hidden");
  renderTabs();
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  $("#login-error").textContent = "";
  try {
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ email: form.email.value, password: form.password.value }),
    });
    await boot();
  } catch (error) {
    $("#login-error").textContent = error.message;
  }
});

$("#logout").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" }).catch(() => {});
  showLogin();
});

$("#modal-close").addEventListener("click", closeModal);
$("#modal").addEventListener("click", (event) => {
  if (event.target === $("#modal")) closeModal();
});

/* ---------- navigation ---------- */

const TABS = [
  ["keys", "Доступ"],
  ["users", "Пользователи"],
  ["monitor", "Мониторинг"],
  ["servers", "Серверы"],
  ["audit", "Журнал"],
];

let monitorTimer = null;

function renderTabs() {
  $("#tabs").innerHTML = TABS.map(([id, label]) =>
    `<button data-tab="${id}" class="${state.tab === id ? "active" : ""}">${label}</button>`
  ).join("");
  $("#tabs").querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      state.keyId = null;
      state.userId = null;
      renderTabs();
      render();
    });
  });
}

async function render() {
  clearInterval(monitorTimer);
  if (state.tab === "keys") {
    if (state.keyId) return renderKeyDetail(state.keyId);
    return renderKeys();
  }
  if (state.tab === "users") {
    if (state.userId) return renderUserDetail(state.userId);
    return renderUsers();
  }
  if (state.tab === "monitor") return renderMonitor();
  if (state.tab === "servers") return renderServers();
  return renderAudit();
}

/* ---------- keys ---------- */

function pageHead(title, subtitle, actionHtml = "") {
  return `
    <div class="page-head">
      <div>
        <h2>${esc(title)}</h2>
        <p class="muted">${esc(subtitle)}</p>
      </div>
      <div>${actionHtml}</div>
    </div>`;
}

async function renderKeys() {
  view().innerHTML = `<p class="muted">Загрузка…</p>`;
  const [keys, stats, servers] = await Promise.all([
    api("/api/keys"),
    api("/api/stats"),
    api("/api/servers"),
  ]);
  state.servers = servers;

  const statsHtml = `
    <div class="stats">
      <div class="stat"><div class="value">${stats.active_keys}</div><div class="label">Активных доступов</div></div>
      <div class="stat"><div class="value">${stats.total_keys}</div><div class="label">Всего выдано</div></div>
      <div class="stat"><div class="value">${stats.devices}</div><div class="label">Устройств</div></div>
      <div class="stat"><div class="value">${stats.servers}</div><div class="label">Серверов</div></div>
    </div>`;

  const rows = keys.map((key) => `
    <tr class="clickable" data-id="${esc(key.id)}">
      <td><strong>${esc(key.label)}</strong>${key.email ? `<div class="muted mono">${esc(key.email)}</div>` : ""}</td>
      <td>${esc(key.server_name)}</td>
      <td>${fmtDate(key.expires_at)}</td>
      <td>${key.device_count} / ${key.max_devices}</td>
      <td>${badge(keyStatus(key))}</td>
    </tr>`).join("");

  const table = keys.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Доступ</th><th>Сервер</th><th>Действует до</th><th>Устройства</th><th>Статус</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`
    : `<div class="table-wrap"><div class="empty">Доступов пока нет. Создайте первый.</div></div>`;

  view().innerHTML = statsHtml + pageHead("Доступы", "Выдача VPN-доступа с ограничением по времени",
    `<button class="primary" id="new-key">Новый доступ</button>`) + table;

  $("#new-key").addEventListener("click", openCreateKey);
  view().querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", () => {
      state.keyId = row.dataset.id;
      render();
    });
  });
}

function openCreateKey() {
  if (!state.servers.length) {
    openModal("Новый доступ", `<p class="note">Сначала добавьте сервер на вкладке «Серверы».</p>`);
    return;
  }
  const options = state.servers
    .filter((server) => server.enabled)
    .map((server) => `<option value="${esc(server.id)}">${esc(server.name)}</option>`)
    .join("");

  openModal("Новый доступ", `
    <form class="form" id="create-key-form">
      <label>Сервер<select name="server_id" required>${options}</select></label>
      <label>Название<input name="label" required placeholder="Например, Иван — 30 дней"></label>
      <label>Email клиента (необязательно)<input name="email" type="email" placeholder="client@example.com"></label>
      <div class="form-row">
        <label>Срок
          <select name="duration_hours">
            <option value="24">1 день</option>
            <option value="168" selected>7 дней</option>
            <option value="720">30 дней</option>
            <option value="2160">90 дней</option>
            <option value="8760">1 год</option>
          </select>
        </label>
        <label>Устройств<select name="max_devices">
          <option value="1" selected>1</option><option value="2">2</option>
          <option value="3">3</option><option value="5">5</option><option value="10">10</option>
        </select></label>
      </div>
      <label>Заметка<input name="note" placeholder="необязательно"></label>
      <div class="form-actions">
        <button type="button" class="ghost" id="cancel-key">Отмена</button>
        <button type="submit" class="primary">Выдать доступ</button>
      </div>
    </form>`);

  $("#cancel-key").addEventListener("click", closeModal);
  $("#create-key-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    try {
      const key = await api("/api/keys", {
        method: "POST",
        body: JSON.stringify({
          server_id: form.server_id.value,
          label: form.label.value,
          email: form.email.value || null,
          note: form.note.value || null,
          duration_hours: Number(form.duration_hours.value),
          max_devices: Number(form.max_devices.value),
        }),
      });
      closeModal();
      state.keyId = key.id;
      state.tab = "keys";
      toast("Доступ выдан");
      render();
      showSubscription(key.subscription_url, key.max_devices);
    } catch (error) {
      toast(error.message);
    }
  });
}

async function renderKeyDetail(id) {
  view().innerHTML = `<p class="muted">Загрузка…</p>`;
  let data;
  try {
    data = await api(`/api/keys/${id}`);
  } catch {
    state.keyId = null;
    return renderKeys();
  }
  const { key, devices } = data;

  const deviceRows = devices.map((device) => `
    <tr>
      <td>
        <strong>${esc(device.name)}</strong>
        ${deviceInfoLine(device.device_info) ? `<div class="muted">${esc(deviceInfoLine(device.device_info))}</div>` : ""}
        ${device.hwid ? `<div class="muted mono">fp ${esc(device.hwid)}…</div>` : ""}
      </td>
      <td class="mono">${esc(device.address)}</td>
      <td class="mono">${fmtRate(device.rx_rate)}</td>
      <td class="mono">${fmtRate(device.tx_rate)}</td>
      <td class="mono">${fmtBytes(device.rx_total)}</td>
      <td class="mono">${fmtBytes(device.tx_total)}</td>
      <td class="actions">
        <input class="limit-input" type="number" min="1" max="10000" step="1"
               value="${Number(device.speed_limit_mbit) || 20}" data-device="${esc(device.id)}">
        <button class="ghost small" data-save="${esc(device.id)}">Мбит</button>
      </td>
      <td>${device.revoked_at
            ? badge(["revoked", "отозван"])
            : (device.online ? badge(["active", "онлайн"]) : badge(["expired", "офлайн"]))}</td>
      <td class="actions">
        ${device.revoked_at ? "" : (device.has_hwid
          ? `<button class="ghost small" data-unbind="${esc(device.id)}">Отвязать</button>`
          : `<button class="ghost small" data-rotate="${esc(device.id)}">Сменить ссылку</button>
             <button class="ghost small" data-revoke="${esc(device.id)}">Отозвать</button>`)}
      </td>
    </tr>`).join("");

  const slotsFull = Number(key.device_count) >= Number(key.max_devices);

  const devicesTable = devices.length
    ? `<div class="table-wrap"><table>
        <thead><tr>
          <th>Устройство</th><th>Адрес</th>
          <th>↓ сейчас</th><th>↑ сейчас</th><th>↓ всего</th><th>↑ всего</th>
          <th>Лимит</th><th>Статус</th><th></th>
        </tr></thead>
        <tbody>${deviceRows}</tbody></table></div>`
    : `<div class="table-wrap"><div class="empty">Устройств пока нет. Передайте ссылку-подписку — устройство привяжется при первом подключении.</div></div>`;

  view().innerHTML = `
    <div class="page-head">
      <div>
        <p class="muted mono" style="margin:0 0 6px">
          <a href="#" id="back" style="color:inherit">← Все доступы</a>
        </p>
        <h2>${esc(key.label)}</h2>
        <p class="muted">${esc(key.server_name)} · до ${fmtDate(key.expires_at)} · ${badge(keyStatus(key))}</p>
      </div>
      <div>
        <button class="ghost" id="show-link">Ссылка-подписка</button>
        <button class="ghost" id="extend">Продлить на 7 дней</button>
        ${key.revoked_at ? "" : `<button class="ghost" id="revoke-key">Отозвать доступ</button>`}
      </div>
    </div>
    ${key.email ? `<p class="muted">Email: <span class="mono">${esc(key.email)}</span></p>` : ""}
    ${key.note ? `<p class="muted">Заметка: ${esc(key.note)}</p>` : ""}
    <p class="muted">Одна ссылка на всю подписку: при подключении устройства привязываются
      автоматически по отпечатку, пока не заняты все слоты.</p>
    <div style="display:flex; gap:8px; align-items:center; margin:10px 0 14px; flex-wrap:wrap">
      <span class="muted">Слотов: ${key.device_count} / ${key.max_devices}</span>
      <input id="max-devices" class="limit-input" type="number" min="1" max="10"
             value="${key.max_devices}">
      <button class="ghost small" id="save-max">Сохранить лимит</button>
      ${slotsFull ? `<span class="badge expired">слоты заняты</span>` : ""}
    </div>
    ${devicesTable}`;

  $("#back").addEventListener("click", (event) => {
    event.preventDefault();
    state.keyId = null;
    render();
  });

  $("#extend").addEventListener("click", async () => {
    try {
      await api(`/api/keys/${id}`, { method: "PATCH", body: JSON.stringify({ extend_hours: 168 }) });
      toast("Срок продлён");
      renderKeyDetail(id);
    } catch (error) { toast(error.message); }
  });

  const revokeButton = $("#revoke-key");
  if (revokeButton) {
    revokeButton.addEventListener("click", async () => {
      if (!confirm("Отозвать весь доступ? Все устройства перестанут работать.")) return;
      try {
        await api(`/api/keys/${id}`, { method: "PATCH", body: JSON.stringify({ revoke: true }) });
        toast("Доступ отозван");
        renderKeyDetail(id);
      } catch (error) { toast(error.message); }
    });
  }

  $("#show-link").addEventListener("click", () => showSubscription(key.subscription_url, key.max_devices));

  $("#save-max").addEventListener("click", async () => {
    const value = Number($("#max-devices").value);
    if (!Number.isInteger(value) || value < 1 || value > 10) return toast("Лимит устройств: от 1 до 10");
    try {
      await api(`/api/keys/${id}`, { method: "PATCH", body: JSON.stringify({ max_devices: value }) });
      toast(`Лимит устройств: ${value}`);
      renderKeyDetail(id);
    } catch (error) { toast(error.message); }
  });

  view().querySelectorAll("[data-rotate]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Сменить ссылку? Старая перестанет работать.")) return;
      try {
        const result = await api(`/api/devices/${button.dataset.rotate}/rotate`, { method: "POST" });
        showSubscription(result.subscription_url);
      } catch (error) { toast(error.message); }
    });
  });

  view().querySelectorAll("[data-unbind]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Отвязать устройство? Слот освободится, текущий клиент перестанет подключаться.")) return;
      try {
        await api(`/api/devices/${button.dataset.unbind}/unbind`, { method: "POST" });
        toast("Устройство отвязано");
        renderKeyDetail(id);
      } catch (error) { toast(error.message); }
    });
  });

  view().querySelectorAll("[data-revoke]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Отозвать устройство?")) return;
      try {
        await api(`/api/devices/${button.dataset.revoke}/revoke`, { method: "POST" });
        toast("Устройство отозвано");
        renderKeyDetail(id);
      } catch (error) { toast(error.message); }
    });
  });

  view().querySelectorAll("[data-save]").forEach((button) => {
    button.addEventListener("click", async () => {
      const input = view().querySelector(`input[data-device="${button.dataset.save}"]`);
      const limit = Number(input?.value);
      if (!Number.isFinite(limit) || limit < 1) return toast("Лимит должен быть больше нуля");
      try {
        await api(`/api/devices/${button.dataset.save}`, {
          method: "PATCH",
          body: JSON.stringify({ speed_limit_mbit: limit }),
        });
        toast(`Лимит: ${limit} Мбит/с`);
      } catch (error) { toast(error.message); }
    });
  });
}

function deviceInfoLine(info) {
  if (!info || typeof info !== "object") return "";
  return [info.platform, info.model, info.os, info.arch].filter(Boolean).join(" · ");
}

function showSubscription(url, maxDevices) {
  const slotsNote = maxDevices
    ? ` К подписке можно привязать до ${maxDevices} ${maxDevices === 1 ? "устройства" : "устройств"}.`
    : "";
  openModal("Ссылка-подписка", `
    <p class="note">Одна ссылка на всю подписку. Устройство привязывается автоматически при первом
    подключении по отпечатку клиента.${slotsNote} Чтобы освободить слот, нажмите «Отвязать» у устройства.</p>
    <div class="secret" style="margin-top:14px">
      <input readonly value="${esc(url)}" id="sub-url">
      <button class="primary" id="copy-sub">Копировать</button>
    </div>`);
  $("#copy-sub").addEventListener("click", () => copyText(url));
  $("#sub-url").addEventListener("focus", (event) => event.target.select());
}

/* ---------- users ---------- */

function subscriptionBadge(sub) {
  if (!sub) return badge(["revoked", "нет"]);
  if (sub.status === "active") return badge(["active", "активна"]);
  if (sub.status === "expired") return badge(["expired", "истекла"]);
  return badge(["", "ожидает"]);
}

async function renderUsers() {
  view().innerHTML = `<p class="muted">Загрузка…</p>`;
  let users;
  try {
    users = await api("/api/users");
  } catch (error) {
    view().innerHTML = `<p class="error">${esc(error.message)}</p>`;
    return;
  }

  const rows = users.map((user) => {
    const sub = user.subscription;
    return `
      <tr class="clickable" data-id="${esc(user.id)}" data-login="${esc(user.login)}">
        <td><strong>${esc(user.login)}</strong></td>
        <td>${fmtDate(user.created_at)}</td>
        <td>${fmtDate(user.last_login_at)}</td>
        <td>${sub
          ? `${fmtDate(sub.expires_at)}<div class="muted">${sub.device_count} / ${sub.max_devices} устройств</div>`
          : `<span class="muted">—</span>`}</td>
        <td>${subscriptionBadge(sub)}</td>
        <td>${fmtMoney(user.balance_kopecks)}${user.invited_count
          ? `<div class="muted">${user.invited_count} приглашено</div>`
          : ""}</td>
        <td>${user.active ? badge(["active", "активен"]) : badge(["revoked", "заблокирован"])}</td>
      </tr>`;
  }).join("");

  const table = users.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Логин</th><th>Регистрация</th><th>Последний вход</th>
          <th>Подписка до</th><th>Подписка</th><th>Баланс</th><th>Аккаунт</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
    : `<div class="table-wrap"><div class="empty">Пользователей пока нет.</div></div>`;

  view().innerHTML = pageHead(
    "Пользователи",
    `${users.length} зарегистрировано · пробный доступ на 2 дня выдаётся при регистрации`,
    `<input id="user-search" class="search-input" type="search" placeholder="Поиск по логину">`
  ) + table;

  $("#user-search").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    view().querySelectorAll("tbody tr[data-login]").forEach((row) => {
      row.classList.toggle("hidden", !row.dataset.login.includes(query));
    });
  });

  view().querySelectorAll("tr[data-id]").forEach((row) => {
    row.addEventListener("click", () => {
      state.userId = row.dataset.id;
      render();
    });
  });
}

async function renderUserDetail(id) {
  view().innerHTML = `<p class="muted">Загрузка…</p>`;
  let data;
  try {
    data = await api(`/api/users/${id}`);
  } catch {
    state.userId = null;
    return renderUsers();
  }
  const { user, keys, devices } = data;
  const activeKey = keys.find((key) => !key.revoked_at);

  const keyRows = keys.length
    ? keys.map((key) => `
        <tr class="clickable" data-key="${esc(key.id)}">
          <td>${esc(key.label)}</td>
          <td>${esc(key.server_name)}</td>
          <td>${fmtDate(key.expires_at)}</td>
          <td>${key.device_count} / ${key.max_devices}</td>
          <td>${badge(keyStatus(key))}</td>
        </tr>`).join("")
    : "";

  const keysTable = keys.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Доступ</th><th>Сервер</th><th>Действует до</th><th>Устройства</th><th>Статус</th></tr></thead>
        <tbody>${keyRows}</tbody></table></div>`
    : `<div class="table-wrap"><div class="empty">Подписки пока нет.</div></div>`;

  const deviceRows = devices.length
    ? devices.map((device) => `
        <tr>
          <td><strong>${esc(device.name)}</strong></td>
          <td class="mono">${esc(device.address)}</td>
          <td>${device.revoked_at
                ? badge(["revoked", "отозвано"])
                : (device.online ? badge(["active", "онлайн"]) : badge(["expired", "офлайн"]))}</td>
          <td class="mono">${fmtBytes(device.rx_total)}</td>
          <td class="mono">${fmtBytes(device.tx_total)}</td>
          <td>${fmtDate(device.last_handshake)}</td>
        </tr>`).join("")
    : "";

  const devicesTable = devices.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Устройство</th><th>Адрес</th><th>Статус</th><th>↓ всего</th><th>↑ всего</th><th>Подключение</th></tr></thead>
        <tbody>${deviceRows}</tbody></table></div>`
    : `<div class="table-wrap"><div class="empty">Устройств пока нет.</div></div>`;

  view().innerHTML = `
    <div class="page-head">
      <div>
        <p class="muted mono" style="margin:0 0 6px">
          <a href="#" id="back-users" style="color:inherit">← Все пользователи</a>
        </p>
        <h2>${esc(user.login)}</h2>
        <p class="muted">Зарегистрирован ${fmtDate(user.created_at)} ·
          последний вход ${fmtDate(user.last_login_at)} ·
          ${user.active ? badge(["active", "активен"]) : badge(["revoked", "заблокирован"])}</p>
      </div>
      <div>
        <button class="ghost" id="reset-password">Сбросить пароль</button>
        <button class="ghost" id="grant">${activeKey ? "Продлить подписку" : "Выдать подписку"}</button>
        <button class="ghost" id="toggle-active">${user.active ? "Заблокировать" : "Разблокировать"}</button>
      </div>
    </div>
    ${referralPanel(user)}
    <h3 class="section-title">Подписки</h3>
    ${keysTable}
    <h3 class="section-title">Устройства</h3>
    ${devicesTable}`;

  $("#back-users").addEventListener("click", (event) => {
    event.preventDefault();
    state.userId = null;
    render();
  });

  view().querySelectorAll("tr[data-key]").forEach((row) => {
    row.addEventListener("click", () => {
      state.tab = "keys";
      state.keyId = row.dataset.key;
      renderTabs();
      render();
    });
  });

  $("#toggle-active").addEventListener("click", async () => {
    const verb = user.active ? "Заблокировать" : "Разблокировать";
    if (!confirm(`${verb} пользователя ${user.login}?`)) return;
    try {
      await api(`/api/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !user.active }),
      });
      toast(user.active ? "Пользователь заблокирован" : "Пользователь разблокирован");
      renderUserDetail(id);
    } catch (error) { toast(error.message); }
  });

  $("#reset-password").addEventListener("click", async () => {
    if (!confirm(`Сбросить пароль пользователя ${user.login}? Все его сессии завершатся.`)) return;
    try {
      const result = await api(`/api/users/${id}/password-reset`, { method: "POST" });
      openModal("Временный пароль", `
        <p class="note">Передайте пароль пользователю. Он показывается один раз,
          при следующем входе потребуется его сменить.</p>
        <div class="secret" style="margin-top:14px">
          <input readonly value="${esc(result.password)}" id="temp-password">
          <button class="primary" id="copy-password">Копировать</button>
        </div>`);
      $("#copy-password").addEventListener("click", () => copyText(result.password));
      $("#temp-password").addEventListener("focus", (event) => event.target.select());
    } catch (error) { toast(error.message); }
  });

  $("#grant").addEventListener("click", () => openGrantSubscription(id, user.login, activeKey));

  if (user.referral?.url) {
    $("#copy-referral").addEventListener("click", () => copyText(user.referral.url));
    $("#referral-link").addEventListener("focus", (event) => event.target.select());
  }
  $("#credit-balance").addEventListener("click", () => openBalanceAdjust(id, user.login, 1));
  $("#debit-balance").addEventListener("click", () => openBalanceAdjust(id, user.login, -1));
}

function referralPanel(user) {
  const referral = user.referral || {};
  const invited = referral.invited || [];
  const rows = invited.map((item) => `
    <tr>
      <td><strong>${esc(item.login)}</strong></td>
      <td>${fmtDate(item.created_at)}</td>
      <td>${item.status === "credited"
        ? badge(["active", "начислено"])
        : badge(["expired", "совпадение IP"])}</td>
      <td>${fmtMoney(item.inviter_kopecks)}</td>
      <td class="mono">${esc(item.ip || "—")}</td>
    </tr>`).join("");
  const invitedTable = invited.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Логин</th><th>Регистрация</th><th>Статус</th><th>Начислено</th><th>IP</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
    : `<div class="table-wrap"><div class="empty">Приглашённых пока нет.</div></div>`;
  const credited = invited.filter((item) => item.status === "credited").length;

  return `
    <h3 class="section-title">Рефералы</h3>
    <div class="card cabinet-card">
      <div class="referral-stats">
        <div><span class="muted">Баланс</span><strong>${fmtMoney(user.balance_kopecks)}</strong></div>
        <div><span class="muted">Скидка</span><strong>${fmtMoney(user.discount_kopecks)}</strong></div>
        <div><span class="muted">Начислено за друзей</span><strong>${fmtMoney(referral.earned_kopecks)}</strong></div>
        <div><span class="muted">Приглашено</span><strong>${credited}</strong></div>
      </div>
      ${referral.url ? `
        <label class="subscription-link">Ссылка
          <div class="secret">
            <input id="referral-link" readonly value="${esc(referral.url)}">
            <button type="button" class="ghost" id="copy-referral">Копировать</button>
          </div>
        </label>` : ""}
      <p class="muted mono" style="margin:0;font-size:13px">
        Код: ${esc(referral.code || "—")} · IP регистрации: ${esc(referral.signup_ip || "—")} ·
        Пригласил: ${referral.referred_by ? esc(referral.referred_by.login) : "—"}
      </p>
      <div class="form-actions">
        <button class="ghost" id="credit-balance">Начислить</button>
        <button class="ghost" id="debit-balance">Списать</button>
      </div>
    </div>
    ${invitedTable}`;
}

function openBalanceAdjust(id, login, sign) {
  const action = sign > 0 ? "Начислить" : "Списать";
  openModal(`${action} средства`, `
    <form class="form" id="balance-form">
      <p class="note">${esc(login)}: баланс ${action === "Начислить" ? "увеличится" : "уменьшится"} на указанную сумму.</p>
      <label>Сумма, ₽
        <input name="amount" type="number" min="1" max="100000" step="1" required>
      </label>
      <label>Комментарий
        <input name="comment" maxlength="200" placeholder="Например: компенсация за сбой">
      </label>
      <div class="form-actions">
        <button type="button" class="ghost" id="cancel-balance">Отмена</button>
        <button type="submit" class="primary">${action}</button>
      </div>
    </form>`);

  $("#cancel-balance").addEventListener("click", closeModal);
  $("#balance-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const amount = Math.round(Number(form.amount.value));
    if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
      return toast("Сумма должна быть от 1 до 100 000 рублей");
    }
    try {
      await api(`/api/users/${id}/balance`, {
        method: "POST",
        body: JSON.stringify({ delta_rub: sign * amount, comment: form.comment.value.trim() }),
      });
      closeModal();
      toast("Баланс обновлён");
      renderUserDetail(id);
    } catch (error) { toast(error.message); }
  });
}

async function openGrantSubscription(id, login, activeKey) {
  let servers = [];
  if (!activeKey) {
    try {
      servers = (await api("/api/servers")).filter((server) => server.enabled);
    } catch (error) {
      return toast(error.message);
    }
    if (!servers.length) {
      openModal("Подписка", `<p class="note">Сначала добавьте сервер на вкладке «Серверы».</p>`);
      return;
    }
  }

  const serverField = activeKey ? "" : `
    <label>Сервер<select name="server_id" required>
      ${servers.map((server) => `<option value="${esc(server.id)}">${esc(server.name)}</option>`).join("")}
    </select></label>`;

  openModal(activeKey ? `Продлить подписку ${login}` : `Выдать подписку ${login}`, `
    <form class="form" id="grant-form">
      ${serverField}
      <div class="form-row">
        <label>Срок
          <select name="duration_hours">
            <option value="24">1 день</option>
            <option value="72">3 дня</option>
            <option value="168">7 дней</option>
            <option value="720" selected>30 дней</option>
            <option value="2160">90 дней</option>
            <option value="8760">1 год</option>
          </select>
        </label>
        <label>Устройств<select name="max_devices">
          ${[1, 2, 3, 5, 10].map((value) =>
            `<option value="${value}" ${value === (activeKey?.max_devices ?? 1) ? "selected" : ""}>${value}</option>`
          ).join("")}
        </select></label>
      </div>
      ${activeKey ? `<p class="note">Новый срок отсчитывается от текущей даты окончания, если она ещё не прошла.</p>` : ""}
      <div class="form-actions">
        <button type="button" class="ghost" id="cancel-grant">Отмена</button>
        <button type="submit" class="primary">${activeKey ? "Продлить" : "Выдать"}</button>
      </div>
    </form>`);

  $("#cancel-grant").addEventListener("click", closeModal);
  $("#grant-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    try {
      await api(`/api/users/${id}/subscription`, {
        method: "POST",
        body: JSON.stringify({
          server_id: activeKey ? null : form.server_id.value,
          duration_hours: Number(form.duration_hours.value),
          max_devices: Number(form.max_devices.value),
        }),
      });
      closeModal();
      toast(activeKey ? "Подписка продлена" : "Подписка выдана");
      renderUserDetail(id);
    } catch (error) { toast(error.message); }
  });
}

/* ---------- monitor ---------- */

function fmtBytes(bytes) {
  const value = Number(bytes) || 0;
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  let index = 0;
  let number = value;
  while (number >= 1024 && index < units.length - 1) {
    number /= 1024;
    index += 1;
  }
  return `${number.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function fmtKiB(kb) {
  return fmtBytes((Number(kb) || 0) * 1024);
}

function fmtRate(bytesPerSecond) {
  const mbit = (Number(bytesPerSecond) || 0) * 8 / 1e6;
  return `${mbit.toFixed(mbit >= 10 ? 0 : 2)} Мбит/с`;
}

function drawChart(canvas, lines) {
  if (!canvas || !lines.length) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 320;
  const height = canvas.clientHeight || 90;
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const length = lines[0].values.length;
  const max = Math.max(1, ...lines.flatMap((line) => line.values));
  const padding = 4;

  lines.forEach((line) => {
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = line.color;
    line.values.forEach((value, index) => {
      const x = length <= 1 ? padding : (index / (length - 1)) * (width - padding * 2) + padding;
      const y = height - padding - (value / max) * (height - padding * 2);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
}

async function renderMonitor() {
  clearInterval(monitorTimer);

  const servers = await api("/api/servers");
  state.servers = servers;
  const selected = state.monitorServer && servers.some((server) => server.id === state.monitorServer)
    ? state.monitorServer
    : (servers.find((server) => server.enabled)?.id || servers[0]?.id || "");
  state.monitorServer = selected;

  const [history, allDevices] = await Promise.all([
    api(`/api/metrics?limit=120${selected ? `&server_id=${encodeURIComponent(selected)}` : ""}`),
    api("/api/devices"),
  ]);
  const devices = selected ? allDevices.filter((device) => device.server_id === selected) : allDevices;

  const latest = history.length ? history[history.length - 1] : null;
  const online = devices.filter((device) => device.online && !device.revoked_at).length;
  const memPercent = latest ? (latest.mem_used / Math.max(1, latest.mem_total)) * 100 : 0;
  const diskPercent = latest ? (latest.disk_used / Math.max(1, latest.disk_total)) * 100 : 0;

  const rows = devices.map((device) => `
    <tr>
      <td><strong>${esc(device.name)}</strong><div class="muted mono">${esc(device.address)}</div></td>
      <td>${esc(device.key_label)}</td>
      <td>${device.revoked_at
            ? badge(["revoked", "отозван"])
            : (device.online ? badge(["active", "онлайн"]) : badge(["expired", "офлайн"]))}</td>
      <td class="mono">${fmtRate(device.rx_rate)}</td>
      <td class="mono">${fmtRate(device.tx_rate)}</td>
      <td class="mono">${fmtBytes(device.rx_total)}</td>
      <td class="mono">${fmtBytes(device.tx_total)}</td>
      <td class="actions">
        <input class="limit-input" type="number" min="1" max="10000" step="1"
               value="${Number(device.speed_limit_mbit) || 20}" data-device="${esc(device.id)}">
        <button class="ghost small" data-save="${esc(device.id)}">Мбит</button>
      </td>
    </tr>`).join("");

  const devicesTable = devices.length
    ? `<div class="table-wrap"><table>
        <thead><tr>
          <th>Устройство</th><th>Доступ</th><th>Статус</th>
          <th>↓ сейчас</th><th>↑ сейчас</th><th>↓ всего</th><th>↑ всего</th><th>Лимит</th>
        </tr></thead>
        <tbody>${rows}</tbody></table></div>`
    : `<div class="table-wrap"><div class="empty">Устройств пока нет.</div></div>`;

  view().innerHTML = `
    <div class="page-head">
      <div>
        <h2>Мониторинг</h2>
        <p class="muted">Ресурсы сервера и трафик по устройствам</p>
      </div>
      <div>
        ${servers.length > 1 ? `<select id="monitor-server">
          ${servers.map((server) => `<option value="${esc(server.id)}"${server.id === selected ? " selected" : ""}>${esc(server.name)}${server.enabled ? "" : " (выключен)"}</option>`).join("")}
        </select>` : ""}
        <button class="primary" id="speedtest">Тест скорости канала</button>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><div class="value">${latest ? latest.cpu.toFixed(0) + "%" : "—"}</div><div class="label">CPU</div></div>
      <div class="stat"><div class="value">${latest ? fmtKiB(latest.mem_used) : "—"}</div><div class="label">RAM из ${latest ? fmtKiB(latest.mem_total) : "—"} (${latest ? memPercent.toFixed(0) : 0}%)</div></div>
      <div class="stat"><div class="value">${latest ? fmtKiB(latest.disk_used) : "—"}</div><div class="label">Диск из ${latest ? fmtKiB(latest.disk_total) : "—"} (${latest ? diskPercent.toFixed(0) : 0}%)</div></div>
      <div class="stat"><div class="value">${latest ? latest.load1.toFixed(2) : "—"}</div><div class="label">Load average</div></div>
      <div class="stat"><div class="value">${latest ? fmtRate(latest.rx_rate) : "—"}</div><div class="label">Сеть ↓ сейчас</div></div>
      <div class="stat"><div class="value">${latest ? fmtRate(latest.tx_rate) : "—"}</div><div class="label">Сеть ↑ сейчас</div></div>
      <div class="stat"><div class="value" id="speedtest-result">${state.speedtestResult ? state.speedtestResult + " Мбит/с" : "—"}</div><div class="label">Тест канала</div></div>
      <div class="stat"><div class="value">${online} / ${devices.length}</div><div class="label">Устройств онлайн</div></div>
    </div>

    <div class="charts">
      <div class="chart">
        <div class="chart-label">CPU, %</div>
        <canvas id="cpu-chart"></canvas>
      </div>
      <div class="chart">
        <div class="chart-label">Сеть, Мбит/с — <span class="muted">↓ приём</span> / <span class="muted">— отдача</span></div>
        <canvas id="net-chart"></canvas>
      </div>
    </div>

    ${devicesTable}`;

  drawChart($("#cpu-chart"), [{
    color: "#ffffff",
    values: history.map((point) => point.cpu),
  }]);
  drawChart($("#net-chart"), [
    { color: "#ffffff", values: history.map((point) => point.rx_rate * 8 / 1e6) },
    { color: "#71717a", values: history.map((point) => point.tx_rate * 8 / 1e6) },
  ]);

  $("#monitor-server")?.addEventListener("change", (event) => {
    state.monitorServer = event.target.value;
    renderMonitor();
  });

  $("#speedtest").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Измеряем…";
    try {
      const result = await api("/api/speedtest", { method: "POST" });
      state.speedtestResult = result.mbit;
      $("#speedtest-result").textContent = `${result.mbit} Мбит/с`;
      toast(`Скорость канала: ${result.mbit} Мбит/с`);
    } catch (error) {
      toast(error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Тест скорости канала";
    }
  });

  view().querySelectorAll("[data-save]").forEach((button) => {
    button.addEventListener("click", async () => {
      const input = view().querySelector(`input[data-device="${button.dataset.save}"]`);
      const limit = Number(input?.value);
      if (!Number.isFinite(limit) || limit < 1) return toast("Лимит должен быть больше нуля");
      try {
        await api(`/api/devices/${button.dataset.save}`, {
          method: "PATCH",
          body: JSON.stringify({ speed_limit_mbit: limit }),
        });
        toast(`Лимит: ${limit} Мбит/с`);
      } catch (error) { toast(error.message); }
    });
  });

  monitorTimer = setInterval(() => {
    if (state.tab !== "monitor") return;
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "SELECT")) return;
    renderMonitor();
  }, 5000);
}

/* ---------- servers ---------- */

async function renderServers() {
  view().innerHTML = `<p class="muted">Загрузка…</p>`;
  const servers = await api("/api/servers");
  state.servers = servers;

  const rows = servers.map((server) => `
    <tr>
      <td><strong>${esc(server.name)}</strong><div class="muted mono">${esc(server.interface)}</div></td>
      <td class="mono">${esc(server.host)}:${server.endpoint_port}</td>
      <td class="mono">${esc(server.country || "—")}</td>
      <td class="mono">${server.default_speed_limit_mbit ?? "—"}</td>
      <td class="mono">${esc(server.network_cidr)}</td>
      <td>${server.peers}</td>
      <td>${server.enabled ? badge(["active", "включён"]) : badge(["expired", "выключен"])}</td>
      <td class="actions">
        <button class="ghost small" data-toggle="${esc(server.id)}" data-enabled="${server.enabled ? 1 : 0}">
          ${server.enabled ? "Выключить" : "Включить"}
        </button>
        <button class="ghost small" data-params="${esc(server.id)}" data-value="${esc(server.country || "")}" data-speed="${server.default_speed_limit_mbit ?? ""}">Параметры</button>
        <button class="ghost small" data-agent-token="${esc(server.id)}">Токен агента</button>
      </td>
    </tr>`).join("");

  const table = servers.length
    ? `<div class="table-wrap"><table>
        <thead><tr><th>Сервер</th><th>Точка входа</th><th>Страна</th><th>Лимит</th><th>Подсеть</th><th>Пиры</th><th>Статус</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
    : `<div class="table-wrap"><div class="empty">Серверов пока нет.</div></div>`;

  view().innerHTML = pageHead("Серверы", "AmneziaWG-интерфейсы, к которым подключаются клиенты",
    `<button class="primary" id="new-server">Добавить сервер</button>`) + table;

  $("#new-server").addEventListener("click", openCreateServer);
  view().querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await api(`/api/servers/${button.dataset.toggle}`, {
          method: "PATCH",
          body: JSON.stringify({ enabled: button.dataset.enabled !== "1" }),
        });
        renderServers();
      } catch (error) { toast(error.message); }
    });
  });
  view().querySelectorAll("[data-params]").forEach((button) => {
    button.addEventListener("click", () =>
      openEditServer(button.dataset.params, button.dataset.value, button.dataset.speed));
  });
  view().querySelectorAll("[data-agent-token]").forEach((button) => {
    button.addEventListener("click", () => openRotateAgentToken(button.dataset.agentToken));
  });
}

function openEditServer(serverId, currentCountry, currentSpeed) {
  openModal("Параметры сервера", `
    <form class="form" id="server-params-form">
      <label>Код страны (ISO 3166-1, две буквы)
        <input name="country" maxlength="2" value="${esc(currentCountry)}" placeholder="NL" required>
      </label>
      <label>Лимит по умолчанию, Мбит/с
        <input name="speed" type="number" min="1" max="10000" value="${esc(currentSpeed)}" placeholder="как глобальный">
      </label>
      <p class="muted">Страна показывается клиенту на карточке подписки. Лимит действует на устройства без своего лимита; пустое поле — общий лимит.</p>
      <div class="form-actions">
        <button type="button" class="ghost" id="cancel-server-params">Отмена</button>
        <button type="submit" class="primary">Сохранить</button>
      </div>
    </form>`);

  $("#cancel-server-params").addEventListener("click", closeModal);
  $("#server-params-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const speed = form.speed.value.trim();
    try {
      await api(`/api/servers/${serverId}`, {
        method: "PATCH",
        body: JSON.stringify({
          country: form.country.value,
          default_speed_limit_mbit: speed === "" ? null : Number(speed),
        }),
      });
      closeModal();
      renderServers();
    } catch (error) { toast(error.message); }
  });
}

function openRotateAgentToken(serverId) {
  openModal("Токен агента", `
    <p class="note">Новый токен заменит текущий: старый агент сразу перестанет получать состояние.
    После выпуска обновите <span class="mono">VIPN_AGENT_TOKEN</span> в env-файле агента и
    перезапустите службу.</p>
    <div class="form-actions" style="margin-top:16px">
      <button type="button" class="ghost" id="cancel-rotate">Отмена</button>
      <button type="button" class="primary" id="confirm-rotate">Выпустить новый</button>
    </div>`);
  $("#cancel-rotate").addEventListener("click", closeModal);
  $("#confirm-rotate").addEventListener("click", async () => {
    try {
      const result = await api(`/api/servers/${serverId}/agent-token`, { method: "POST" });
      openModal("Токен агента", `
        <p class="note">Сохраните токен — он показывается один раз. Обновите
        <span class="mono">VIPN_AGENT_TOKEN</span> в env-файле агента и перезапустите службу.</p>
        <div class="secret" style="margin-top:14px">
          <input readonly value="${esc(result.agent_token)}" id="agent-token">
          <button class="primary" id="copy-token">Копировать</button>
        </div>`);
      $("#copy-token").addEventListener("click", () => copyText(result.agent_token));
    } catch (error) { toast(error.message); }
  });
}

function openCreateServer() {
  openModal("Новый сервер", `
    <form class="form" id="create-server-form">
      <label>Название<input name="name" required placeholder="Amsterdam-1"></label>
      <div class="form-row">
        <label>Хост<input name="host" required placeholder="vpn.example.com"></label>
        <label>Порт<input name="endpoint_port" type="number" value="51820" required></label>
      </div>
      <div class="form-row">
        <label>Интерфейс<input name="interface" value="awg1" required></label>
        <label>ListenPort<input name="listen_port" type="number" value="51820" required></label>
      </div>
      <label>Публичный ключ сервера<input name="server_public_key" required placeholder="из awg pubkey"></label>
      <div class="form-row">
        <label>Страна (ISO)<input name="country" value="RU" maxlength="2" placeholder="RU"></label>
        <label>DNS<input name="dns" value="10.66.66.1" required></label>
      </div>
      <label>Лимит по умолчанию, Мбит/с
        <input name="default_speed_limit_mbit" type="number" min="1" max="10000" placeholder="как глобальный">
      </label>
      <label>Подсеть<input name="network_cidr" value="10.66.66.0/24" required></label>
      <label>Параметры AmneziaWG (JSON)
        <textarea name="awg_params" rows="8">{
  "Jc": 4, "Jmin": 40, "Jmax": 70,
  "S1": 30, "S2": 40, "S3": 50, "S4": 60,
  "H1": 1, "H2": 2, "H3": 3, "H4": 4
}</textarea>
      </label>
      <div class="form-actions">
        <button type="button" class="ghost" id="cancel-server">Отмена</button>
        <button type="submit" class="primary">Добавить</button>
      </div>
    </form>`);

  $("#cancel-server").addEventListener("click", closeModal);
  $("#create-server-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    let awgParams;
    try { awgParams = JSON.parse(form.awg_params.value); }
    catch { return toast("Некорректный JSON параметров"); }
    try {
      const result = await api("/api/servers", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.value,
          host: form.host.value,
          endpoint_port: Number(form.endpoint_port.value),
          interface: form.interface.value,
          listen_port: Number(form.listen_port.value),
          server_public_key: form.server_public_key.value,
          network_cidr: form.network_cidr.value,
          dns: form.dns.value,
          country: form.country.value,
          default_speed_limit_mbit: form.default_speed_limit_mbit.value.trim() === ""
            ? null
            : Number(form.default_speed_limit_mbit.value),
          awg_params: awgParams,
        }),
      });
      renderServers();
      openModal("Токен агента", `
        <p class="note">Сохраните токен — он показывается один раз и нужен для настройки агента
        на сервере.</p>
        <div class="secret" style="margin-top:14px">
          <input readonly value="${esc(result.agent_token)}" id="agent-token">
          <button class="primary" id="copy-token">Копировать</button>
        </div>`);
      $("#copy-token").addEventListener("click", () => copyText(result.agent_token));
    } catch (error) {
      toast(error.message);
    }
  });
}

/* ---------- audit ---------- */

async function renderAudit() {
  view().innerHTML = `<p class="muted">Загрузка…</p>`;
  const entries = await api("/api/audit");
  const rows = entries.map((entry) => `
    <tr>
      <td>${fmtDate(entry.ts)}</td>
      <td>${esc(entry.actor)}</td>
      <td class="mono">${esc(entry.action)}</td>
      <td class="mono muted">${esc(entry.target_type)}:${esc(entry.target_id).slice(0, 8)}</td>
    </tr>`).join("");

  view().innerHTML = pageHead("Журнал", "Последние действия администраторов") +
    (entries.length
      ? `<div class="table-wrap"><table>
          <thead><tr><th>Время</th><th>Кто</th><th>Действие</th><th>Объект</th></tr></thead>
          <tbody>${rows}</tbody></table></div>`
      : `<div class="table-wrap"><div class="empty">Записей пока нет.</div></div>`);
}

/* ---------- boot ---------- */

async function boot() {
  try {
    state.me = await api("/api/me");
    $("#user-email").textContent = state.me.email;
    showApp();
    await render();
  } catch {
    showLogin();
  }
}

boot();
