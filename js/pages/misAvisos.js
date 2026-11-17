import { api, cargarCatalogos } from '../api.js';
import { requireLogin, getSession, getCsrfToken } from '../session.js';
import { fechaHoy, fotoValida, validarArchivo } from '../validators.js';
import { Aviso } from '../models/Aviso.js';
import {
  iniciarPagina,
  crearElemento,
  mostrarMensaje,
  llenarSelect,
  obtenerNombreCatalogo
} from '../ui.js';

iniciarPagina();
const sesion = requireLogin();
if (sesion) await iniciarAvisos();

async function iniciarAvisos() {
  const lista = document.getElementById('lista-avisos');
  const estado = document.getElementById('avisos-mensaje');
  const editor = document.getElementById('editor-aviso');
  const form = document.getElementById('form-aviso');
  const estadoEditor = document.getElementById('editor-mensaje');
  const guardar = document.getElementById('guardar-aviso');
  const nuevo = document.getElementById('nuevo-aviso');
  const recargar = document.getElementById('recargar-avisos');
  const preview = document.getElementById('foto-preview');
  const quitarFoto = document.getElementById('quitar-foto');
  const dialogo = document.getElementById('confirmacion');
  const buscar = document.getElementById('buscar-avisos');
  const filtro = document.getElementById('filtrar-estado');
  let avisos = [];
  let catalogos = { categorias: [], ubicaciones: [] };
  let catalogosListos = false;
  let editando = null;
  let foto = '';
  let fotoPendiente = false;
  let versionFoto = 0;
  let ocupado = false;

  function comprobarSesion() {
    if (String(getSession()?.id) !== String(sesion.id))
      throw new Error('La sesión cambió. Recarga la página antes de continuar.');
    if (form.elements.csrf_token.value !== getCsrfToken())
      throw new Error('El formulario caducó. Recarga la página.');
  }

  async function avisoPropio(id) {
    comprobarSesion();
    const aviso = await api.get('avisos', id);
    if (String(aviso.id_usuario) !== String(sesion.id))
      throw new Error('Este aviso no pertenece a tu cuenta.');
    return aviso;
  }

  function actualizarFoto(valor) {
    foto = valor;
    preview.hidden = !foto;
    quitarFoto.hidden = !foto;
    if (foto && fotoValida(foto)) preview.src = foto;
    else preview.src = 'assets/img/aviso-sin-foto.svg';
  }

  function cerrarEditor() {
    versionFoto++;
    fotoPendiente = false;
    editor.hidden = true;
    editando = null;
    form.reset();
    actualizarFoto('');
  }

  function abrirEditor(aviso = null) {
    cerrarEditor();
    editando = aviso;
    document.getElementById('editor-titulo').textContent = aviso ? 'Editar aviso' : 'Crear aviso';
    for (const campo of [
      'titulo',
      'id_categoria',
      'id_ubicacion',
      'fecha_perdida',
      'color',
      'descripcion',
      'caracteristica_oculta'
    ]) {
      form.elements[campo].value = aviso?.[campo] ?? '';
    }
    form.elements.fecha_perdida.max = fechaHoy();
    form.elements.csrf_token.value = getCsrfToken();
    actualizarFoto(aviso?.foto ?? '');
    mostrarMensaje(estadoEditor, '');
    guardar.disabled = false;
    editor.hidden = false;
    document.getElementById('editor-titulo').focus();
  }

  function render() {
    const consulta = buscar.value.trim().toLocaleLowerCase('es');
    const propios = avisos.filter((aviso) => String(aviso.id_usuario) === String(sesion.id));
    const visibles = propios.filter(
      (aviso) =>
        (!filtro.value || aviso.estado === filtro.value) &&
        [
          aviso.titulo,
          aviso.descripcion,
          aviso.color,
          obtenerNombreCatalogo(catalogos.categorias, aviso.id_categoria, 'Categoría'),
          obtenerNombreCatalogo(catalogos.ubicaciones, aviso.id_ubicacion, 'Ubicación')
        ]
          .join(' ')
          .toLocaleLowerCase('es')
          .includes(consulta)
    );
    lista.replaceChildren();
    document.getElementById('avisos-conteo').textContent =
      `${visibles.length} de ${propios.length} avisos${visibles.length ? '' : '. No hay avisos para mostrar.'}`;
    for (const aviso of visibles.sort((a, b) => Number(b.id) - Number(a.id))) {
      const card = crearElemento('article', 'aviso-card');
      const cabecera = crearElemento('div', 'aviso-card__cabecera');
      cabecera.append(
        crearElemento('h2', '', aviso.titulo),
        crearElemento(
          'span',
          'badge',
          { activo: 'Activo', coincidencia: 'Con coincidencia', cerrado: 'Cerrado' }[
            aviso.estado
          ] ?? aviso.estado
        )
      );
      const acciones = crearElemento('div', 'acciones aviso-card__acciones');
      for (const [accion, texto] of [
        ['editar', 'Editar'],
        ['estado', aviso.estado === 'cerrado' ? 'Reabrir' : 'Cerrar aviso'],
        ['eliminar', 'Eliminar']
      ]) {
        const boton = crearElemento(
          'button',
          `boton ${accion === 'eliminar' ? 'boton--peligro' : 'boton--secundario'}`,
          texto
        );
        boton.type = 'button';
        boton.dataset.accion = accion;
        boton.dataset.id = aviso.id;
        boton.disabled = ocupado || (accion === 'editar' && !catalogosListos);
        acciones.append(boton);
      }
      const imprimir = crearElemento('a', 'boton boton--secundario', 'Ver cartel');
      imprimir.href = `aviso-imprimible.html?id=${encodeURIComponent(aviso.id)}`;
      acciones.append(imprimir);
      card.append(
        cabecera,
        crearElemento(
          'p',
          'aviso-card__datos',
          `${obtenerNombreCatalogo(catalogos.categorias, aviso.id_categoria, 'Categoría')} · ${obtenerNombreCatalogo(catalogos.ubicaciones, aviso.id_ubicacion, 'Ubicación')} · ${aviso.fecha_perdida}`
        ),
        crearElemento('p', '', aviso.descripcion),
        crearElemento('p', 'texto-suave', `Color: ${aviso.color}`),
        acciones
      );
      lista.append(card);
    }
  }

  async function cargar() {
    if (ocupado) return;
    ocupado = true;
    nuevo.disabled = true;
    recargar.disabled = true;
    mostrarMensaje(estado, 'Cargando tus avisos…');
    const [datos, cats] = await Promise.allSettled([api.get('avisos'), cargarCatalogos()]);
    const problemas = [];
    if (datos.status === 'fulfilled' && Array.isArray(datos.value)) avisos = datos.value;
    else
      problemas.push(
        'No se pudieron cargar tus avisos. Comprueba data/avisos.json y vuelve a intentar.'
      );
    catalogosListos = cats.status === 'fulfilled';
    if (catalogosListos) {
      catalogos = cats.value;
      llenarSelect(form.elements.id_categoria, catalogos.categorias, 'Selecciona una categoría');
      llenarSelect(form.elements.id_ubicacion, catalogos.ubicaciones, 'Selecciona una ubicación');
    } else
      problemas.push(
        'Faltan los catálogos de categorías y ubicaciones. Podrás crear y editar cuando se integren esos datos.'
      );
    ocupado = false;
    nuevo.disabled = !catalogosListos || datos.status !== 'fulfilled';
    recargar.disabled = false;
    mostrarMensaje(estado, problemas.join(' '), problemas.length > 0);
    render();
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

  nuevo.addEventListener('click', () => {
    if (!ocupado && catalogosListos) abrirEditor();
  });
  recargar.addEventListener('click', () => {
    cerrarEditor();
    cargar();
  });
  document.getElementById('cancelar-edicion').addEventListener('click', () => {
    if (!ocupado) {
      cerrarEditor();
      nuevo.focus();
    }
  });
  buscar.addEventListener('input', render);
  filtro.addEventListener('change', render);
  quitarFoto.addEventListener('click', () => {
    versionFoto++;
    fotoPendiente = false;
    guardar.disabled = false;
    form.elements.foto.value = '';
    actualizarFoto('');
  });

  form.elements.foto.addEventListener('change', async () => {
    const version = ++versionFoto;
    const archivo = form.elements.foto.files[0];
    if (!archivo) return;
    fotoPendiente = true;
    guardar.disabled = true;
    mostrarMensaje(estadoEditor, 'Comprobando foto…');
    try {
      const errorArchivo = validarArchivo(archivo);
      if (errorArchivo) throw new Error(errorArchivo);
      const datos = await new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result);
        lector.onerror = () => reject(new Error('No se pudo leer la foto.'));
        lector.readAsDataURL(archivo);
      });
      const imagen = new Image();
      imagen.src = datos;
      await imagen.decode();
      if (version !== versionFoto) return;
      actualizarFoto(datos);
      mostrarMensaje(estadoEditor, 'Foto lista. Guarda el aviso para conservarla.');
    } catch (error) {
      if (version !== versionFoto) return;
      form.elements.foto.value = '';
      mostrarMensaje(
        estadoEditor,
        error.name === 'EncodingError'
          ? 'El archivo no contiene una imagen válida.'
          : error.message,
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
    nuevo.disabled = true;
    recargar.disabled = true;
    render();
    try {
      comprobarSesion();
      const previo = editando ? await avisoPropio(editando.id) : null;
      const datos = Object.fromEntries(new FormData(form));
      if (
        !catalogos.categorias.some((cat) => String(cat.id) === datos.id_categoria) ||
        !catalogos.ubicaciones.some((ubicacion) => String(ubicacion.id) === datos.id_ubicacion)
      )
        throw new Error('Selecciona una categoría y una ubicación del catálogo.');
      const aviso = new Aviso({
        ...datos,
        ...(previo ? { id: previo.id } : {}),
        id_usuario: sesion.id,
        foto,
        estado: previo?.estado ?? 'activo'
      });
      const resultado = previo
        ? await api.put('avisos', previo.id, aviso.toJSON())
        : await api.post('avisos', aviso.toJSON());
      avisos = [...avisos.filter((item) => String(item.id) !== String(resultado.id)), resultado];
      cerrarEditor();
      mostrarMensaje(estado, 'Aviso guardado. Ya puedes consultar e imprimir su cartel.');
      nuevo.focus();
    } catch (error) {
      mostrarMensaje(
        estadoEditor,
        error.name === 'QuotaExceededError'
          ? 'No hay espacio para guardar la foto. Prueba con una imagen más pequeña.'
          : error.message,
        true
      );
    } finally {
      ocupado = false;
      guardar.disabled = false;
      nuevo.disabled = !catalogosListos;
      recargar.disabled = false;
      render();
    }
  });

  lista.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('button[data-accion]');
    if (!boton || ocupado) return;
    ocupado = true;
    nuevo.disabled = true;
    recargar.disabled = true;
    render();
    try {
      const aviso = await avisoPropio(boton.dataset.id);
      if (boton.dataset.accion === 'editar') {
        abrirEditor(aviso);
        return;
      }
      const eliminar = boton.dataset.accion === 'eliminar';
      const siguiente = aviso.estado === 'cerrado' ? 'activo' : 'cerrado';
      if (
        !(await confirmar(
          eliminar
            ? `¿Eliminar «${aviso.titulo}»? Esta acción no se puede deshacer.`
            : `¿${siguiente === 'cerrado' ? 'Cerrar' : 'Reabrir'} «${aviso.titulo}»?`
        ))
      )
        return;
      await avisoPropio(aviso.id);
      if (eliminar) {
        await api.delete('avisos', aviso.id);
        avisos = avisos.filter((item) => String(item.id) !== String(aviso.id));
      } else {
        const actualizado = await api.put('avisos', aviso.id, { estado: siguiente });
        avisos = avisos.map((item) => (String(item.id) === String(aviso.id) ? actualizado : item));
      }
      if (String(editando?.id) === String(aviso.id)) cerrarEditor();
      mostrarMensaje(
        estado,
        eliminar
          ? 'Aviso eliminado.'
          : `Aviso ${siguiente === 'cerrado' ? 'cerrado' : 'reabierto'}.`
      );
    } catch (error) {
      mostrarMensaje(estado, error.message, true);
    } finally {
      ocupado = false;
      nuevo.disabled = !catalogosListos;
      recargar.disabled = false;
      render();
    }
  });

  await cargar();
}
