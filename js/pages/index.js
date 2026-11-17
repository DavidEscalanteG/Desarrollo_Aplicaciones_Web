import { api } from '../api.js';
import { fotoValida } from '../validators.js';
import { iniciarPagina, crearElemento, mostrarMensaje, obtenerNombreCatalogo } from '../ui.js';

iniciarPagina();
const estado = document.getElementById('portada-estado');
const lista = document.getElementById('ultimos-objetos');
const reintentar = document.getElementById('reintentar-portada');

async function cargarUltimos() {
  reintentar.hidden = true;
  lista.replaceChildren();
  mostrarMensaje(estado, 'Cargando objetos…');
  const [objetos, categorias, ubicaciones] = await Promise.allSettled([
    api.get('encontrados'),
    api.get('categorias'),
    api.get('ubicaciones')
  ]);
  if (objetos.status !== 'fulfilled' || !Array.isArray(objetos.value)) {
    mostrarMensaje(
      estado,
      'No pudimos cargar los objetos encontrados. Comprueba que data/encontrados.json esté integrado y que estés usando un servidor local.',
      true
    );
    reintentar.hidden = false;
    return;
  }
  const ultimos = objetos.value
    .filter((objeto) => objeto.estado === 'disponible')
    .sort((a, b) => b.fecha_hallazgo.localeCompare(a.fecha_hallazgo) || Number(b.id) - Number(a.id))
    .slice(0, 6);
  const cats =
    categorias.status === 'fulfilled' && Array.isArray(categorias.value) ? categorias.value : [];
  const lugares =
    ubicaciones.status === 'fulfilled' && Array.isArray(ubicaciones.value) ? ubicaciones.value : [];
  for (const objeto of ultimos) {
    const card = crearElemento('article', 'objeto-card');
    const imagen = crearElemento('img');
    imagen.src =
      objeto.foto && fotoValida(objeto.foto) ? objeto.foto : 'assets/img/aviso-sin-foto.svg';
    imagen.alt = objeto.nombre;
    imagen.loading = 'lazy';
    imagen.addEventListener(
      'error',
      () => {
        imagen.src = 'assets/img/aviso-sin-foto.svg';
      },
      { once: true }
    );
    const enlace = crearElemento('a', '', 'Ver en el catálogo');
    enlace.href = `catalogo.html?q=${encodeURIComponent(objeto.nombre)}`;
    card.append(
      imagen,
      crearElemento('h3', '', objeto.nombre),
      crearElemento(
        'p',
        'texto-suave',
        `${obtenerNombreCatalogo(cats, objeto.id_categoria, 'Categoría')} · ${obtenerNombreCatalogo(lugares, objeto.id_ubicacion, 'Ubicación')}`
      ),
      crearElemento('p', '', `Encontrado: ${objeto.fecha_hallazgo}`),
      enlace
    );
    lista.append(card);
  }
  mostrarMensaje(
    estado,
    ultimos.length
      ? ''
      : 'Todavía no hay objetos disponibles. Puedes publicar un aviso de búsqueda.'
  );
}

reintentar.addEventListener('click', cargarUltimos);
document.getElementById('buscador-portada').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const consulta = document.getElementById('busqueda').value.trim();
  location.assign(`catalogo.html${consulta ? `?q=${encodeURIComponent(consulta)}` : ''}`);
});
await cargarUltimos();
