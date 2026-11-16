/**
 * Helpers de cookies y localStorage.
 */
import { CLAVES } from './config.js';

/**
 * Guarda una cookie.
 * @param {string} nombre
 * @param {string} valor
 * @param {number} [dias=30] Días de vigencia; negativo la borra.
 */
export function setCookie(nombre, valor, dias = 30) {
  const expira = new Date(Date.now() + dias * 864e5).toUTCString();
  document.cookie = `${encodeURIComponent(nombre)}=${encodeURIComponent(valor)}; expires=${expira}; path=/; SameSite=Lax`;
}

/**
 * Lee una cookie.
 * @param {string} nombre
 * @returns {string|null}
 */
export function getCookie(nombre) {
  const prefijo = `${encodeURIComponent(nombre)}=`;
  const par = document.cookie.split('; ').find((c) => c.startsWith(prefijo));
  return par ? decodeURIComponent(par.slice(prefijo.length)) : null;
}

/**
 * Borra una cookie.
 * @param {string} nombre
 */
export function deleteCookie(nombre) {
  setCookie(nombre, '', -1);
}

/**
 * Guarda datos como JSON en localStorage.
 * @param {*} datos
 * @param {string} [clave=CLAVES.borradorAviso]
 * @returns {boolean} false si el almacenamiento no está disponible o está lleno.
 */
export function saveDraft(datos, clave = CLAVES.borradorAviso) {
  try {
    localStorage.setItem(clave, JSON.stringify(datos));
    return true;
  } catch {
    return false;
  }
}

/**
 * Lee datos JSON de localStorage.
 * @param {string} [clave=CLAVES.borradorAviso]
 * @returns {*|null} null si no existe o está corrupto.
 */
export function loadDraft(clave = CLAVES.borradorAviso) {
  try {
    const valor = localStorage.getItem(clave);
    return valor === null ? null : JSON.parse(valor);
  } catch {
    return null;
  }
}

/**
 * Elimina una clave de localStorage.
 * @param {string} [clave=CLAVES.borradorAviso]
 */
export function clearDraft(clave = CLAVES.borradorAviso) {
  try {
    localStorage.removeItem(clave);
  } catch {
    // Sin almacenamiento disponible: nada que borrar.
  }
}
