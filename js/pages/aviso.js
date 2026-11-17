import { api, cargarCatalogos } from '../api.js';
import { requireLogin, getSession } from '../session.js';
import { fotoValida } from '../validators.js';
import { iniciarPagina, mostrarMensaje, obtenerNombreCatalogo } from '../ui.js';

iniciarPagina();
const sesion = requireLogin();
if (sesion) await cargarCartel();

async function cargarCartel() {
  const estado = document.getElementById('cartel-mensaje');
  const imprimir = document.getElementById('imprimir-aviso');
  const descargar = document.getElementById('descargar-aviso');
  try {
    const id = new URLSearchParams(location.search).get('id');
    if (!/^\d+$/.test(id ?? '') || !Number.isSafeInteger(Number(id)) || Number(id) <= 0)
      throw new Error('Selecciona un aviso válido desde Mis avisos.');
    const aviso = await api.get('avisos', id);
    if (String(aviso.id_usuario) !== String(sesion.id))
      throw new Error('Este aviso no pertenece a tu cuenta.');
    let catalogos = { categorias: [], ubicaciones: [] };
    let advertencia = '';
    try {
      catalogos = await cargarCatalogos();
    } catch {
      advertencia = 'Los catálogos aún no están disponibles. Se muestran sus identificadores.';
    }
    // Lista explícita de campos públicos: nunca copiar caracteristica_oculta al DOM o a la descarga.
    const publico = {
      id: aviso.id,
      titulo: aviso.titulo,
      color: aviso.color,
      descripcion: aviso.descripcion,
      fecha: aviso.fecha_perdida,
      categoria: obtenerNombreCatalogo(catalogos.categorias, aviso.id_categoria, 'Categoría'),
      ubicacion: obtenerNombreCatalogo(catalogos.ubicaciones, aviso.id_ubicacion, 'Ubicación'),
      foto: aviso.foto && fotoValida(aviso.foto) ? aviso.foto : '',
      cerrado: aviso.estado === 'cerrado'
    };
    for (const [campo, valor] of Object.entries({
      titulo: publico.titulo,
      categoria: publico.categoria,
      ubicacion: publico.ubicacion,
      color: publico.color,
      fecha: publico.fecha,
      descripcion: publico.descripcion,
      referencia: `#${publico.id}`,
      estado: publico.cerrado
        ? 'Aviso cerrado: el objeto ya no está en búsqueda.'
        : 'Objeto perdido en el campus'
    })) {
      document.getElementById(`cartel-${campo}`).textContent = valor;
    }
    const imagen = document.getElementById('cartel-foto');
    if (publico.foto) {
      imagen.src = publico.foto;
      imagen.hidden = false;
      imagen.addEventListener(
        'error',
        () => {
          imagen.hidden = true;
        },
        { once: true }
      );
    }
    if (publico.cerrado) document.querySelector('.cartel__rotulo').textContent = 'AVISO CERRADO';
    document.getElementById('cartel').hidden = false;
    document.title = `Aviso #${publico.id} | Objetos Perdidos Campus`;
    mostrarMensaje(estado, advertencia);
    imprimir.disabled = false;
    descargar.disabled = false;
    function comprobarSesion() {
      if (String(getSession()?.id) !== String(sesion.id))
        throw new Error('La sesión cambió. Recarga el cartel.');
    }
    imprimir.addEventListener('click', async () => {
      try {
        comprobarSesion();
        if (publico.foto && !imagen.hidden) await imagen.decode();
        window.print();
      } catch (error) {
        mostrarMensaje(estado, error.message, true);
      }
    });
    descargar.addEventListener('click', async () => {
      descargar.disabled = true;
      try {
        comprobarSesion();
        await descargarCartel(publico);
        mostrarMensaje(
          estado,
          'Cartel descargado. También puedes guardar un PDF con el botón de impresión.'
        );
      } catch (error) {
        mostrarMensaje(estado, `No se pudo descargar el cartel: ${error.message}`, true);
      } finally {
        descargar.disabled = false;
      }
    });
  } catch (error) {
    mostrarMensaje(
      estado,
      error.status === 404
        ? 'No se encontró ese aviso. Puede haber sido eliminado.'
        : error.message,
      true
    );
  }
}

/** Divide incluso palabras largas para que no desborden el cartel descargable. */
function lineas(texto, limite) {
  const salida = [];
  for (const parrafo of String(texto).split('\n')) {
    let linea = '';
    for (const palabra of parrafo.split(/\s+/)) {
      if (linea && linea.length + palabra.length + 1 > limite) {
        salida.push(linea);
        linea = '';
      }
      let resto = palabra;
      while (resto.length > limite) {
        salida.push(resto.slice(0, limite));
        resto = resto.slice(limite);
      }
      linea = linea ? `${linea} ${resto}` : resto;
    }
    salida.push(linea);
  }
  return salida;
}

/** SVG autónomo y descargable, construido con nodos XML y campos públicos. */
async function descargarCartel(aviso) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const ancho = 850;
  let y = 75;
  function agregar(tag, atributos, texto) {
    const elemento = document.createElementNS(ns, tag);
    for (const [clave, valor] of Object.entries(atributos)) elemento.setAttribute(clave, valor);
    if (texto !== undefined) elemento.textContent = texto;
    svg.append(elemento);
    return elemento;
  }
  const fondo = agregar('rect', { x: 0, y: 0, width: ancho, height: 2000, fill: 'white' });
  function escribir(texto, size = 23, negrita = false, limite = 52) {
    for (const linea of lineas(texto, limite)) {
      agregar(
        'text',
        {
          x: 55,
          y,
          fill: '#111827',
          'font-family': 'Arial, sans-serif',
          'font-size': size,
          'font-weight': negrita ? '700' : '400'
        },
        linea
      );
      y += size * 1.45;
    }
    y += 10;
  }
  escribir(aviso.cerrado ? 'AVISO CERRADO' : 'SE BUSCA', 52, true, 23);
  escribir(aviso.titulo, 32, true, 37);
  if (aviso.foto) {
    const imagen = new Image();
    imagen.src = aviso.foto;
    await imagen.decode();
    const escala = Math.min(740 / imagen.naturalWidth, 280 / imagen.naturalHeight, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
    canvas.getContext('2d').drawImage(imagen, 0, 0, canvas.width, canvas.height);
    agregar('image', {
      href: canvas.toDataURL('image/png'),
      x: 55,
      y,
      width: 740,
      height: 280,
      preserveAspectRatio: 'xMidYMid meet'
    });
    y += 310;
  }
  escribir(`Categoría: ${aviso.categoria}`);
  escribir(`Color: ${aviso.color}`);
  escribir(`Última ubicación: ${aviso.ubicacion}`);
  escribir(`Fecha de pérdida: ${aviso.fecha}`);
  escribir(aviso.descripcion, 22, false, 54);
  y += 20;
  escribir('¿Lo encontraste?', 26, true);
  escribir('Entrégalo al personal de objetos perdidos del campus.', 21);
  escribir(`Indica el aviso #${aviso.id}.`, 23, true);
  escribir('Objetos Perdidos Campus', 19);
  const alto = Math.ceil(y + 30);
  fondo.setAttribute('height', alto);
  svg.setAttribute('width', ancho);
  svg.setAttribute('height', alto);
  svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
    type: 'image/svg+xml;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `aviso-${aviso.id}.svg`;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
