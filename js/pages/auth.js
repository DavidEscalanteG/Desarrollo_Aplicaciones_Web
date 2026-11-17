import { MODO_MOCK, CLAVES } from '../config.js';
import { api } from '../api.js';
import { correoValido } from '../validators.js';
import { login, getSession, getCsrfToken, destinoLocal } from '../session.js';
import { getCookie, setCookie, deleteCookie } from '../storage.js';
import { iniciarPagina, mostrarMensaje } from '../ui.js';

const DEMO = [
  { id: 2, nombre: 'Ana López', correo: 'ana@campus.mx', rol: 'usuario' },
  { id: 1, nombre: 'Admin Campus', correo: 'admin@campus.mx', rol: 'admin' }
];
const CLAVE_USUARIOS = 'mock_usuarios';
const destino = destinoLocal(new URLSearchParams(location.search).get('volver'));
const formulario = document.querySelector('#form-login, #form-registro');
const estado = document.getElementById('auth-mensaje');
const esRegistro = formulario.id === 'form-registro';

iniciarPagina();
if (getSession()) location.replace(destino);
document.getElementById('cuentas-demo')?.toggleAttribute('hidden', !MODO_MOCK);
document.getElementById('registro-demo')?.toggleAttribute('hidden', !MODO_MOCK);
const enlace = document.querySelector('#enlace-login, #enlace-registro');
enlace.href = `${esRegistro ? 'login.html' : 'registro.html'}?volver=${encodeURIComponent(destino)}`;

if (!esRegistro) {
  try {
    const recordado = getCookie(CLAVES.recordarCorreo);
    if (recordado) {
      formulario.elements.correo.value = recordado;
      formulario.elements.recordar.checked = true;
    }
  } catch {
    /* Una cookie inválida no bloquea el acceso. */
  }
}

/** Hash solo para evitar guardar contraseñas de prueba en texto claro. */
async function resumen(password) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cuentasLocales() {
  const cuentas = JSON.parse(sessionStorage.getItem(CLAVE_USUARIOS) || '[]');
  if (!Array.isArray(cuentas))
    throw new Error('Las cuentas de prueba están dañadas. Cierra esta pestaña y vuelve a abrirla.');
  return cuentas;
}

async function autenticarMock(correo, password) {
  const demo = DEMO.find((cuenta) => cuenta.correo === correo);
  if (demo && password === 'Campus123!') return demo;
  const hash = await resumen(password);
  const usuario = cuentasLocales().find(
    (cuenta) => cuenta.correo === correo && cuenta.password_hash === hash
  );
  if (!usuario) throw new Error('El correo o la contraseña no son correctos.');
  return usuario;
}

async function registrarMock(nombre, correo, password) {
  const cuentas = cuentasLocales();
  if ([...DEMO, ...cuentas].some((cuenta) => cuenta.correo === correo))
    throw new Error('Ya existe una cuenta con ese correo.');
  const usuario = {
    id: Date.now(),
    nombre,
    correo,
    rol: 'usuario',
    password_hash: await resumen(password)
  };
  sessionStorage.setItem(CLAVE_USUARIOS, JSON.stringify([...cuentas, usuario]));
  return usuario;
}

formulario.addEventListener('input', () => {
  if (esRegistro) formulario.elements.confirmar.setCustomValidity('');
  formulario.elements.correo.setCustomValidity('');
});

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const boton = formulario.querySelector('[type="submit"]');
  if (boton.disabled) return;
  const correo = formulario.elements.correo.value.trim().toLowerCase();
  const password = formulario.elements.password.value;
  formulario.elements.correo.value = correo;
  formulario.elements.correo.setCustomValidity(
    correoValido(correo) ? '' : 'Escribe un correo válido.'
  );
  if (esRegistro)
    formulario.elements.confirmar.setCustomValidity(
      password === formulario.elements.confirmar.value ? '' : 'Las contraseñas no coinciden.'
    );
  if (!formulario.reportValidity()) return;
  boton.disabled = true;
  mostrarMensaje(estado, esRegistro ? 'Creando tu cuenta…' : 'Iniciando sesión…');
  try {
    if (formulario.elements.csrf_token.value !== getCsrfToken())
      throw new Error('La sesión del formulario cambió. Recarga la página.');
    const nombre = esRegistro ? formulario.elements.nombre.value.trim() : '';
    if (esRegistro && nombre.length < 2)
      throw new Error('Escribe un nombre de al menos dos caracteres.');
    const usuario = MODO_MOCK
      ? await (esRegistro
          ? registrarMock(nombre, correo, password)
          : autenticarMock(correo, password))
      : await api.post(esRegistro ? 'registro' : 'login', {
          ...(esRegistro ? { nombre } : {}),
          correo,
          password
        });
    login(usuario);
    if (!esRegistro && formulario.elements.recordar.checked)
      setCookie(CLAVES.recordarCorreo, correo);
    else deleteCookie(CLAVES.recordarCorreo);
    location.assign(destino);
  } catch (error) {
    mostrarMensaje(estado, error.message || 'No se pudo completar el acceso.', true);
    boton.disabled = false;
  }
});
