import { longitudValida, fechaNoFutura, fotoValida } from '../validators.js';

const ESTADOS = ['disponible', 'reclamado', 'entregado'];
const limpiar = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const esId = (valor) => Number.isSafeInteger(Number(valor)) && Number(valor) > 0;

/** Objeto encontrado en el campus. */
export class ObjetoEncontrado {
  /** @param {object} [datos={}] Campos del contrato de encontrados. */
  constructor(datos = {}) {
    if (datos.id !== undefined && datos.id !== '') this.id = Number(datos.id);
    this.nombre = limpiar(datos.nombre);
    this.id_categoria = Number(datos.id_categoria);
    this.id_ubicacion = Number(datos.id_ubicacion);
    this.fecha_hallazgo = limpiar(datos.fecha_hallazgo);
    this.color = limpiar(datos.color);
    this.descripcion = limpiar(datos.descripcion);
    this.foto = limpiar(datos.foto);
    this.estado = datos.estado || 'disponible';
  }

  /** @returns {Object<string, string>} Errores por campo; vacío si es válido. */
  validar() {
    const errores = {};
    if (this.id !== undefined && !esId(this.id)) errores.id = 'Identificador inválido.';
    if (!longitudValida(this.nombre, 3, 100))
      errores.nombre = 'El nombre debe tener entre 3 y 100 caracteres.';
    if (!esId(this.id_categoria)) errores.id_categoria = 'Elige una categoría.';
    if (!esId(this.id_ubicacion)) errores.id_ubicacion = 'Elige una ubicación.';
    if (!fechaNoFutura(this.fecha_hallazgo))
      errores.fecha_hallazgo = 'Indica una fecha de hallazgo válida que no sea futura.';
    if (!longitudValida(this.color, 2, 40))
      errores.color = 'El color debe tener entre 2 y 40 caracteres.';
    if (!longitudValida(this.descripcion, 10, 1000))
      errores.descripcion = 'La descripción debe tener entre 10 y 1000 caracteres.';
    if (!ESTADOS.includes(this.estado)) errores.estado = 'Estado inválido.';
    if (!fotoValida(this.foto)) errores.foto = 'La foto no es válida o pesa más de 2 MB.';
    return errores;
  }

  /** @returns {boolean} */
  esValido() {
    return Object.keys(this.validar()).length === 0;
  }

  /** @returns {object} Datos listos para guardar; lanza error si algo es inválido. */
  toJSON() {
    const errores = Object.values(this.validar());
    if (errores.length) throw new Error(errores.join(' '));
    return {
      ...(this.id === undefined ? {} : { id: this.id }),
      nombre: this.nombre,
      id_categoria: this.id_categoria,
      id_ubicacion: this.id_ubicacion,
      fecha_hallazgo: this.fecha_hallazgo,
      color: this.color,
      descripcion: this.descripcion,
      foto: this.foto,
      estado: this.estado
    };
  }
}

export default ObjetoEncontrado;
