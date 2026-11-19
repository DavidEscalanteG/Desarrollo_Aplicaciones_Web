/**
 * Puntaje de coincidencia entre un aviso de búsqueda y objetos encontrados.
 * Funciones puras: sin DOM, sin red. Nunca usa `caracteristica_oculta`.
 *
 * Puntaje (0-100):
 *   categoría igual           40
 *   ubicación igual           20
 *   fecha de hallazgo         hasta 15 (mismo día o después de la pérdida; más cerca = más puntos)
 *   color                     hasta 10
 *   palabras en común         hasta 15 (título/descripción del aviso vs. nombre/descripción del objeto)
 */
import { UMBRAL_COINCIDENCIA } from './config.js';

const PALABRAS_VACIAS = new Set([
  'para', 'pero', 'como', 'esta', 'este', 'estaba', 'tiene', 'tenía', 'dentro', 'cerca',
  'junto', 'unos', 'unas', 'sobre', 'entre', 'desde', 'hasta', 'deje', 'dejé', 'color'
]);

/**
 * Minúsculas sin acentos.
 * @param {string} texto
 * @returns {string}
 */
function normalizar(texto) {
  return String(texto ?? '')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Palabras significativas (4+ letras, sin palabras vacías).
 * @param {string} texto
 * @returns {Set<string>}
 */
function palabras(texto) {
  return new Set(
    normalizar(texto)
      .split(/[^a-z0-9ñ]+/)
      .filter((p) => p.length >= 4 && !PALABRAS_VACIAS.has(p))
  );
}

/**
 * Días entre dos fechas AAAA-MM-DD (b - a).
 * @returns {number} NaN si alguna fecha es inválida.
 */
function diasEntre(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
}

function puntosFecha(fechaPerdida, fechaHallazgo) {
  const dias = diasEntre(fechaPerdida, fechaHallazgo);
  if (Number.isNaN(dias) || dias < 0) return 0;
  if (dias <= 3) return 15;
  if (dias <= 7) return 10;
  if (dias <= 30) return 5;
  return 0;
}

function puntosColor(colorAviso, colorObjeto) {
  const a = normalizar(colorAviso).trim();
  const b = normalizar(colorObjeto).trim();
  if (!a || !b) return 0;
  if (a === b || a.includes(b) || b.includes(a)) return 10;
  const comunes = [...palabras(a)].filter((p) => palabras(b).has(p));
  return comunes.length ? 5 : 0;
}

function puntosTexto(aviso, objeto) {
  const delAviso = palabras(`${aviso.titulo} ${aviso.descripcion}`);
  const delObjeto = palabras(`${objeto.nombre} ${objeto.descripcion}`);
  const menor = Math.min(delAviso.size, delObjeto.size);
  if (!menor) return 0;
  const comunes = [...delAviso].filter((p) => delObjeto.has(p)).length;
  // ponytail: proporción simple de palabras compartidas; usar sinónimos/raíces si el puntaje se queda corto.
  return Math.round(Math.min(1, comunes / Math.min(menor, 6)) * 15);
}

/**
 * Puntaje de un objeto encontrado contra un aviso.
 * @param {object} aviso Campos del contrato de avisos.
 * @param {object} objeto Campos del contrato de encontrados.
 * @returns {number} Entero 0-100.
 */
export function puntuar(aviso, objeto) {
  return (
    (String(aviso.id_categoria) === String(objeto.id_categoria) ? 40 : 0) +
    (String(aviso.id_ubicacion) === String(objeto.id_ubicacion) ? 20 : 0) +
    puntosFecha(aviso.fecha_perdida, objeto.fecha_hallazgo) +
    puntosColor(aviso.color, objeto.color) +
    puntosTexto(aviso, objeto)
  );
}

/**
 * Objetos disponibles que superan el umbral, de mayor a menor puntaje.
 * @param {object} aviso
 * @param {object[]} encontrados
 * @param {number} [umbral=UMBRAL_COINCIDENCIA]
 * @returns {Array<{objeto: object, puntaje: number}>}
 */
export function buscarCoincidencias(aviso, encontrados, umbral = UMBRAL_COINCIDENCIA) {
  return encontrados
    .filter((objeto) => objeto.estado === 'disponible')
    .map((objeto) => ({ objeto, puntaje: puntuar(aviso, objeto) }))
    .filter(({ puntaje }) => puntaje >= umbral)
    .sort((a, b) => b.puntaje - a.puntaje);
}
