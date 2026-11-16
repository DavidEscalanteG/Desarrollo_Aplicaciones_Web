/**
 * Único punto de acceso a datos. Las páginas nunca llaman fetch directo.
 *
 *   api.get('categorias')            -> lista
 *   api.get('encontrados', 3)        -> un registro
 *   api.post('avisos', body)         -> registro creado (con id)
 *   api.put('avisos', id, body)      -> registro actualizado
 *   api.delete('avisos', id)         -> null
 *
 * Errores: lanzan ApiError con `status` (0 = sin conexión, 404 = no existe, etc.).
 */
import { MODO_MOCK, BASE_URL, EXTENSION } from './config.js';
import { getCsrfToken } from './session.js';

/** Error de la capa de datos con código HTTP. */
export class ApiError extends Error {
  /**
   * @param {string} mensaje
   * @param {number} status
   */
  constructor(mensaje, status) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * fetch con manejo de errores uniforme.
 * @param {string} url
 * @param {RequestInit} [opciones]
 * @returns {Promise<*>}
 */
async function pedir(url, opciones = {}) {
  let resp;
  try {
    resp = await fetch(url, opciones);
  } catch {
    throw new ApiError('No se pudo conectar con el servidor', 0);
  }
  if (!resp.ok) throw new ApiError(`Error ${resp.status} al consultar ${url}`, resp.status);
  if (resp.status === 204) return null;
  try {
    return await resp.json();
  } catch {
    throw new ApiError(`Respuesta inválida de ${url}`, resp.status);
  }
}

/**
 * @param {string} recurso
 * @param {number|string} [id]
 * @returns {string}
 */
function urlDe(recurso, id) {
  const base = `${BASE_URL}${encodeURIComponent(recurso)}${EXTENSION}`;
  return id === undefined ? base : `${base}?id=${encodeURIComponent(id)}`;
}

/**
 * @param {string} metodo
 * @param {*} [body]
 * @returns {RequestInit}
 */
function opcionesEscritura(metodo, body) {
  return {
    method: metodo,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
    body: body === undefined ? undefined : JSON.stringify(body)
  };
}

// ---- Modo mock (Entrega 1) ----
// ponytail: las escrituras se guardan en sessionStorage (mock_<recurso>) para sobrevivir
// la navegación entre páginas; se pierden al cerrar la pestaña. El servidor lo reemplaza en la Entrega 2.

const claveMock = (recurso) => `mock_${recurso}`;

/** @returns {Promise<object[]>} */
async function leerMock(recurso) {
  const guardado = sessionStorage.getItem(claveMock(recurso));
  if (guardado) return JSON.parse(guardado);
  return pedir(urlDe(recurso));
}

function guardarMock(recurso, lista) {
  sessionStorage.setItem(claveMock(recurso), JSON.stringify(lista));
}

function indiceDe(lista, recurso, id) {
  const i = lista.findIndex((x) => String(x.id) === String(id));
  if (i === -1) throw new ApiError(`${recurso} con id ${id} no existe`, 404);
  return i;
}

// ---- API pública ----

/**
 * Lee un recurso completo o un registro por id.
 * @param {string} recurso
 * @param {number|string} [id]
 * @returns {Promise<object[]|object>}
 */
async function get(recurso, id) {
  if (!MODO_MOCK) return pedir(urlDe(recurso, id));
  const lista = await leerMock(recurso);
  return id === undefined ? lista : lista[indiceDe(lista, recurso, id)];
}

/**
 * Crea un registro.
 * @param {string} recurso
 * @param {object} body
 * @returns {Promise<object>} El registro con su id asignado.
 */
async function post(recurso, body) {
  if (!MODO_MOCK) return pedir(urlDe(recurso), opcionesEscritura('POST', body));
  const lista = await leerMock(recurso);
  const id = lista.reduce((max, x) => Math.max(max, Number(x.id) || 0), 0) + 1;
  const nuevo = { ...body, id };
  lista.push(nuevo);
  guardarMock(recurso, lista);
  return nuevo;
}

/**
 * Actualiza un registro (merge de campos; el id no cambia).
 * @param {string} recurso
 * @param {number|string} id
 * @param {object} body
 * @returns {Promise<object>}
 */
async function put(recurso, id, body) {
  if (!MODO_MOCK) return pedir(urlDe(recurso, id), opcionesEscritura('PUT', body));
  const lista = await leerMock(recurso);
  const i = indiceDe(lista, recurso, id);
  lista[i] = { ...lista[i], ...body, id: lista[i].id };
  guardarMock(recurso, lista);
  return lista[i];
}

/**
 * Elimina un registro.
 * @param {string} recurso
 * @param {number|string} id
 * @returns {Promise<null>}
 */
async function eliminar(recurso, id) {
  if (!MODO_MOCK) return pedir(urlDe(recurso, id), opcionesEscritura('DELETE'));
  const lista = await leerMock(recurso);
  lista.splice(indiceDe(lista, recurso, id), 1);
  guardarMock(recurso, lista);
  return null;
}

export const api = { get, post, put, delete: eliminar };
