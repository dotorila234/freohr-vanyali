// ==========================================================================
// Lógica de la aplicación: navegación entre vistas, formularios y render.
// ==========================================================================

import {
  auth, registerAccount, login, logout, watchAuthState, getUserProfile,
  createCharacter, updateCharacter, deleteCharacter, getCharacter, listAllCharacters
} from "./db.js";

// -------------------- Esquema de la ficha --------------------
// Para añadir/quitar/renombrar apartados, toca solo este array.

const SECTIONS = [
  {
    key: "general", title: "General",
    fields: [
      { key: "edad", label: "Edad", type: "text" },
      { key: "raza", label: "Raza", type: "text" },
      { key: "genero", label: "Género", type: "text" },
      { key: "ubicacion", label: "Ubicación inicial", type: "text" }
    ]
  },
  {
    key: "apariencia", title: "Apariencia",
    fields: [
      { key: "descripcionGeneral", label: "Descripción general", type: "textarea" },
      { key: "fisico", label: "Físico", type: "textarea" },
      { key: "cicatrices", label: "Cicatrices notables", type: "textarea", optional: true },
      { key: "tatuajes", label: "Tatuajes", type: "textarea", optional: true },
      { key: "atuendo", label: "Atuendo / Armadura / Armas / Utensilios", type: "textarea" }
    ]
  },
  {
    key: "personalidad", title: "Personalidad",
    fields: [
      { key: "personalidad", label: "Personalidad", type: "textarea" },
      { key: "faccion", label: "Alianzas / Facción", type: "text", hint: 'Pon "Neutral" si no aplica' },
      { key: "trabajo", label: "Trabajo", type: "text" },
      { key: "alineamiento", label: "Alineamiento", type: "text", hint: "Orientativo, no afecta a ninguna mecánica" },
      { key: "gustos", label: "Gustos", type: "textarea" },
      { key: "disgustos", label: "Disgustos", type: "textarea" }
    ]
  },
  {
    key: "conocimientos", title: "Conocimientos",
    fields: [
      { key: "idiomas", label: "Idiomas", type: "textarea", hint: "N/A si no aplica" },
      { key: "tipoMagia", label: "Tipo de magia", type: "text", hint: "Élfica, hechicería, dracónida... N/A si no tiene" },
      { key: "habilidades", label: "Habilidades / Competencias", type: "textarea" },
      { key: "otraInfo", label: "Otra info importante", type: "textarea", optional: true, hint: "Hobbies, talentos, etc." }
    ]
  },
  {
    key: "fortalezasDebilidades", title: "Fortalezas y Debilidades",
    fields: [
      { key: "fortalezas", label: "Fortalezas", type: "textarea" },
      { key: "debilidades", label: "Debilidades", type: "textarea" }
    ]
  },
  {
    key: "objetivos", title: "Objetivos y motivaciones",
    fields: [
      { key: "cortoPlazo", label: "Corto plazo", type: "textarea" },
      { key: "largoPlazo", label: "Largo plazo", type: "textarea" }
    ]
  },
  {
    key: "trasfondo", title: "Trasfondo",
    fields: [
      { key: "lore", label: "Lore", type: "textarea", big: true, hint: "Mínimo dos párrafos, sin límite superior" },
      { key: "curiosidades", label: "Curiosidades", type: "textarea", optional: true }
    ]
  }
];

// -------------------- Estado global --------------------

const state = {
  user: null,
  profile: null,
  view: "auth",
  charId: null,
  authMode: "login",
  authError: ""
};

const mainEl = document.getElementById("app-main");
const topbarEl = document.getElementById("topbar-who");

// -------------------- Utilidades --------------------

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function nl2p(text) {
  if (!text) return "";
  return escapeHtml(text).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function parseRelaciones(raw) {
  if (!raw) return [];
  return raw.split("\n").map(l => l.trim()).filter(Boolean).map(line => {
    const [nombre, relacion, ...rest] = line.split("|").map(s => s.trim());
    return { nombre: nombre || "", relacion: relacion || "", contexto: rest.join("|").trim() || "" };
  });
}

function estadoBadge(estado) {
  const map = {
    pendiente: ["Pendiente", "badge-pendiente"],
    aprobada: ["Aprobada", "badge-aprobada"],
    rechazada: ["Rechazada", "badge-rechazada"]
  };
  const [label, cls] = map[estado] || map.pendiente;
  return `<span class="badge-estado ${cls}">${label}</span>`;
}

function relacionesToTextarea(list) {
  if (!list || !list.length) return "";
  return list.map(r => `${r.nombre} | ${r.relacion} | ${r.contexto}`).join("\n");
}

function goto(view, params = {}) {
  state.view = view;
  state.charId = params.charId ?? null;
  state.authMode = params.authMode ?? state.authMode;
  state.authError = "";
  render();
}

// -------------------- Render: topbar --------------------

function renderTopbar() {
  if (!state.user || !state.profile) {
    topbarEl.innerHTML = "";
    return;
  }
  topbarEl.innerHTML = `
    <span>${escapeHtml(state.profile.username)}</span>
    ${state.profile.role === "gm" ? '<span class="badge-gm">GM</span>' : ""}
    <a href="#" id="nav-dashboard" class="btn secondary" style="padding:.4em .9em;">Fichas</a>
    <button id="btn-logout" class="secondary">Cerrar sesión</button>
  `;
  document.getElementById("nav-dashboard").onclick = (e) => { e.preventDefault(); goto("dashboard"); };
  document.getElementById("btn-logout").onclick = async () => { await logout(); };
}

// -------------------- Render: auth --------------------

function renderAuth() {
  const isLogin = state.authMode === "login";
  mainEl.innerHTML = `
    <div class="auth-wrap">
      <div class="page">
        <h1 style="font-family: var(--font-display); font-size:1.4rem; color: var(--gold);">Freohr Vanyalí</h1>
        <div class="auth-tabs">
          <button class="tab ${isLogin ? "active" : ""}" id="tab-login">Entrar</button>
          <button class="tab ${!isLogin ? "active" : ""}" id="tab-register">Crear cuenta</button>
        </div>
        ${isLogin ? renderLoginForm() : renderRegisterForm()}
        ${state.authError ? `<div class="error-msg">${escapeHtml(state.authError)}</div>` : ""}
      </div>
    </div>
  `;
  document.getElementById("tab-login").onclick = () => goto("auth", { authMode: "login" });
  document.getElementById("tab-register").onclick = () => goto("auth", { authMode: "register" });

  if (isLogin) {
    document.getElementById("form-login").onsubmit = async (e) => {
      e.preventDefault();
      const username = document.getElementById("login-user").value.trim();
      const pass = document.getElementById("login-pass").value;
      try {
        await login(username, pass);
      } catch (err) {
        state.authError = "Usuario o contraseña incorrectos.";
        render();
      }
    };
  } else {
    document.getElementById("form-register").onsubmit = async (e) => {
      e.preventDefault();
      const username = document.getElementById("reg-user").value.trim();
      const pass = document.getElementById("reg-pass").value;
      const pass2 = document.getElementById("reg-pass2").value;
      if (username.length < 2) {
        state.authError = "Pon un nombre de usuario."; render(); return;
      }
      if (pass.length < 6) {
        state.authError = "La contraseña debe tener al menos 6 caracteres."; render(); return;
      }
      if (pass !== pass2) {
        state.authError = "Las contraseñas no coinciden."; render(); return;
      }
      try {
        await registerAccount(username, pass);
      } catch (err) {
        state.authError = err.message === "username-taken"
          ? "Ese nombre de usuario ya está en uso."
          : "No se pudo crear la cuenta. Inténtalo de nuevo.";
        render();
      }
    };
  }
}

function renderLoginForm() {
  return `
    <form id="form-login">
      <div class="field"><label for="login-user">Usuario</label>
        <input type="text" id="login-user" required autocomplete="username"></div>
      <div class="field"><label for="login-pass">Contraseña</label>
        <input type="password" id="login-pass" required autocomplete="current-password"></div>
      <button type="submit">Entrar</button>
    </form>
  `;
}

function renderRegisterForm() {
  return `
    <form id="form-register">
      <div class="field"><label for="reg-user">Nombre de usuario</label>
        <input type="text" id="reg-user" required autocomplete="username"></div>
      <div class="field"><label for="reg-pass">Contraseña (mín. 6 caracteres)</label>
        <input type="password" id="reg-pass" required minlength="6" autocomplete="new-password"></div>
      <div class="field"><label for="reg-pass2">Repite la contraseña</label>
        <input type="password" id="reg-pass2" required minlength="6" autocomplete="new-password"></div>
      <button type="submit">Crear cuenta</button>
    </form>
  `;
}

// -------------------- Render: dashboard --------------------

async function renderDashboard() {
  mainEl.innerHTML = `<p class="empty-note">Cargando fichas...</p>`;
  const all = await listAllCharacters();
  const isGM = state.profile.role === "gm";
  const mine = all.filter(c => c.ownerId === state.user.uid);
  const others = all.filter(c => c.ownerId !== state.user.uid);
  const approvedOthers = others.filter(c => c.estado === "aprobada");
  const pending = isGM ? all.filter(c => c.estado === "pendiente") : [];

  mainEl.innerHTML = `
    ${isGM ? `
      <div class="section-title"><h2>Solicitudes pendientes</h2></div>
      ${pending.length ? `<div class="card-grid">${pending.map(c => charCard(c, c.ownerId === state.user.uid)).join("")}</div>`
                       : `<p class="empty-note">No hay solicitudes pendientes.</p>`}
      <div class="divider"><span class="mark">◆</span></div>
    ` : ""}

    <div class="section-title">
      <h2>Tus fichas</h2>
      <button id="btn-new">+ Nueva ficha</button>
    </div>
    ${mine.length ? `<div class="card-grid">${mine.map(c => charCard(c, true)).join("")}</div>`
                  : `<p class="empty-note">Aún no tienes ninguna ficha. Crea la primera.</p>`}

    <div class="divider"><span class="mark">◆</span></div>

    <h2>Fichas del grupo</h2>
    ${approvedOthers.length ? `<div class="card-grid">${approvedOthers.map(c => charCard(c, false)).join("")}</div>`
                    : `<p class="empty-note">Ninguna ficha aprobada todavía.</p>`}
  `;

  document.getElementById("btn-new").onclick = () => goto("edit", { charId: null });
  mainEl.querySelectorAll("[data-open]").forEach(elm => {
    elm.onclick = (e) => { e.preventDefault(); goto("view", { charId: elm.dataset.open }); };
  });
}

function charCard(c, mine) {
  return `
    <a href="#" class="char-card" data-open="${c.id}">
      <div class="section-title"><h3>${escapeHtml(c.nombre || "Sin nombre")}</h3>${estadoBadge(c.estado)}</div>
      <div class="meta">${escapeHtml(c.ownerUsername || "")}${mine ? " (tú)" : ""} · ${escapeHtml(c.general?.raza || "")}</div>
      ${c.frase ? `<div class="quote">“${escapeHtml(c.frase)}”</div>` : ""}
    </a>
  `;
}

// -------------------- Render: ficha (lectura) --------------------

async function renderView() {
  mainEl.innerHTML = `<p class="empty-note">Cargando...</p>`;
  const char = await getCharacter(state.charId);
  if (!char) { mainEl.innerHTML = `<p class="empty-note">Esa ficha ya no existe.</p>`; return; }

  const isGM = state.profile.role === "gm";
  const canEdit = char.ownerId === state.user.uid || isGM;

  mainEl.innerHTML = `
    <div class="page">
      <div class="owner-strip">
        <span>${escapeHtml(char.ownerUsername || "")} ${estadoBadge(char.estado)}</span>
        <a href="#" id="back-dash">&larr; Volver a fichas</a>
      </div>

      <div class="sheet-header">
        ${char.imagenPortada ? `<img class="portrait" src="${escapeHtml(char.imagenPortada)}" alt="Retrato de ${escapeHtml(char.nombre)}">` : ""}
        <h1>${escapeHtml(char.nombre || "Sin nombre")}</h1>
        ${char.frase ? `<div class="quote">“${escapeHtml(char.frase)}”</div>` : ""}
      </div>

      ${SECTIONS.map(section => renderSectionRead(char, section)).join("")}
      ${renderRelacionesRead(char.relaciones)}

      <div class="btn-row">
        ${isGM ? `
          <button id="btn-aprobar" class="secondary">Aprobar</button>
          <button id="btn-rechazar" class="secondary">Rechazar</button>
        ` : ""}
        ${canEdit ? `
          <button id="btn-edit">Editar ficha</button>
          <button id="btn-del" class="danger">Eliminar ficha</button>
        ` : ""}
      </div>
    </div>
  `;

  document.getElementById("back-dash").onclick = (e) => { e.preventDefault(); goto("dashboard"); };
  if (canEdit) {
    document.getElementById("btn-edit").onclick = () => goto("edit", { charId: char.id });
    document.getElementById("btn-del").onclick = async () => {
      if (confirm(`¿Seguro que quieres eliminar la ficha de ${char.nombre}? Esto no se puede deshacer.`)) {
        await deleteCharacter(char.id);
        toast("Ficha eliminada.");
        goto("dashboard");
      }
    };
  }
  if (isGM) {
    document.getElementById("btn-aprobar").onclick = async () => {
      await updateCharacter(char.id, { estado: "aprobada" });
      toast("Ficha aprobada.");
      goto("view", { charId: char.id });
    };
    document.getElementById("btn-rechazar").onclick = async () => {
      await updateCharacter(char.id, { estado: "rechazada" });
      toast("Ficha rechazada.");
      goto("view", { charId: char.id });
    };
  }
}

function renderSectionRead(char, section) {
  const data = char[section.key] || {};
  const visibleFields = section.fields.filter(f => data[f.key]);
  if (!visibleFields.length) return "";

  return `
    <div class="sheet-section">
      <div class="divider"><span class="mark">◆</span></div>
      <h2>${section.title}</h2>
      <dl class="kv">
        ${visibleFields.filter(f => f.type !== "textarea" || !f.big).map(f => `
          <dt>${f.label}</dt>
          <dd>${f.type === "url"
              ? `<a href="${escapeHtml(data[f.key])}" target="_blank" rel="noopener">ver imagen</a>`
              : (f.type === "textarea" ? nl2p(data[f.key]) : escapeHtml(data[f.key]))}</dd>
        `).join("")}
      </dl>
      ${visibleFields.filter(f => f.big).map(f => `<div>${nl2p(data[f.key])}</div>`).join("")}
    </div>
  `;
}

function renderRelacionesRead(relaciones) {
  if (!relaciones || !relaciones.length) return "";
  return `
    <div class="sheet-section">
      <div class="divider"><span class="mark">◆</span></div>
      <h2>Relaciones clave</h2>
      ${relaciones.map(r => `
        <div class="relation-item">
          <span class="rel-name">${escapeHtml(r.nombre)}</span>
          ${r.relacion ? ` — <span class="rel-type">${escapeHtml(r.relacion)}</span>` : ""}
          ${r.contexto ? `<div>${escapeHtml(r.contexto)}</div>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

// -------------------- Render: formulario (crear/editar) --------------------

async function renderEdit() {
  let char = null;
  if (state.charId) {
    mainEl.innerHTML = `<p class="empty-note">Cargando...</p>`;
    char = await getCharacter(state.charId);
    if (!char) { mainEl.innerHTML = `<p class="empty-note">Esa ficha ya no existe.</p>`; return; }
    const canEdit = char.ownerId === state.user.uid || state.profile.role === "gm";
    if (!canEdit) { mainEl.innerHTML = `<p class="empty-note">No tienes permiso para editar esta ficha.</p>`; return; }
  }

  mainEl.innerHTML = `
    <div class="page">
      <h2>${char ? "Editar ficha" : "Nueva ficha"}</h2>
      <form id="char-form">
        <fieldset>
          <legend>Portada</legend>
          <div class="field"><label for="f-nombre">Nombre del PJ</label>
            <input type="text" id="f-nombre" required value="${escapeHtml(char?.nombre)}"></div>
          <div class="field"><label for="f-frase">Frase del PJ</label>
            <input type="text" id="f-frase" value="${escapeHtml(char?.frase)}"></div>
          <div class="field"><label for="f-portada">Imagen del PJ (URL)</label>
            <input type="url" id="f-portada" value="${escapeHtml(char?.imagenPortada)}" placeholder="https://...">
            <span class="hint">Pega el link a una imagen ya subida (Discord, Imgur, Drive público...)</span></div>
        </fieldset>

        ${SECTIONS.map(s => renderSectionForm(char, s)).join("")}

        <fieldset>
          <legend>Relaciones clave</legend>
          <div class="field">
            <label for="f-relaciones">Una relación por línea</label>
            <textarea id="f-relaciones" rows="4" placeholder="Nombre | tipo de relación | contexto breve">${escapeHtml(relacionesToTextarea(char?.relaciones))}</textarea>
            <span class="hint">Formato: Nombre | Relación | Contexto</span>
          </div>
        </fieldset>

        <div class="btn-row">
          <button type="submit">${char ? "Guardar cambios" : "Crear ficha"}</button>
          <button type="button" id="btn-cancel" class="secondary">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById("btn-cancel").onclick = () => goto(char ? "view" : "dashboard", { charId: char?.id });

  document.getElementById("char-form").onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      nombre: document.getElementById("f-nombre").value.trim(),
      frase: document.getElementById("f-frase").value.trim(),
      imagenPortada: document.getElementById("f-portada").value.trim(),
      relaciones: parseRelaciones(document.getElementById("f-relaciones").value)
    };
    SECTIONS.forEach(section => {
      payload[section.key] = {};
      section.fields.forEach(f => {
        payload[section.key][f.key] = document.getElementById(`f-${section.key}-${f.key}`).value.trim();
      });
    });

    try {
      if (char) {
        if (state.profile.role !== "gm") payload.estado = "pendiente";
        await updateCharacter(char.id, payload);
        toast("Cambios guardados.");
        goto("view", { charId: char.id });
      } else {
        payload.estado = "pendiente";
        const newId = await createCharacter(state.user.uid, state.profile.username, payload);
        toast("Ficha creada, pendiente de aprobación.");
        goto("view", { charId: newId });
      }
    } catch (err) {
      alert("Algo falló guardando la ficha. Revisa la consola (F12) y prueba otra vez.");
      console.error(err);
    }
  };
}

function renderSectionForm(char, section) {
  const data = (char && char[section.key]) || {};
  return `
    <fieldset>
      <legend>${section.title}</legend>
      ${section.fields.map(f => `
        <div class="field">
          <label for="f-${section.key}-${f.key}">${f.label}${f.optional ? " (opcional)" : ""}</label>
          ${f.type === "textarea"
            ? `<textarea id="f-${section.key}-${f.key}" rows="${f.big ? 8 : 3}">${escapeHtml(data[f.key])}</textarea>`
            : `<input type="${f.type === "url" ? "url" : "text"}" id="f-${section.key}-${f.key}" value="${escapeHtml(data[f.key])}">`}
          ${f.hint ? `<span class="hint">${f.hint}</span>` : ""}
        </div>
      `).join("")}
    </fieldset>
  `;
}

// -------------------- Router principal --------------------

async function render() {
  renderTopbar();
  if (!state.user) { renderAuth(); return; }
  if (state.view === "dashboard" || state.view === "auth") { await renderDashboard(); return; }
  if (state.view === "view") { await renderView(); return; }
  if (state.view === "edit") { await renderEdit(); return; }
}

// -------------------- Arranque --------------------

watchAuthState(async (user) => {
  state.user = user;
  if (user) {
    state.profile = await getUserProfile(user.uid);
    state.view = "dashboard";
  } else {
    state.profile = null;
    state.view = "auth";
  }
  render();
});
