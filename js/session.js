/**
 * Sesión simulada en sessionStorage (Entrega 1).
 * Forma: sessionStorage['sesion'] = {id, nombre, correo, rol}, rol: 'usuario' | 'admin'.
 */
import { CLAVES } from './config.js';

const ROLES = ['usuario', 'admin'];

/**
 * Devuelve la sesión actual.
 * @returns {{id: number, nombre: string, correo: string, rol: string}|null}
 */
export function getSession() {
  try {
    const sesion = JSON.parse(sessionStorage.getItem(CLAVES.sesion));
    return sesion && ROLES.includes(sesion.rol) ? sesion : null;
  } catch {
    return null;
  }
}

/**
 * Inicia sesión con los datos de un usuario ya autenticado.
 * @param {{id: number, nombre: string, correo: string, rol: string}} usuario
 */
export function login({ id, nombre, correo, rol }) {
  if (!ROLES.includes(rol)) throw new Error(`Rol inválido: ${rol}`);
  sessionStorage.setItem(CLAVES.sesion, JSON.stringify({ id, nombre, correo, rol }));
  sessionStorage.removeItem(CLAVES.csrf);
  getCsrfToken();
}

/** Cierra la sesión y descarta el token CSRF. */
export function logout() {
  sessionStorage.removeItem(CLAVES.sesion);
  sessionStorage.removeItem(CLAVES.csrf);
}

/**
 * Exige sesión; si no hay, redirige a login.html?volver=<página actual>.
 * auth.js debe aceptar `volver` solo si es una página local (sin "//" ni ":").
 * @returns {object|null} La sesión, o null si se redirigió.
 */
export function requireLogin() {
  const sesion = getSession();
  if (!sesion) {
    const actual = location.pathname.split('/').pop() + location.search;
    location.replace(`login.html?volver=${encodeURIComponent(actual)}`);
    return null;
  }
  return sesion;
}

/**
 * Exige sesión con un rol; si el rol no coincide, redirige a index.html.
 * @param {'usuario'|'admin'} rol
 * @returns {object|null} La sesión, o null si se redirigió.
 */
export function requireRole(rol) {
  const sesion = requireLogin();
  if (sesion && sesion.rol !== rol) {
    location.replace('index.html');
    return null;
  }
  return sesion;
}

/**
 * Token CSRF de la sesión; lo crea si no existe.
 * Los formularios lo incluyen en un input oculto `csrf_token` y api.js en el header X-CSRF-Token.
 * @returns {string}
 */
export function getCsrfToken() {
  let token = sessionStorage.getItem(CLAVES.csrf);
  if (!token) {
    token = crypto.randomUUID();
    sessionStorage.setItem(CLAVES.csrf, token);
  }
  return token;
}

/**
 * Ajusta el header según la sesión. Marcado esperado en cada página:
 *   [data-sesion="invitado"]  visible solo sin sesión (Entrar, Registrarse)
 *   [data-sesion="activa"]    visible con cualquier sesión
 *   [data-rol="admin"]        visible solo para ese rol
 *   [data-nombre-usuario]     recibe el nombre (textContent)
 *   [data-logout]             botón que cierra sesión
 * @param {ParentNode} [raiz=document]
 */
export function renderHeader(raiz = document) {
  const sesion = getSession();
  raiz.querySelectorAll('[data-sesion="invitado"]').forEach((el) => { el.hidden = Boolean(sesion); });
  raiz.querySelectorAll('[data-sesion="activa"]').forEach((el) => { el.hidden = !sesion; });
  raiz.querySelectorAll('[data-rol]').forEach((el) => { el.hidden = !sesion || sesion.rol !== el.dataset.rol; });
  raiz.querySelectorAll('[data-nombre-usuario]').forEach((el) => { el.textContent = sesion ? sesion.nombre : ''; });
  raiz.querySelectorAll('[data-logout]').forEach((el) => {
    el.addEventListener('click', () => {
      logout();
      location.href = 'index.html';
    });
  });
}
