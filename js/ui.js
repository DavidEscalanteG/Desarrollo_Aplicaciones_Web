import { renderHeader, getCsrfToken } from './session.js';
import { getTheme, setTheme } from './storage.js';

/** Inicializa el tema, la navegación de sesión y los tokens de los formularios. */
export function iniciarPagina() {
  iniciarTema();
  renderHeader();
  document.querySelectorAll('input[name="csrf_token"]').forEach((input) => {
    input.value = getCsrfToken();
  });
}

/**
 * Construye nodos sin interpretar datos como HTML.
 * @param {string} tag
 * @param {string} [clase]
 * @param {string|number} [contenido]
 * @returns {HTMLElement}
 */
export function crearElemento(tag, clase, contenido) {
  const elemento = document.createElement(tag);
  if (clase) elemento.className = clase;
  if (contenido !== undefined) elemento.textContent = contenido;
  return elemento;
}

/**
 * Muestra mensajes accesibles de carga, éxito o error.
 * @param {HTMLElement} elemento
 * @param {string} texto
 * @param {boolean} [error=false]
 */
export function mostrarMensaje(elemento, texto, error = false) {
  elemento.textContent = texto;
  elemento.classList.toggle('mensaje--error', error);
  elemento.hidden = !texto;
}

/**
 * Llena un select a partir de un catálogo de {id, nombre}.
 * @param {HTMLSelectElement} select
 * @param {Array<{id: number|string, nombre: string}>} lista
 * @param {string} etiqueta
 */
export function llenarSelect(select, lista, etiqueta) {
  select.replaceChildren(new Option(etiqueta, ''));
  lista.forEach((item) => select.add(new Option(item.nombre, String(item.id))));
}

/**
 * Obtiene un nombre legible, incluso con catálogos aún pendientes.
 * @param {Array<{id: number|string, nombre: string}>} lista
 * @param {number|string} id
 * @param {string} tipo
 * @returns {string}
 */
export function obtenerNombreCatalogo(lista, id, tipo) {
  return lista.find((item) => String(item.id) === String(id))?.nombre ?? `${tipo} #${id}`;
}

/** @param {string} tema Aplica y guarda la preferencia claro/oscuro. */
export function aplicarTema(tema) {
  const valor = setTheme(tema);
  document.documentElement.dataset.tema = valor;
  document.querySelectorAll('[data-tema-alternar]').forEach((boton) => {
    boton.textContent = valor === 'oscuro' ? 'Tema claro' : 'Tema oscuro';
    boton.setAttribute('aria-pressed', String(valor === 'oscuro'));
  });
}

/** Conecta todos los controles de tema de la página. */
export function iniciarTema() {
  aplicarTema(getTheme());
  document.querySelectorAll('[data-tema-alternar]').forEach((boton) => {
    boton.addEventListener('click', () =>
      aplicarTema(document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro')
    );
  });
}
