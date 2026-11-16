/**
 * Página de prueba de la Fase 1. Temporal: no va en el ZIP final.
 */
import { api } from '../api.js';
import { login, logout, renderHeader } from '../session.js';

const USUARIOS_PRUEBA = {
  usuario: { id: 2, nombre: 'Ana López', correo: 'ana@campus.mx', rol: 'usuario' },
  admin: { id: 1, nombre: 'Admin Campus', correo: 'admin@campus.mx', rol: 'admin' }
};

document.querySelectorAll('[data-simular]').forEach((boton) => {
  boton.addEventListener('click', () => {
    const rol = boton.dataset.simular;
    if (rol) login(USUARIOS_PRUEBA[rol]);
    else logout();
    location.reload();
  });
});

renderHeader();

const estado = document.getElementById('estado-categorias');
const lista = document.getElementById('lista-categorias');

try {
  const categorias = await api.get('categorias');
  categorias.forEach((c) => {
    const li = document.createElement('li');
    li.textContent = c.nombre;
    lista.append(li);
  });
  estado.textContent = `${categorias.length} categorías cargadas.`;
} catch (error) {
  estado.textContent = error.message;
}
