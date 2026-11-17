import { api } from '../api.js';
import { CLAVES, MAX_BUSQUEDAS_RECIENTES } from '../config.js';
import { loadDraft, saveDraft } from '../storage.js';
import { fechaHoy } from '../validators.js';
import {
  iniciarPagina,
  crearElemento,
  mostrarMensaje,
  llenarSelect,
  obtenerNombreCatalogo,
  crearTarjetaObjeto
} from '../ui.js';

iniciarPagina();

const form = document.getElementById('filtros');
const buscar = document.getElementById('buscar');
const selCategoria = document.getElementById('filtro-categoria');
const selUbicacion = document.getElementById('filtro-ubicacion');
const desde = document.getElementById('filtro-desde');
const hasta = document.getElementById('filtro-hasta');
const estado = document.getElementById('catalogo-estado');
const lista = document.getElementById('lista-objetos');
const reintentar = document.getElementById('reintentar');
const recientes = document.getElementById('recientes');
const etiquetaRecientes = recientes.firstElementChild;

let objetos = [];
let catalogos = { categorias: [], ubicaciones: [] };

/**
 * Pasa a minúsculas y quita acentos para comparar textos.
 * @param {string} texto
 * @returns {string}
 */
function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Texto donde se busca: nombre, color, descripción, categoría y ubicación.
 * @param {object} objeto
 * @returns {string}
 */
function textoBuscable(objeto) {
  return normalizar(
    [
      objeto.nombre,
      objeto.color,
      objeto.descripcion,
      obtenerNombreCatalogo(catalogos.categorias, objeto.id_categoria, ''),
      obtenerNombreCatalogo(catalogos.ubicaciones, objeto.id_ubicacion, '')
    ].join(' ')
  );
}

/** Aplica la búsqueda y los filtros y vuelve a dibujar la lista. */
function aplicarFiltros() {
  hasta.min = desde.value;
  desde.max = hasta.value || fechaHoy();

  if (desde.value && hasta.value && desde.value > hasta.value) {
    lista.replaceChildren();
    mostrarMensaje(estado, 'La fecha "desde" no puede ser después de la fecha "hasta".', true);
    return;
  }

  // Cada palabra tiene que aparecer en algún campo ("mochila azul" encuentra la mochila azul marino)
  const palabras = normalizar(buscar.value).split(/\s+/).filter(Boolean);

  const filtrados = objetos.filter((objeto) => {
    if (selCategoria.value && String(objeto.id_categoria) !== selCategoria.value) return false;
    if (selUbicacion.value && String(objeto.id_ubicacion) !== selUbicacion.value) return false;
    if (desde.value && objeto.fecha_hallazgo < desde.value) return false;
    if (hasta.value && objeto.fecha_hallazgo > hasta.value) return false;
    const texto = textoBuscable(objeto);
    return palabras.every((palabra) => texto.includes(palabra));
  });

  lista.replaceChildren(
    ...filtrados.map((objeto) => {
      const card = crearTarjetaObjeto(objeto, catalogos);
      const enlace = crearElemento('a', '', '¿Es tuyo? Repórtalo');
      enlace.href = 'reportar.html';
      enlace.dataset.noPrint = '';
      card.append(enlace);
      return card;
    })
  );

  if (!filtrados.length) {
    mostrarMensaje(
      estado,
      'No hay objetos que coincidan. Si perdiste algo, publica un aviso y te avisamos cuando aparezca.'
    );
  } else {
    mostrarMensaje(
      estado,
      filtrados.length === 1
        ? '1 objeto disponible.'
        : `${filtrados.length} objetos disponibles.`
    );
  }
}

/** @returns {string[]} Últimas búsquedas guardadas en localStorage. */
function leerRecientes() {
  const guardadas = loadDraft(CLAVES.busquedasRecientes);
  return Array.isArray(guardadas) ? guardadas.filter((b) => typeof b === 'string') : [];
}

/** Dibuja los botones de búsquedas recientes. */
function mostrarRecientes() {
  const busquedas = leerRecientes();
  recientes.hidden = !busquedas.length;
  recientes.replaceChildren(
    etiquetaRecientes,
    ...busquedas.map((busqueda) => {
      const boton = crearElemento('button', 'boton boton--secundario', busqueda);
      boton.type = 'button';
      boton.addEventListener('click', () => {
        buscar.value = busqueda;
        aplicarFiltros();
      });
      return boton;
    })
  );
}

/**
 * Guarda una búsqueda al inicio de la lista (sin repetir, máximo 5).
 * @param {string} busqueda
 */
function guardarBusqueda(busqueda) {
  const texto = busqueda.trim();
  if (!texto) return;
  const otras = leerRecientes().filter((b) => normalizar(b) !== normalizar(texto));
  saveDraft([texto, ...otras].slice(0, MAX_BUSQUEDAS_RECIENTES), CLAVES.busquedasRecientes);
  mostrarRecientes();
}

/** Trae los objetos y los catálogos; solo se muestran los disponibles. */
async function cargar() {
  reintentar.hidden = true;
  lista.replaceChildren();
  mostrarMensaje(estado, 'Cargando objetos…');
  try {
    const [encontrados, categorias, ubicaciones] = await Promise.all([
      api.get('encontrados'),
      api.get('categorias'),
      api.get('ubicaciones')
    ]);
    objetos = encontrados
      .filter((objeto) => objeto.estado === 'disponible')
      .sort((a, b) => b.fecha_hallazgo.localeCompare(a.fecha_hallazgo));
    catalogos = { categorias, ubicaciones };
    llenarSelect(selCategoria, categorias, 'Todas');
    llenarSelect(selUbicacion, ubicaciones, 'Todas');
    aplicarFiltros();
  } catch (error) {
    mostrarMensaje(estado, `No se pudo cargar el catálogo. ${error.message}`, true);
    reintentar.hidden = false;
  }
}

// La búsqueda es en vivo: cualquier cambio en el formulario vuelve a filtrar
form.addEventListener('input', aplicarFiltros);
form.addEventListener('submit', (evento) => {
  evento.preventDefault();
  guardarBusqueda(buscar.value);
});
buscar.addEventListener('change', () => guardarBusqueda(buscar.value));
form.addEventListener('reset', () => setTimeout(aplicarFiltros));
document.getElementById('imprimir').addEventListener('click', () => window.print());
reintentar.addEventListener('click', cargar);

// Si viene de la portada con ?q=, se usa como búsqueda inicial
const consulta = (new URLSearchParams(location.search).get('q') ?? '').slice(0, 100);
buscar.value = consulta;
desde.max = fechaHoy();
hasta.max = fechaHoy();
guardarBusqueda(consulta);
mostrarRecientes();
await cargar();
