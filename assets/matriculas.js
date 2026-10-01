/*
 * matriculas.js — Lectura del fichero matriculas.xml exportado desde Stylus
 * y construcción del modelo de datos (alumnos, grupos, hojas de clase).
 *
 * Sin dependencias. Funciona en el navegador (DOMParser nativo) y en Node
 * (pasando un DOMParser compatible) para poder probarlo.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Matriculas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TURNOS = { D: 'Diurno', V: 'Vespertino', N: 'Nocturno', M: 'Matutino', T: 'Tarde' };

  function asText(value) {
    if (value == null) return '';
    return String(value).replace(/\s+/g, ' ').trim();
  }

  function upper(value) {
    return asText(value).toLocaleUpperCase('es-ES');
  }

  /* ---------- Decodificación del fichero ---------- */

  function sniffEncoding(bytes) {
    const head = new Uint8Array(bytes.slice(0, 300));
    let ascii = '';
    for (let i = 0; i < head.length; i += 1) ascii += String.fromCharCode(head[i]);
    const m = ascii.match(/encoding\s*=\s*["']([^"']+)["']/i);
    return m ? m[1].trim().toLowerCase() : 'utf-8';
  }

  function decodeXml(arrayBuffer) {
    const label = sniffEncoding(arrayBuffer);
    let decoder;
    try {
      decoder = new TextDecoder(label);
    } catch (e) {
      decoder = new TextDecoder('utf-8');
    }
    return { text: decoder.decode(arrayBuffer), encoding: label };
  }

  /* ---------- Utilidades DOM (compatibles con xmldom) ---------- */

  function elementChildren(node) {
    const out = [];
    const list = node && node.childNodes ? node.childNodes : [];
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].nodeType === 1) out.push(list[i]);
    }
    return out;
  }

  function child(node, name) {
    if (!node) return null;
    const list = node.childNodes || [];
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].nodeType === 1 && list[i].nodeName === name) return list[i];
    }
    return null;
  }

  function childrenNamed(node, name) {
    return elementChildren(node).filter((el) => el.nodeName === name);
  }

  function find(node, path) {
    let cur = node;
    const parts = path.split('/');
    for (let i = 0; i < parts.length && cur; i += 1) cur = child(cur, parts[i]);
    return cur;
  }

  function text(node, path) {
    const el = path ? find(node, path) : node;
    return el ? asText(el.textContent) : '';
  }

  /* ---------- Modelo ---------- */

  function apellidosNombre(a) {
    const apellidos = [a.apellido1, a.apellido2].filter(Boolean).join(' ');
    return apellidos && a.nombre ? `${apellidos}, ${a.nombre}` : apellidos || a.nombre;
  }

  function sortKey(a) {
    return [a.apellido1, a.apellido2, a.nombre].map(upper).join(' ').trim();
  }

  function calcEdad(fechaIso, hoy) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIso)) return null;
    const [y, m, d] = fechaIso.split('-').map(Number);
    const ref = hoy || new Date();
    let edad = ref.getFullYear() - y;
    const cumple = new Date(ref.getFullYear(), m - 1, d);
    if (ref < cumple) edad -= 1;
    return edad;
  }

  function fechaEs(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function leerTutor(node) {
    if (!node) return null;
    const t = {
      parentesco: text(node, 'parentesco/nombre'),
      tipoDocumento: text(node, 'tipoDocumento/nombre'),
      documento: text(node, 'documentoIdentidad'),
      apellido1: text(node, 'apellido1'),
      apellido2: text(node, 'apellido2'),
      nombre: text(node, 'nombre'),
      email: text(node, 'contacto/email'),
      telefono1: text(node, 'contacto/telefono1'),
      telefono2: text(node, 'contacto/telefono2'),
    };
    t.nombreCompleto = apellidosNombre(t);
    if (!t.nombreCompleto && !t.documento && !t.telefono1) return null;
    return t;
  }

  function leerDomicilio(node) {
    if (!node) return '';
    const tipoVia = text(node, 'tipoVia/nombre');
    const nombreVia = text(node, 'nombreVia');
    const yaLleva = /^(C\/|CL\.?\s|CALLE\s|AVDA\.?|AV\.?\s|AVENIDA|PLAZA|PZA\.?|PASEO|Pº|CAMINO|CTRA\.?|CARRETERA|TRAVESÍA|TRV\.?|RONDA|URB\.?)/i.test(nombreVia)
      || (tipoVia && upper(nombreVia).startsWith(upper(tipoVia)));
    const via = [yaLleva ? '' : tipoVia, nombreVia].filter(Boolean).join(' ');
    const numero = text(node, 'numeroPortal');
    const extra = [text(node, 'escalera'), text(node, 'piso'), text(node, 'letraPuerta')]
      .filter((v) => v && v !== '0')
      .join(' ');
    return [via, numero ? `nº ${numero}` : '', extra].filter(Boolean).join(', ');
  }

  function leerMatricula(node, hoy) {
    const datos = child(node, 'datosMatricula');
    const alumno = child(node, 'alumno');
    const materias = childrenNamed(child(datos, 'materias'), 'materia').map((m) => ({
      codigo: text(m, 'nombreMateria/codigoModulo') || text(m, 'nombreMateria/id'),
      nombre: text(m, 'nombreMateria/nombre').replace(/\.$/, ''),
      tipo: text(m, 'tipoMateria/nombre'),
      curso: text(m, 'cursoEstudio/nombre'),
      cursoId: Number(text(m, 'cursoEstudio/id')) || null,
      estado: text(m, 'estado/nombre'),
    }));

    const row = {
      cie: text(alumno, 'cie'),
      tipoDocumento: text(alumno, 'tipoDocumento/nombre'),
      documento: text(alumno, 'documentoIdentidad'),
      apellido1: text(alumno, 'apellido1'),
      apellido2: text(alumno, 'apellido2'),
      nombre: text(alumno, 'nombre'),

      cursoAcademico: text(datos, 'cursoAcademico'),
      centro: text(datos, 'centro/nombre'),
      idCentro: text(datos, 'centro/id'),
      cicloId: text(datos, 'estudio/id'),
      cicloClave: text(datos, 'estudio/clavealfa'),
      cicloNombre: text(datos, 'estudio/nombre') || 'Ciclo sin nombre',
      cursoId: Number(text(datos, 'cursoEstudio/id')) || 99,
      cursoNombre: text(datos, 'cursoEstudio/nombre') || 'Curso sin nombre',
      grupoXml: text(datos, 'grupo/nombre'),
      turno: text(datos, 'grupo/turno'),
      regimen: text(datos, 'regimenImparticion/nombre'),
      periodo: text(datos, 'periodo/nombre'),
      curriculo: text(datos, 'curriculo/nombre'),
      estadoMatricula: text(datos, 'estado/nombre'),

      fechaNac: text(alumno, 'datosNacimiento/fechaNac'),
      paisNac: text(alumno, 'datosNacimiento/paisNac/nombre'),
      localidadNac:
        text(alumno, 'datosNacimiento/localidadNac/nombre') ||
        text(alumno, 'datosNacimiento/localidadExtranjeraNac').replace(/^NA$/, ''),
      provinciaNac: text(alumno, 'datosNacimiento/provinciaNac/nombre'),
      genero: text(alumno, 'genero/nombre'),
      nacionalidad: text(alumno, 'nacionalidad/nombre'),
      emancipado: text(alumno, 'emancipado'),

      domicilio: leerDomicilio(child(alumno, 'domicilio')),
      codigoPostal: text(alumno, 'domicilio/codigoPostal'),
      localidad: text(alumno, 'domicilio/localidad/nombre'),
      municipio: text(alumno, 'domicilio/municipio/nombre'),
      provincia: text(alumno, 'domicilio/provincia/nombre'),

      email: text(alumno, 'contacto/email'),
      telefono1: text(alumno, 'contacto/telefono1'),
      telefono2: text(alumno, 'contacto/telefono2'),
      nuss: text(alumno, 'asistencia/nuss'),
      aseguradora: text(alumno, 'asistencia/aseguradora/nombre'),
      tarjetaSanitaria: text(alumno, 'asistencia/tarjetaSanitaria'),

      tutor1: leerTutor(child(node, 'tutor1')),
      tutor2: leerTutor(child(node, 'tutor2')),
      materias,
    };

    row.apellidosNombre = apellidosNombre(row);
    row.sortKey = sortKey(row);
    row.id = row.cie || row.documento || row.sortKey;
    row.turnoNombre = TURNOS[row.turno] || row.turno;
    row.edad = calcEdad(row.fechaNac, hoy);
    row.menor = row.edad == null ? '' : row.edad < 18 ? 'Sí' : 'No';
    row.fechaNacEs = fechaEs(row.fechaNac);
    row.nModulos = materias.length;
    row.grupo = row.grupoXml; // puede cambiarse con asignaciones manuales
    row.cursoCorto = row.cursoId === 1 ? '1º' : row.cursoId === 2 ? '2º' : row.cursoNombre;
    return row;
  }

  /**
   * Analiza el texto XML y devuelve el modelo base.
   * @param {string} xmlText
   * @param {typeof DOMParser} DOMParserCtor
   * @param {Date} [hoy] fecha de referencia para calcular edades
   */
  function parseMatriculas(xmlText, DOMParserCtor, hoy) {
    const Parser = DOMParserCtor || (typeof DOMParser !== 'undefined' ? DOMParser : null);
    if (!Parser) throw new Error('No hay DOMParser disponible.');

    const doc = new Parser().parseFromString(xmlText, 'application/xml');
    const errorNode = doc.getElementsByTagName('parsererror')[0];
    if (errorNode) throw new Error('El fichero no es un XML válido.');

    const rootEl = doc.documentElement;
    if (!rootEl || rootEl.nodeName !== 'centro') {
      throw new Error('El XML no tiene la estructura esperada (raíz <centro>).');
    }

    const nodos = childrenNamed(rootEl, 'matricula');
    if (nodos.length === 0) throw new Error('El XML no contiene matrículas.');

    const matriculas = nodos.map((n) => leerMatricula(n, hoy));
    const primera = matriculas[0];

    return {
      idCentro: text(rootEl, 'idCentro') || primera.idCentro,
      centro: matriculas.map((m) => m.centro).find(Boolean) || '',
      cursoAcademico: matriculas.map((m) => m.cursoAcademico).find(Boolean) || '',
      matriculas,
    };
  }

  /* ---------- Agrupación en hojas de clase ---------- */

  function aplicarAsignaciones(matriculas, asignaciones) {
    const map = asignaciones || {};
    for (const m of matriculas) {
      m.grupo = asText(map[m.id]) || m.grupoXml;
      m.grupoManual = Boolean(asText(map[m.id]));
    }
  }

  function agruparClases(matriculas) {
    const grupos = new Map();

    for (const m of matriculas) {
      const grupoNombre = m.grupo || '';
      const key = `${m.cicloClave || m.cicloNombre}||${m.cursoId}||${grupoNombre}`;
      if (!grupos.has(key)) {
        grupos.set(key, {
          key,
          cicloClave: m.cicloClave,
          cicloNombre: m.cicloNombre,
          cursoId: m.cursoId,
          cursoNombre: m.cursoNombre,
          cursoCorto: m.cursoCorto,
          grupoNombre,
          sinGrupo: !grupoNombre,
          turno: m.turno,
          turnoNombre: m.turnoNombre,
          alumnos: [],
          vistos: new Set(),
        });
      }
      const bucket = grupos.get(key);
      if (bucket.vistos.has(m.id)) continue;
      bucket.vistos.add(m.id);
      bucket.alumnos.push(m);
    }

    const clases = [...grupos.values()].map((g) => {
      g.alumnos.sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'es'));
      delete g.vistos;
      return g;
    });

    clases.sort((a, b) => {
      const porCiclo = a.cicloNombre.localeCompare(b.cicloNombre, 'es');
      if (porCiclo !== 0) return porCiclo;
      if (a.cursoId !== b.cursoId) return a.cursoId - b.cursoId;
      if (a.sinGrupo !== b.sinGrupo) return a.sinGrupo ? 1 : -1;
      return a.grupoNombre.localeCompare(b.grupoNombre, 'es');
    });

    return clases;
  }

  /** Grupos disponibles para un ciclo + curso (para asignar manualmente). */
  function gruposDisponibles(matriculas, cicloClave, cursoId) {
    const set = new Set();
    for (const m of matriculas) {
      if (m.cicloClave === cicloClave && m.cursoId === cursoId && m.grupoXml) set.add(m.grupoXml);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }

  /* ---------- Exportación de un XML filtrado ---------- */

  // Comentario, CDATA, <?…?>/<!…>, o etiqueta de elemento (apertura, cierre o autocierre).
  const RE_MARCA =
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[?!][^>]*>|<(\/?)([^\s/>]+)(?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*\s*(\/?)>/g;

  /**
   * Posiciones [inicio, fin) en el texto original de cada <matricula> hija de la raíz,
   * en el mismo orden que parseMatriculas().matriculas.
   */
  function localizarMatriculas(xmlText) {
    const re = new RegExp(RE_MARCA.source, 'g');
    const bloques = [];
    let depth = 0;
    let inicio = -1;
    let m;
    while ((m = re.exec(xmlText))) {
      const nombre = m[2];
      if (!nombre) continue;
      if (m[1]) {
        depth -= 1;
        if (depth === 1 && nombre === 'matricula' && inicio >= 0) {
          bloques.push([inicio, re.lastIndex]);
          inicio = -1;
        }
      } else if (m[3]) {
        if (depth === 1 && nombre === 'matricula') bloques.push([m.index, re.lastIndex]);
      } else {
        if (depth === 1 && nombre === 'matricula') inicio = m.index;
        depth += 1;
      }
    }
    return bloques;
  }

  /**
   * Devuelve el XML original quitando las matrículas que no se conservan. Se recorta el
   * texto en lugar de reserializar el DOM para que la estructura, el formato y la
   * declaración <?xml … encoding?> queden exactamente como los exportó Stylus.
   * @param {string} xmlText texto completo del fichero original
   * @param {boolean[]} conservar uno por matrícula, en orden del documento
   */
  function recortarXml(xmlText, conservar) {
    const bloques = localizarMatriculas(xmlText);
    if (bloques.length !== conservar.length) {
      throw new Error('No se han podido localizar las matrículas dentro del XML original.');
    }
    let out = '';
    let pos = 0;
    bloques.forEach(([ini, fin], i) => {
      if (conservar[i]) return;
      let desde = ini;
      while (desde > pos && /\s/.test(xmlText[desde - 1])) desde -= 1; // quita también su sangría
      out += xmlText.slice(pos, desde);
      pos = fin;
    });
    return out + xmlText.slice(pos);
  }

  /** Codifica el texto en la misma codificación que el fichero original (p. ej. ISO-8859-1). */
  function codificarXml(texto, encoding) {
    const utf8 = (t) => new TextEncoder().encode(t);
    const label = (encoding || 'utf-8').toLowerCase();
    if (label === 'utf-8' || label === 'utf8') return utf8(texto);

    let tabla = null;
    try {
      const todos = new Uint8Array(256).map((_, i) => i);
      const chars = new TextDecoder(label).decode(todos);
      if (chars.length === 256) {
        tabla = new Map();
        for (let i = 0; i < 256; i += 1) if (!tabla.has(chars[i])) tabla.set(chars[i], i);
      }
    } catch (e) {
      /* codificación no soportada: se pasa a UTF-8 */
    }
    if (!tabla) {
      return utf8(texto.replace(/^(\s*<\?xml[^>]*?encoding\s*=\s*["'])[^"']+/, '$1UTF-8'));
    }

    const out = [];
    for (const ch of texto) {
      const b = tabla.get(ch);
      if (b !== undefined) out.push(b);
      else for (const c of `&#${ch.codePointAt(0)};`) out.push(c.charCodeAt(0));
    }
    return Uint8Array.from(out);
  }

  return {
    decodeXml,
    sniffEncoding,
    parseMatriculas,
    aplicarAsignaciones,
    agruparClases,
    gruposDisponibles,
    localizarMatriculas,
    recortarXml,
    codificarXml,
    asText,
    fechaEs,
    TURNOS,
  };
});
