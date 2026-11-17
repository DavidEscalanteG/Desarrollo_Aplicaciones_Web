import { longitudValida, fechaNoFutura, fotoValida } from '../validators.js';

const ESTADOS = ['activo', 'coincidencia', 'cerrado'];
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const idValido = (valor) => Number.isSafeInteger(Number(valor)) && Number(valor) > 0;

/** Aviso de búsqueda. No persiste ni genera identificadores por su cuenta. */
export class Aviso {
  /** @param {object} [datos={}] Campos del contrato compartido de avisos. */
  constructor(datos = {}) {
    if (datos.id !== undefined) this.id = Number(datos.id);
    this.id_usuario = Number(datos.id_usuario);
    this.titulo = texto(datos.titulo);
    this.id_categoria = Number(datos.id_categoria);
    this.id_ubicacion = Number(datos.id_ubicacion);
    this.fecha_perdida = texto(datos.fecha_perdida);
    this.color = texto(datos.color);
    this.descripcion = texto(datos.descripcion);
    this.caracteristica_oculta = texto(datos.caracteristica_oculta);
    this.foto = texto(datos.foto);
    this.estado = datos.estado ?? 'activo';
  }

  /** @returns {Object<string, string>} Errores por campo; vacío si es válido. */
  validar() {
    const errores = {};
    if (this.id !== undefined && !idValido(this.id)) errores.id = 'Identificador inválido.';
    for (const campo of ['id_usuario', 'id_categoria', 'id_ubicacion']) {
      if (!idValido(this[campo])) errores[campo] = 'Selecciona una opción válida.';
    }
    for (const [campo, min, max, etiqueta] of [
      ['titulo', 3, 100, 'El título'],
      ['color', 2, 40, 'El color'],
      ['descripcion', 10, 1000, 'La descripción'],
      ['caracteristica_oculta', 5, 300, 'La característica oculta']
    ]) {
      if (!longitudValida(this[campo], min, max)) {
        errores[campo] = `${etiqueta} debe tener entre ${min} y ${max} caracteres.`;
      }
    }
    if (!fechaNoFutura(this.fecha_perdida)) {
      errores.fecha_perdida = 'Indica una fecha válida que no sea futura.';
    }
    if (!ESTADOS.includes(this.estado)) errores.estado = 'Estado de aviso inválido.';
    if (!fotoValida(this.foto))
      errores.foto = 'La foto debe ser una imagen local válida de hasta 2 MB.';
    return errores;
  }

  /** @returns {object} Datos del contrato compartido, sin campos adicionales. */
  toJSON() {
    const errores = this.validar();
    if (Object.keys(errores).length) throw new Error(Object.values(errores).join(' '));
    return {
      ...(this.id === undefined ? {} : { id: this.id }),
      id_usuario: this.id_usuario,
      titulo: this.titulo,
      id_categoria: this.id_categoria,
      id_ubicacion: this.id_ubicacion,
      fecha_perdida: this.fecha_perdida,
      color: this.color,
      descripcion: this.descripcion,
      caracteristica_oculta: this.caracteristica_oculta,
      foto: this.foto,
      estado: this.estado
    };
  }
}

export default Aviso;
