/**
 * Resultados de un aviso: coincidencias con puntaje y botón "Reclamar".
 * Uso: resultados.html?aviso=<id>. Sin coincidencias, el aviso queda activo con su cartel.
 * Reclamar marca el objeto como 'reclamado' y el aviso como 'coincidencia';
 * el admin valida después con la característica oculta.
 */
import { api, cargarCatalogos } from '../api.js';
import { requireLogin, getSession } from '../session.js';
import { buscarCoincidencias } from '../matcher.js';
import { iniciarPagina, mostrarMensaje, crearElemento, crearTarjetaObjeto } from '../ui.js';

iniciarPagina();
const sesion = requireLogin();
if (sesion) await iniciarResultados();

async function iniciarResultados() {
  const titulo = document.getElementById('resultados-titulo');
  const resumen = document.getElementById('resultados-resumen');
  const mensaje = document.getElementById('resultados-mensaje');
  const lista = document.getElementById('lista-coincidencias');
  const dialogo = document.getElementById('confirmar-reclamo');
  let aviso;
  let ocupado = false;

  /**
   * Abre el diálogo de confirmación.
   * @param {string} texto
   * @returns {Promise<boolean>}
   */
  function confirmar(texto) {
    document.getElementById('reclamo-texto').textContent = texto;
    dialogo.returnValue = 'cancelar';
    return new Promise((resolve) => {
      dialogo.addEventListener('close', () => resolve(dialogo.returnValue === 'confirmar'), {
        once: true
      });
      dialogo.showModal();
    });
  }

  function mostrarSinCoincidencias() {
    document.getElementById('enlace-cartel').href =
      `aviso-imprimible.html?id=${encodeURIComponent(aviso.id)}`;
    document.getElementById('sin-coincidencias').hidden = false;
  }

  /**
   * @param {Array<{objeto: object, puntaje: number}>} coincidencias
   * @param {{categorias: object[], ubicaciones: object[]}} catalogos
   */
  function mostrarCoincidencias(coincidencias, catalogos) {
    lista.replaceChildren(
      ...coincidencias.map(({ objeto, puntaje }) => {
        const card = crearTarjetaObjeto(objeto, catalogos);
        const pie = crearElemento('div', 'acciones coincidencia__pie');
        const badge = crearElemento('span', 'badge coincidencia__puntaje', `${puntaje}% de coincidencia`);
        const boton = crearElemento('button', 'boton', 'Reclamar');
        boton.type = 'button';
        boton.dataset.id = objeto.id;
        boton.dataset.nombre = objeto.nombre;
        pie.append(badge, boton);
        card.append(pie);
        return card;
      })
    );
    document.getElementById('con-coincidencias').hidden = false;
  }

  lista.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('button[data-id]');
    if (!boton || ocupado) return;
    if (!(await confirmar(`¿Este es tu objeto? «${boton.dataset.nombre}»`))) return;
    ocupado = true;
    boton.disabled = true;
    try {
      if (String(getSession()?.id) !== String(sesion.id))
        throw new Error('La sesión cambió. Recarga la página.');
      const objeto = await api.get('encontrados', boton.dataset.id);
      if (objeto.estado !== 'disponible')
        throw new Error('Otra persona ya reclamó este objeto. Tu aviso sigue activo.');
      await api.put('encontrados', objeto.id, { estado: 'reclamado' });
      aviso = await api.put('avisos', aviso.id, { estado: 'coincidencia' });
      lista.querySelectorAll('button[data-id]').forEach((otro) => {
        otro.disabled = true;
      });
      boton.textContent = 'Reclamado';
      mostrarMensaje(
        mensaje,
        `Reclamaste «${objeto.nombre}». Acude a la oficina de objetos perdidos con tu identificación; te pedirán la característica oculta.`
      );
    } catch (error) {
      boton.disabled = false;
      mostrarMensaje(mensaje, error.message, true);
    } finally {
      ocupado = false;
    }
  });

  const id = new URLSearchParams(location.search).get('aviso');
  if (!id) {
    titulo.textContent = 'Falta el aviso';
    mostrarMensaje(mensaje, 'Primero reporta tu objeto perdido.', true);
    return;
  }

  try {
    const [avisoLeido, encontrados, catalogos] = await Promise.all([
      api.get('avisos', id),
      api.get('encontrados'),
      cargarCatalogos()
    ]);
    if (String(avisoLeido.id_usuario) !== String(sesion.id))
      throw new Error('Este aviso no pertenece a tu cuenta.');
    aviso = avisoLeido;
    resumen.textContent = `Tu aviso: «${aviso.titulo}», perdido el ${aviso.fecha_perdida}.`;

    if (aviso.estado !== 'activo') {
      titulo.textContent =
        aviso.estado === 'coincidencia' ? 'Ya reclamaste un objeto' : 'Este aviso está cerrado';
      mostrarMensaje(
        mensaje,
        aviso.estado === 'coincidencia'
          ? 'Acude a la oficina de objetos perdidos para validar tu reclamación.'
          : 'Reabre el aviso desde Mis avisos para volver a buscar.'
      );
      return;
    }

    const coincidencias = buscarCoincidencias(aviso, encontrados);
    if (coincidencias.length) {
      titulo.textContent = `Encontramos ${coincidencias.length} posible${coincidencias.length === 1 ? '' : 's'} coincidencia${coincidencias.length === 1 ? '' : 's'}`;
      mostrarCoincidencias(coincidencias, catalogos);
    } else {
      titulo.textContent = 'Sin coincidencias por ahora';
      mostrarSinCoincidencias();
    }
    mostrarMensaje(mensaje, '');
  } catch (error) {
    titulo.textContent = 'No se pudieron cargar los resultados';
    mostrarMensaje(
      mensaje,
      error.status === 404 ? 'El aviso no existe o fue eliminado.' : error.message,
      true
    );
  }
}
