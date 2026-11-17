import { FOTO_MAX_BYTES, FOTO_TIPOS } from './config.js';

/** @param {*} valor @returns {boolean} Indica si hay texto no vacío. */
export function requerido(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

/**
 * Comprueba la longitud del texto normalizado, con límites inclusivos.
 * @param {string} valor
 * @param {number} minimo
 * @param {number} maximo
 * @returns {boolean}
 */
export function longitudValida(valor, minimo, maximo) {
  return requerido(valor) && valor.trim().length >= minimo && valor.trim().length <= maximo;
}

/** @param {string} correo @returns {boolean} Valida la forma del correo. */
export function correoValido(correo) {
  return typeof correo === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

/** @returns {string} Fecha local en formato AAAA-MM-DD. */
export function fechaHoy() {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

/** @param {string} valor @returns {boolean} Rechaza fechas futuras o imposibles. */
export function fechaNoFutura(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T12:00:00Z`);
  return (
    !Number.isNaN(fecha.getTime()) &&
    fecha.toISOString().slice(0, 10) === valor &&
    valor <= fechaHoy()
  );
}

/**
 * Comprueba tamaño y tipo; la interfaz debe verificar también la decodificación.
 * @param {File} archivo
 * @returns {string} Mensaje de error o cadena vacía si es válido.
 */
export function validarArchivo(archivo) {
  if (
    !archivo ||
    !FOTO_TIPOS.includes(archivo.type) ||
    archivo.size > FOTO_MAX_BYTES ||
    !archivo.size
  ) {
    return 'Selecciona una foto JPG, PNG o WebP de hasta 2 MB.';
  }
  return '';
}

/** @param {string} foto @returns {boolean} Admite imágenes locales o datos raster. */
export function fotoValida(foto) {
  if (!foto) return true;
  if (typeof foto !== 'string') return false;
  if (/^data:image\/(jpeg|png|webp);base64,[a-z\d+/]+=*$/i.test(foto)) {
    return foto.length <= Math.ceil(FOTO_MAX_BYTES / 3) * 4 + 40;
  }
  return (
    /^(assets\/img\/|img\/)[a-z\d/_-]+\.(jpe?g|png|webp|svg)$/i.test(foto) && !foto.includes('..')
  );
}
