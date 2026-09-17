/*
 * columnas.js — Definición de las columnas del listado de alumnos.
 * Compartida por la tabla en pantalla y la exportación a Excel.
 *   key      identificador
 *   label    cabecera
 *   grupo    bloque al que pertenece (para el selector de columnas)
 *   visible  se muestra por defecto en pantalla
 *   width    ancho en Excel (caracteres)
 *   get      valor a partir de la matrícula
 *   type     'text' | 'number' | 'date' (orden y formato)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Columnas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const t = (fn) => (m) => (fn(m) == null ? '' : fn(m));
  const tutor = (n, campo) => (m) => (m[`tutor${n}`] ? m[`tutor${n}`][campo] || '' : '');

  const COLUMNAS = [
    // Matrícula
    { key: 'cicloClave', label: 'Clave ciclo', grupo: 'Matrícula', visible: true, width: 11, get: t((m) => m.cicloClave) },
    { key: 'cicloNombre', label: 'Ciclo formativo', grupo: 'Matrícula', visible: true, width: 44, get: t((m) => m.cicloNombre) },
    { key: 'cursoCorto', label: 'Curso', grupo: 'Matrícula', visible: true, width: 7, get: t((m) => m.cursoCorto), sortKey: (m) => m.cursoId },
    { key: 'grupo', label: 'Grupo', grupo: 'Matrícula', visible: true, width: 9, get: t((m) => m.grupo) },
    { key: 'turnoNombre', label: 'Turno', grupo: 'Matrícula', visible: true, width: 11, get: t((m) => m.turnoNombre) },
    { key: 'estadoMatricula', label: 'Estado matrícula', grupo: 'Matrícula', visible: false, width: 16, get: t((m) => m.estadoMatricula) },
    { key: 'regimen', label: 'Régimen', grupo: 'Matrícula', visible: false, width: 11, get: t((m) => m.regimen) },
    { key: 'nModulos', label: 'Nº módulos', grupo: 'Matrícula', visible: false, width: 10, get: t((m) => m.nModulos), type: 'number' },

    // Alumno
    { key: 'apellido1', label: 'Apellido 1', grupo: 'Alumno', visible: true, width: 18, get: t((m) => m.apellido1) },
    { key: 'apellido2', label: 'Apellido 2', grupo: 'Alumno', visible: true, width: 18, get: t((m) => m.apellido2) },
    { key: 'nombre', label: 'Nombre', grupo: 'Alumno', visible: true, width: 18, get: t((m) => m.nombre) },
    { key: 'tipoDocumento', label: 'Tipo doc.', grupo: 'Alumno', visible: false, width: 9, get: t((m) => m.tipoDocumento) },
    { key: 'documento', label: 'Documento', grupo: 'Alumno', visible: true, width: 13, get: t((m) => m.documento) },
    { key: 'cie', label: 'CIE', grupo: 'Alumno', visible: false, width: 18, get: t((m) => m.cie) },
    { key: 'fechaNac', label: 'Fecha nac.', grupo: 'Alumno', visible: true, width: 12, get: t((m) => m.fechaNacEs), sortKey: (m) => m.fechaNac, type: 'date' },
    { key: 'edad', label: 'Edad', grupo: 'Alumno', visible: true, width: 6, get: t((m) => m.edad), type: 'number' },
    { key: 'menor', label: 'Menor', grupo: 'Alumno', visible: false, width: 7, get: t((m) => m.menor) },
    { key: 'genero', label: 'Género', grupo: 'Alumno', visible: false, width: 9, get: t((m) => m.genero) },
    { key: 'nacionalidad', label: 'Nacionalidad', grupo: 'Alumno', visible: false, width: 14, get: t((m) => m.nacionalidad) },
    { key: 'paisNac', label: 'País nac.', grupo: 'Alumno', visible: false, width: 12, get: t((m) => m.paisNac) },
    { key: 'localidadNac', label: 'Localidad nac.', grupo: 'Alumno', visible: false, width: 18, get: t((m) => m.localidadNac) },
    { key: 'emancipado', label: 'Emancipado', grupo: 'Alumno', visible: false, width: 11, get: t((m) => m.emancipado) },

    // Contacto
    { key: 'email', label: 'Email', grupo: 'Contacto', visible: true, width: 30, get: t((m) => m.email) },
    { key: 'telefono1', label: 'Teléfono 1', grupo: 'Contacto', visible: true, width: 12, get: t((m) => m.telefono1) },
    { key: 'telefono2', label: 'Teléfono 2', grupo: 'Contacto', visible: false, width: 12, get: t((m) => m.telefono2) },
    { key: 'domicilio', label: 'Domicilio', grupo: 'Contacto', visible: false, width: 36, get: t((m) => m.domicilio) },
    { key: 'codigoPostal', label: 'C.P.', grupo: 'Contacto', visible: false, width: 7, get: t((m) => m.codigoPostal) },
    { key: 'localidad', label: 'Localidad', grupo: 'Contacto', visible: true, width: 22, get: t((m) => m.localidad) },
    { key: 'municipio', label: 'Municipio', grupo: 'Contacto', visible: false, width: 22, get: t((m) => m.municipio) },
    { key: 'provincia', label: 'Provincia', grupo: 'Contacto', visible: false, width: 14, get: t((m) => m.provincia) },

    // Sanitario
    { key: 'nuss', label: 'NUSS', grupo: 'Sanitario', visible: false, width: 14, get: t((m) => m.nuss) },
    { key: 'aseguradora', label: 'Aseguradora', grupo: 'Sanitario', visible: false, width: 18, get: t((m) => m.aseguradora) },
    { key: 'tarjetaSanitaria', label: 'Tarjeta sanitaria', grupo: 'Sanitario', visible: false, width: 16, get: t((m) => m.tarjetaSanitaria) },

    // Tutores
    { key: 'tutor1Nombre', label: 'Tutor 1', grupo: 'Tutores', visible: false, width: 30, get: tutor(1, 'nombreCompleto') },
    { key: 'tutor1Parentesco', label: 'Parentesco 1', grupo: 'Tutores', visible: false, width: 12, get: tutor(1, 'parentesco') },
    { key: 'tutor1Documento', label: 'Documento tutor 1', grupo: 'Tutores', visible: false, width: 14, get: tutor(1, 'documento') },
    { key: 'tutor1Telefono', label: 'Teléfono tutor 1', grupo: 'Tutores', visible: false, width: 14, get: tutor(1, 'telefono1') },
    { key: 'tutor1Email', label: 'Email tutor 1', grupo: 'Tutores', visible: false, width: 30, get: tutor(1, 'email') },
    { key: 'tutor2Nombre', label: 'Tutor 2', grupo: 'Tutores', visible: false, width: 30, get: tutor(2, 'nombreCompleto') },
    { key: 'tutor2Parentesco', label: 'Parentesco 2', grupo: 'Tutores', visible: false, width: 12, get: tutor(2, 'parentesco') },
    { key: 'tutor2Documento', label: 'Documento tutor 2', grupo: 'Tutores', visible: false, width: 14, get: tutor(2, 'documento') },
    { key: 'tutor2Telefono', label: 'Teléfono tutor 2', grupo: 'Tutores', visible: false, width: 14, get: tutor(2, 'telefono1') },
    { key: 'tutor2Email', label: 'Email tutor 2', grupo: 'Tutores', visible: false, width: 30, get: tutor(2, 'email') },
  ];

  const porKey = Object.fromEntries(COLUMNAS.map((c) => [c.key, c]));

  /** Comparador para ordenar por una columna. */
  function comparador(col, dir) {
    const sign = dir === 'desc' ? -1 : 1;
    const val = col.sortKey || col.get;
    return (a, b) => {
      const va = val(a);
      const vb = val(b);
      const emptyA = va === '' || va == null;
      const emptyB = vb === '' || vb == null;
      if (emptyA && emptyB) return a.sortKey.localeCompare(b.sortKey, 'es');
      if (emptyA) return 1; // vacíos siempre al final
      if (emptyB) return -1;
      let r;
      if (typeof va === 'number' && typeof vb === 'number') r = va - vb;
      else r = String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' });
      if (r === 0) r = a.sortKey.localeCompare(b.sortKey, 'es');
      return r * sign;
    };
  }

  return { COLUMNAS, porKey, comparador };
});
