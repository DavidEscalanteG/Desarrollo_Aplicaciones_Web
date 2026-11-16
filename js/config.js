/**
 * Configuración global del proyecto.
 * Entrega 2: cambiar MODO_MOCK a false y las páginas pasan a usar api/<recurso>.php.
 */

/** true = datos de data/*.json con escrituras simuladas; false = servidor PHP. */
export const MODO_MOCK = true;

export const BASE_URL = MODO_MOCK ? 'data/' : 'api/';
export const EXTENSION = MODO_MOCK ? '.json' : '.php';

/** Tamaño máximo de foto en bytes (2 MB). */
export const FOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Tipos MIME aceptados para fotos. */
export const FOTO_TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

/** Puntaje mínimo (0-100) para considerar un objeto encontrado como coincidencia. */
export const UMBRAL_COINCIDENCIA = 50;

/** Cuántas búsquedas recientes guarda el catálogo. */
export const MAX_BUSQUEDAS_RECIENTES = 5;

/** Claves acordadas de sessionStorage, cookies y localStorage. */
export const CLAVES = Object.freeze({
  sesion: 'sesion',
  csrf: 'csrf_token',
  recordarCorreo: 'recordar_correo',
  tema: 'tema',
  borradorAviso: 'borrador_aviso',
  busquedasRecientes: 'busquedas_recientes'
});
