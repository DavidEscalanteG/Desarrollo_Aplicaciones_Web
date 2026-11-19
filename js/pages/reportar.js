/**
 * Ficha de objeto perdido: validación, foto con preview y drag & drop, borrador autoguardado.
 * Al enviar crea el aviso (estado 'activo') y abre resultados.html?aviso=<id>.
 */
import { api, cargarCatalogos } from '../api.js';
import { requireLogin, getSession, getCsrfToken } from '../session.js';
import { saveDraft, loadDraft, clearDraft } from '../storage.js';
import { fechaHoy, validarArchivo } from '../validators.js';
import { Aviso } from '../models/Aviso.js';
import { iniciarPagina, mostrarMensaje, llenarSelect } from '../ui.js';

/** Campos de texto que se guardan en el borrador (la foto no: puede pesar 2 MB). */
const CAMPOS = [
  'titulo',
  'id_categoria',
  'id_ubicacion',
  'fecha_perdida',
  'color',
  'descripcion',
  'caracteristica_oculta'
];

iniciarPagina();
const sesion = requireLogin();
if (sesion) await iniciarReportar();

async function iniciarReportar() {
  const form = document.getElementById('form-reportar');
  const mensaje = document.getElementById('reportar-mensaje');
  const enviar = document.getElementById('enviar');
  const zona = document.getElementById('zona-arrastre');
  const inputFoto = form.elements.foto;
  const preview = document.getElementById('foto-preview');
  const quitarFoto = document.getElementById('quitar-foto');
  const estadoBorrador = document.getElementById('borrador-estado');
  let catalogos = { categorias: [], ubicaciones: [] };
  let foto = '';
  let versionFoto = 0;
  let ocupado = false;

  form.elements.fecha_perdida.max = fechaHoy();

  // ---- Errores por campo ----

  function marcarError(campo, texto) {
    const salida = document.getElementById(`error-${campo}`);
    if (salida) {
      salida.textContent = texto;
      salida.hidden = !texto;
    }
    form.elements[campo]?.setAttribute('aria-invalid', String(Boolean(texto)));
  }

  function limpiarErrores() {
    [...CAMPOS, 'foto'].forEach((campo) => marcarError(campo, ''));
  }

  // ---- Foto: input, drag & drop y preview ----

  function ponerFoto(valor) {
    foto = valor;
    preview.hidden = !foto;
    quitarFoto.hidden = !foto;
    preview.src = foto || 'assets/img/aviso-sin-foto.svg';
  }

  /**
   * Valida tipo/tamaño, lee como data URL y comprueba que sea una imagen real.
   * @param {File|undefined} archivo
   */
  async function procesarFoto(archivo) {
    const version = ++versionFoto;
    marcarError('foto', '');
    if (!archivo) return;
    enviar.disabled = true;
    try {
      const error = validarArchivo(archivo);
      if (error) throw new Error(error);
      const datos = await new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.addEventListener('load', () => resolve(lector.result));
        lector.addEventListener('error', () => reject(new Error('No se pudo leer la foto.')));
        lector.readAsDataURL(archivo);
      });
      const imagen = new Image();
      imagen.src = datos;
      await imagen.decode();
      if (version === versionFoto) ponerFoto(datos);
    } catch (error) {
      if (version !== versionFoto) return;
      inputFoto.value = '';
      ponerFoto('');
      marcarError(
        'foto',
        error.name === 'EncodingError' ? 'El archivo no contiene una imagen válida.' : error.message
      );
    } finally {
      if (version === versionFoto) enviar.disabled = false;
    }
  }

  inputFoto.addEventListener('change', () => procesarFoto(inputFoto.files[0]));

  quitarFoto.addEventListener('click', () => {
    versionFoto++;
    inputFoto.value = '';
    ponerFoto('');
    marcarError('foto', '');
  });

  ['dragenter', 'dragover'].forEach((tipo) =>
    zona.addEventListener(tipo, (evento) => {
      evento.preventDefault();
      zona.classList.add('zona-arrastre--activa');
    })
  );
  ['dragleave', 'drop'].forEach((tipo) =>
    zona.addEventListener(tipo, () => zona.classList.remove('zona-arrastre--activa'))
  );
  zona.addEventListener('drop', (evento) => {
    evento.preventDefault();
    const archivos = evento.dataTransfer.files;
    if (archivos.length !== 1) {
      marcarError('foto', 'Arrastra una sola foto.');
      return;
    }
    procesarFoto(archivos[0]);
  });

  // ---- Borrador en localStorage ----

  function guardarBorrador() {
    const datos = Object.fromEntries(CAMPOS.map((campo) => [campo, form.elements[campo].value]));
    const hayAlgo = Object.values(datos).some((valor) => valor.trim());
    if (!hayAlgo) {
      clearDraft();
      estadoBorrador.textContent = '';
      return;
    }
    estadoBorrador.textContent = saveDraft(datos)
      ? `Borrador guardado a las ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}.`
      : 'No se pudo guardar el borrador en este navegador.';
  }

  function restaurarBorrador() {
    const borrador = loadDraft();
    if (!borrador || typeof borrador !== 'object') return;
    CAMPOS.forEach((campo) => {
      if (typeof borrador[campo] === 'string') form.elements[campo].value = borrador[campo];
    });
    estadoBorrador.textContent = 'Recuperamos el borrador que dejaste pendiente.';
  }

  form.addEventListener('input', (evento) => {
    if (evento.target === inputFoto) return;
    marcarError(evento.target.name, '');
    guardarBorrador();
  });

  document.getElementById('descartar').addEventListener('click', () => {
    clearDraft();
    form.reset();
    form.elements.csrf_token.value = getCsrfToken();
    versionFoto++;
    ponerFoto('');
    limpiarErrores();
    estadoBorrador.textContent = 'Borrador descartado.';
  });

  // ---- Envío ----

  function enCatalogo(lista, id) {
    return lista.some((item) => String(item.id) === String(id));
  }

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (ocupado) return;
    limpiarErrores();
    mostrarMensaje(mensaje, '');

    if (String(getSession()?.id) !== String(sesion.id)) {
      mostrarMensaje(mensaje, 'La sesión cambió. Recarga la página antes de continuar.', true);
      return;
    }
    if (form.elements.csrf_token.value !== getCsrfToken()) {
      mostrarMensaje(mensaje, 'El formulario caducó. Recarga la página.', true);
      return;
    }

    const datos = Object.fromEntries(CAMPOS.map((campo) => [campo, form.elements[campo].value]));
    const aviso = new Aviso({ ...datos, id_usuario: sesion.id, foto, estado: 'activo' });
    const errores = aviso.validar();
    if (!enCatalogo(catalogos.categorias, datos.id_categoria))
      errores.id_categoria = 'Selecciona una categoría de la lista.';
    if (!enCatalogo(catalogos.ubicaciones, datos.id_ubicacion))
      errores.id_ubicacion = 'Selecciona una ubicación de la lista.';

    const campos = Object.keys(errores).filter((campo) => CAMPOS.includes(campo) || campo === 'foto');
    if (campos.length) {
      campos.forEach((campo) => marcarError(campo, errores[campo]));
      mostrarMensaje(mensaje, 'Revisa los campos marcados.', true);
      form.elements[campos[0]].focus();
      return;
    }

    ocupado = true;
    enviar.disabled = true;
    mostrarMensaje(mensaje, 'Buscando coincidencias…');
    try {
      const creado = await api.post('avisos', aviso.toJSON());
      clearDraft();
      location.href = `resultados.html?aviso=${encodeURIComponent(creado.id)}`;
    } catch (error) {
      mostrarMensaje(
        mensaje,
        error.name === 'QuotaExceededError'
          ? 'No hay espacio para guardar la foto. Prueba con una imagen más pequeña.'
          : error.message,
        true
      );
      ocupado = false;
      enviar.disabled = false;
    }
  });

  // ---- Carga inicial ----

  try {
    catalogos = await cargarCatalogos();
    llenarSelect(form.elements.id_categoria, catalogos.categorias, 'Selecciona una categoría');
    llenarSelect(form.elements.id_ubicacion, catalogos.ubicaciones, 'Selecciona una ubicación');
    restaurarBorrador();
    mostrarMensaje(mensaje, '');
    enviar.disabled = false;
  } catch (error) {
    mostrarMensaje(mensaje, `No se pudieron cargar los catálogos: ${error.message}`, true);
  }
}
