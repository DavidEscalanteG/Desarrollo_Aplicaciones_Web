import { api } from '../api.js';
import { requireRole, getSession, getCsrfToken } from '../session.js';
import { fechaHoy, fotoValida, validarArchivo, longitudValida } from '../validators.js';
import { ObjetoEncontrado } from '../models/ObjetoEncontrado.js';
import {
  iniciarPagina,
  crearElemento,
  mostrarMensaje,
  llenarSelect,
  obtenerNombreCatalogo,
  normalizar
} from '../ui.js';

const SIN_FOTO = 'assets/img/aviso-sin-foto.svg';
const ESTADOS = { disponible: 'Disponible', reclamado: 'Reclamado', entregado: 'Entregado' };
const CATALOGOS = {
  categorias: { singular: 'categoría', titulo: 'Categoría', campo: 'id_categoria' },
  ubicaciones: { singular: 'ubicación', titulo: 'Ubicación', campo: 'id_ubicacion' }
};

const mensaje = document.getElementById('admin-mensaje');
const reintentar = document.getElementById('reintentar');
const nuevo = document.getElementById('nuevo-objeto');
const editor = document.getElementById('editor-objeto');
const tituloEditor = document.getElementById('editor-titulo');
const mensajeEditor = document.getElementById('editor-mensaje');
const form = document.getElementById('form-objeto');
const guardar = document.getElementById('guardar-objeto');
const preview = document.getElementById('foto-preview');
const quitarFoto = document.getElementById('quitar-foto');
const buscar = document.getElementById('buscar-objetos');
const filtroEstado = document.getElementById('filtrar-estado');
const conteo = document.getElementById('objetos-conteo');
const tabla = document.getElementById('tabla-objetos');
const dialogo = document.getElementById('confirmacion');

const catalogos = { categorias: [], ubicaciones: [] };
let objetos = [];
let avisos = [];
let renders = [];
let editando = null;
let foto = '';
let versionFoto = 0;
let fotoPendiente = false;
let ocupado = false;

function comprobarAdmin(formulario) {
  if (getSession()?.rol !== 'admin')
    throw new Error('Tu sesión ya no es de administrador. Recarga la página.');
  if (formulario.elements.csrf_token.value !== getCsrfToken())
    throw new Error('El formulario caducó. Recarga la página.');
}

function confirmar(texto) {
  document.getElementById('confirmacion-texto').textContent = texto;
  dialogo.returnValue = 'cancelar';
  return new Promise((resolve) => {
    dialogo.addEventListener('close', () => resolve(dialogo.returnValue === 'confirmar'), {
      once: true
    });
    dialogo.showModal();
  });
}

function nombreDe(recurso, id) {
  return obtenerNombreCatalogo(catalogos[recurso], id, CATALOGOS[recurso].titulo);
}

function actualizarSelects() {
  for (const recurso of Object.keys(CATALOGOS)) {
    const select = form.elements[CATALOGOS[recurso].campo];
    const valor = select.value;
    llenarSelect(select, catalogos[recurso], `Selecciona una ${CATALOGOS[recurso].singular}`);
    select.value = valor;
  }
}

function crearFila(objeto) {
  const imagen = crearElemento('img', 'tabla__foto');
  imagen.src = objeto.foto && fotoValida(objeto.foto) ? objeto.foto : SIN_FOTO;
  imagen.alt = '';
  imagen.loading = 'lazy';
  imagen.addEventListener(
    'error',
    () => {
      imagen.src = SIN_FOTO;
    },
    { once: true }
  );
  const celdaFoto = crearElemento('td');
  celdaFoto.append(imagen);

  const nombre = crearElemento('th', '', objeto.nombre);
  nombre.scope = 'row';

  const celdaEstado = crearElemento('td');
  celdaEstado.append(crearElemento('span', 'badge', ESTADOS[objeto.estado] ?? objeto.estado));

  const acciones = crearElemento('div', 'acciones');
  const botones = [['editar', 'Editar', 'boton--secundario']];
  if (objeto.estado === 'reclamado') botones.push(['entregar', 'Entregar', 'boton--secundario']);
  botones.push(['eliminar', 'Eliminar', 'boton--peligro']);
  for (const [accion, texto, clase] of botones) {
    const boton = crearElemento('button', `boton ${clase}`, texto);
    boton.type = 'button';
    boton.dataset.accion = accion;
    boton.dataset.id = objeto.id;
    boton.setAttribute('aria-label', `${texto} ${objeto.nombre}`);
    acciones.append(boton);
  }
  const celdaAcciones = crearElemento('td');
  celdaAcciones.append(acciones);

  const fila = crearElemento('tr');
  fila.append(
    celdaFoto,
    nombre,
    crearElemento('td', '', nombreDe('categorias', objeto.id_categoria)),
    crearElemento('td', '', nombreDe('ubicaciones', objeto.id_ubicacion)),
    crearElemento('td', 'tabla__fecha', objeto.fecha_hallazgo),
    celdaEstado,
    celdaAcciones
  );
  return fila;
}

function renderObjetos() {
  const palabras = normalizar(buscar.value).split(/\s+/).filter(Boolean);
  const visibles = objetos
    .filter((objeto) => !filtroEstado.value || objeto.estado === filtroEstado.value)
    .filter((objeto) => {
      const texto = normalizar(
        [
          objeto.nombre,
          objeto.color,
          objeto.descripcion,
          nombreDe('categorias', objeto.id_categoria),
          nombreDe('ubicaciones', objeto.id_ubicacion)
        ].join(' ')
      );
      return palabras.every((palabra) => texto.includes(palabra));
    })
    .sort(
      (a, b) =>
        b.fecha_hallazgo.localeCompare(a.fecha_hallazgo) || Number(b.id) - Number(a.id)
    );
  tabla.replaceChildren(...visibles.map(crearFila));
  conteo.textContent = visibles.length
    ? `${visibles.length} de ${objetos.length} objetos`
    : 'No hay objetos con esos filtros.';
}

function actualizarTodo() {
  actualizarSelects();
  renders.forEach((render) => render());
  renderObjetos();
}

function ponerFoto(valor) {
  foto = valor;
  preview.hidden = !foto;
  quitarFoto.hidden = !foto;
  preview.src = foto && fotoValida(foto) ? foto : SIN_FOTO;
}

function cerrarEditor() {
  versionFoto++;
  fotoPendiente = false;
  editando = null;
  form.reset();
  ponerFoto('');
  mostrarMensaje(mensajeEditor, '');
  editor.hidden = true;
}

function abrirEditor(objeto = null) {
  cerrarEditor();
  editando = objeto;
  tituloEditor.textContent = objeto ? 'Editar objeto' : 'Registrar objeto';
  for (const campo of [
    'nombre',
    'id_categoria',
    'id_ubicacion',
    'fecha_hallazgo',
    'color',
    'descripcion'
  ]) {
    form.elements[campo].value = objeto?.[campo] ?? '';
  }
  form.elements.estado.value = objeto?.estado ?? 'disponible';
  form.elements.fecha_hallazgo.max = fechaHoy();
  form.elements.csrf_token.value = getCsrfToken();
  ponerFoto(objeto?.foto ?? '');
  guardar.disabled = false;
  editor.hidden = false;
  tituloEditor.focus();
}

function leerFoto(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = () => reject(new Error('No se pudo leer la foto.'));
    lector.readAsDataURL(archivo);
  });
}

function montarCatalogo(recurso) {
  const { singular, titulo, campo } = CATALOGOS[recurso];
  const formCatalogo = document.getElementById(`form-${recurso}`);
  const lista = document.getElementById(`lista-${recurso}`);
  const aviso = document.getElementById(`${recurso}-mensaje`);
  const etiqueta = formCatalogo.querySelector('label');
  const enviar = formCatalogo.querySelector('button[type="submit"]');
  const cancelar = formCatalogo.querySelector('[data-cancelar]');
  let editandoId = null;

  const usos = (id) =>
    [...objetos, ...avisos].filter((registro) => String(registro[campo]) === String(id)).length;

  function terminarEdicion() {
    editandoId = null;
    formCatalogo.elements.nombre.value = '';
    etiqueta.textContent = `Nueva ${singular}`;
    enviar.textContent = 'Agregar';
    cancelar.hidden = true;
  }

  function render() {
    const ordenados = [...catalogos[recurso]].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    lista.replaceChildren(
      ...ordenados.map((item) => {
        const total = usos(item.id);
        const info = crearElemento('div');
        info.append(
          crearElemento('span', '', item.nombre),
          crearElemento('small', 'texto-suave', total === 1 ? '1 registro' : `${total} registros`)
        );
        const acciones = crearElemento('div', 'acciones');
        for (const [accion, texto, clase] of [
          ['editar', 'Editar', 'boton--secundario'],
          ['eliminar', 'Eliminar', 'boton--peligro']
        ]) {
          const boton = crearElemento('button', `boton ${clase}`, texto);
          boton.type = 'button';
          boton.dataset.accion = accion;
          boton.dataset.id = item.id;
          boton.setAttribute('aria-label', `${texto} ${item.nombre}`);
          acciones.append(boton);
        }
        const fila = crearElemento('li');
        fila.append(info, acciones);
        return fila;
      })
    );
  }

  formCatalogo.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (ocupado || !formCatalogo.reportValidity()) return;
    const nombre = formCatalogo.elements.nombre.value.trim().replace(/\s+/g, ' ');
    ocupado = true;
    try {
      comprobarAdmin(formCatalogo);
      if (!longitudValida(nombre, 3, 60))
        throw new Error(`El nombre de la ${singular} debe tener entre 3 y 60 caracteres.`);
      const repetido = catalogos[recurso].some(
        (item) =>
          String(item.id) !== String(editandoId) && normalizar(item.nombre) === normalizar(nombre)
      );
      if (repetido) throw new Error(`Ya existe una ${singular} con ese nombre.`);
      const guardado = editandoId
        ? await api.put(recurso, editandoId, { nombre })
        : await api.post(recurso, { nombre });
      catalogos[recurso] = [
        ...catalogos[recurso].filter((item) => String(item.id) !== String(guardado.id)),
        guardado
      ];
      mostrarMensaje(aviso, `${titulo} ${editandoId ? 'actualizada' : 'agregada'}.`);
      terminarEdicion();
      actualizarTodo();
    } catch (error) {
      mostrarMensaje(aviso, error.message, true);
    } finally {
      ocupado = false;
    }
  });

  lista.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('button[data-accion]');
    if (!boton || ocupado) return;
    const item = catalogos[recurso].find((i) => String(i.id) === boton.dataset.id);
    if (!item) return;
    if (boton.dataset.accion === 'editar') {
      editandoId = item.id;
      formCatalogo.elements.nombre.value = item.nombre;
      etiqueta.textContent = `Editar ${singular}`;
      enviar.textContent = 'Guardar';
      cancelar.hidden = false;
      mostrarMensaje(aviso, '');
      formCatalogo.elements.nombre.focus();
      return;
    }
    const total = usos(item.id);
    if (total) {
      mostrarMensaje(
        aviso,
        `No se puede eliminar «${item.nombre}» porque ${total === 1 ? 'la usa 1 registro' : `la usan ${total} registros`}.`,
        true
      );
      return;
    }
    ocupado = true;
    try {
      comprobarAdmin(formCatalogo);
      if (!(await confirmar(`¿Eliminar la ${singular} «${item.nombre}»?`))) return;
      await api.delete(recurso, item.id);
      catalogos[recurso] = catalogos[recurso].filter((i) => i !== item);
      if (String(editandoId) === String(item.id)) terminarEdicion();
      mostrarMensaje(aviso, `${titulo} eliminada.`);
      actualizarTodo();
    } catch (error) {
      mostrarMensaje(aviso, error.message, true);
    } finally {
      ocupado = false;
    }
  });

  cancelar.addEventListener('click', () => {
    terminarEdicion();
    mostrarMensaje(aviso, '');
  });

  return render;
}

async function cargar() {
  reintentar.hidden = true;
  nuevo.disabled = true;
  mostrarMensaje(mensaje, 'Cargando datos…');
  try {
    const [encontrados, categorias, ubicaciones, listaAvisos] = await Promise.all([
      api.get('encontrados'),
      api.get('categorias'),
      api.get('ubicaciones'),
      api.get('avisos')
    ]);
    objetos = encontrados;
    catalogos.categorias = categorias;
    catalogos.ubicaciones = ubicaciones;
    avisos = listaAvisos;
    nuevo.disabled = false;
    mostrarMensaje(mensaje, '');
    actualizarTodo();
  } catch (error) {
    mostrarMensaje(mensaje, `No se pudieron cargar los datos. ${error.message}`, true);
    reintentar.hidden = false;
  }
}

nuevo.addEventListener('click', () => abrirEditor());

document.getElementById('cancelar-edicion').addEventListener('click', () => {
  cerrarEditor();
  nuevo.focus();
});

quitarFoto.addEventListener('click', () => {
  versionFoto++;
  fotoPendiente = false;
  guardar.disabled = false;
  form.elements.foto.value = '';
  ponerFoto('');
});

form.elements.foto.addEventListener('change', async () => {
  const version = ++versionFoto;
  const archivo = form.elements.foto.files[0];
  if (!archivo) return;
  fotoPendiente = true;
  guardar.disabled = true;
  mostrarMensaje(mensajeEditor, 'Revisando la foto…');
  try {
    const problema = validarArchivo(archivo);
    if (problema) throw new Error(problema);
    const datos = await leerFoto(archivo);
    const imagen = new Image();
    imagen.src = datos;
    await imagen.decode();
    if (version !== versionFoto) return;
    ponerFoto(datos);
    mostrarMensaje(mensajeEditor, 'Foto lista. Guarda para conservarla.');
  } catch (error) {
    if (version !== versionFoto) return;
    form.elements.foto.value = '';
    mostrarMensaje(
      mensajeEditor,
      error.name === 'EncodingError' ? 'El archivo no es una imagen válida.' : error.message,
      true
    );
  } finally {
    if (version === versionFoto) {
      fotoPendiente = false;
      guardar.disabled = false;
    }
  }
});

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (ocupado || fotoPendiente || !form.reportValidity()) return;
  ocupado = true;
  guardar.disabled = true;
  try {
    comprobarAdmin(form);
    const campos = Object.fromEntries(new FormData(form));
    if (
      !catalogos.categorias.some((item) => String(item.id) === campos.id_categoria) ||
      !catalogos.ubicaciones.some((item) => String(item.id) === campos.id_ubicacion)
    )
      throw new Error('Elige una categoría y una ubicación de la lista.');
    const objeto = new ObjetoEncontrado({
      ...campos,
      ...(editando ? { id: editando.id } : {}),
      foto
    });
    const datos = objeto.toJSON();
    const guardado = editando
      ? await api.put('encontrados', editando.id, datos)
      : await api.post('encontrados', datos);
    objetos = [...objetos.filter((item) => String(item.id) !== String(guardado.id)), guardado];
    const texto = editando ? 'Objeto actualizado.' : 'Objeto registrado.';
    cerrarEditor();
    mostrarMensaje(mensaje, texto);
    actualizarTodo();
    nuevo.focus();
  } catch (error) {
    mostrarMensaje(
      mensajeEditor,
      error.name === 'QuotaExceededError'
        ? 'No hay espacio para guardar la foto. Usa una imagen más pequeña.'
        : error.message,
      true
    );
  } finally {
    ocupado = false;
    guardar.disabled = false;
  }
});

tabla.addEventListener('click', async (evento) => {
  const boton = evento.target.closest('button[data-accion]');
  if (!boton || ocupado) return;
  const objeto = objetos.find((item) => String(item.id) === boton.dataset.id);
  if (!objeto) return;
  if (boton.dataset.accion === 'editar') {
    abrirEditor(objeto);
    return;
  }
  ocupado = true;
  try {
    comprobarAdmin(form);
    if (boton.dataset.accion === 'eliminar') {
      if (!(await confirmar(`¿Eliminar «${objeto.nombre}»? No se puede deshacer.`))) return;
      await api.delete('encontrados', objeto.id);
      objetos = objetos.filter((item) => item !== objeto);
      if (String(editando?.id) === String(objeto.id)) cerrarEditor();
      mostrarMensaje(mensaje, 'Objeto eliminado.');
    } else {
      const validado = await confirmar(
        `¿Ya validaste la característica oculta con quien reclamó «${objeto.nombre}»? Se marcará como entregado.`
      );
      if (!validado) return;
      const actualizado = await api.put('encontrados', objeto.id, { estado: 'entregado' });
      objetos = objetos.map((item) => (item === objeto ? actualizado : item));
      mostrarMensaje(mensaje, `«${objeto.nombre}» quedó como entregado.`);
    }
    actualizarTodo();
  } catch (error) {
    mostrarMensaje(mensaje, error.message, true);
  } finally {
    ocupado = false;
  }
});

buscar.addEventListener('input', renderObjetos);
filtroEstado.addEventListener('change', renderObjetos);
reintentar.addEventListener('click', cargar);

iniciarPagina();
if (requireRole('admin')) {
  renders = Object.keys(CATALOGOS).map(montarCatalogo);
  await cargar();
}
