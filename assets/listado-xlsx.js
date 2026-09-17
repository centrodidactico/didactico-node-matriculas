/*
 * listado-xlsx.js — Exportación del listado completo a Excel (ExcelJS).
 * Hojas: "Alumnos" (una fila por matrícula), "Grupos" (resumen) y
 * "Módulos" (una fila por alumno y módulo matriculado).
 * Todas con cabecera fija y autofiltro para ordenar desde Excel.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ListadoXlsx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NAVY = 'FF15356B';
  const GOLD = 'FFF4C20D';
  const WHITE = 'FFFFFFFF';
  const ZEBRA = 'FFF5F6F9';

  function colLetter(n) {
    let s = '';
    let x = n;
    while (x > 0) {
      const r = (x - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      x = Math.floor((x - 1) / 26);
    }
    return s;
  }

  function estilarHoja(ws, nCols, nRows) {
    const header = ws.getRow(1);
    header.height = 22;
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } };
    });
    for (let r = 2; r <= nRows + 1; r += 1) {
      if (r % 2 === 1) {
        ws.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
        });
      }
    }
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    if (nRows > 0) ws.autoFilter = { from: 'A1', to: `${colLetter(nCols)}${nRows + 1}` };
  }

  function fechaDesdeIso(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  /**
   * @param {object} ExcelJS
   * @param {{centro:string, cursoAcademico:string}} meta
   * @param {Array} matriculas filas a exportar (ya filtradas/ordenadas)
   * @param {Array} columnas definiciones (Columnas.COLUMNAS)
   * @param {{clases?:Array}} [extra]
   * @returns {Promise<ArrayBuffer>}
   */
  async function generarListado(ExcelJS, meta, matriculas, columnas, extra) {
    const wb = new ExcelJS.Workbook();
    wb.creator = meta.centro || 'Centro Didáctico';
    wb.created = new Date();
    wb.title = `Listado de matrículas ${meta.cursoAcademico || ''}`.trim();

    /* --- Alumnos --- */
    const ws = wb.addWorksheet('Alumnos', { properties: { tabColor: { argb: NAVY } } });
    ws.columns = columnas.map((c) => ({ header: c.label, key: c.key, width: c.width || 14 }));
    for (const m of matriculas) {
      const row = {};
      for (const c of columnas) {
        let v = c.get(m);
        if (c.type === 'number' && v !== '') v = Number(v);
        if (c.type === 'date') v = fechaDesdeIso(m.fechaNac) || v;
        row[c.key] = v;
      }
      const added = ws.addRow(row);
      columnas.forEach((c, i) => {
        if (c.type === 'date') added.getCell(i + 1).numFmt = 'dd/mm/yyyy';
      });
    }
    estilarHoja(ws, columnas.length, matriculas.length);

    /* --- Grupos --- */
    const clases = (extra && extra.clases) || [];
    const wg = wb.addWorksheet('Grupos', { properties: { tabColor: { argb: GOLD } } });
    wg.columns = [
      { header: 'Clave ciclo', key: 'clave', width: 11 },
      { header: 'Ciclo formativo', key: 'ciclo', width: 44 },
      { header: 'Curso', key: 'curso', width: 7 },
      { header: 'Grupo', key: 'grupo', width: 10 },
      { header: 'Turno', key: 'turno', width: 11 },
      { header: 'Alumnos', key: 'n', width: 9 },
      { header: 'Hombres', key: 'h', width: 9 },
      { header: 'Mujeres', key: 'm', width: 9 },
      { header: 'Menores', key: 'menores', width: 9 },
    ];
    for (const c of clases) {
      wg.addRow({
        clave: c.cicloClave,
        ciclo: c.cicloNombre,
        curso: c.cursoCorto,
        grupo: c.grupoNombre || '(sin grupo)',
        turno: c.turnoNombre,
        n: c.alumnos.length,
        h: c.alumnos.filter((a) => /^H/i.test(a.genero)).length,
        m: c.alumnos.filter((a) => /^M/i.test(a.genero)).length,
        menores: c.alumnos.filter((a) => a.menor === 'Sí').length,
      });
    }
    if (clases.length) {
      const tot = wg.addRow({
        ciclo: 'TOTAL',
        n: clases.reduce((s, c) => s + c.alumnos.length, 0),
        h: clases.reduce((s, c) => s + c.alumnos.filter((a) => /^H/i.test(a.genero)).length, 0),
        m: clases.reduce((s, c) => s + c.alumnos.filter((a) => /^M/i.test(a.genero)).length, 0),
        menores: clases.reduce((s, c) => s + c.alumnos.filter((a) => a.menor === 'Sí').length, 0),
      });
      tot.font = { bold: true };
    }
    estilarHoja(wg, 9, clases.length);

    /* --- Módulos --- */
    const wm = wb.addWorksheet('Módulos');
    wm.columns = [
      { header: 'Clave ciclo', key: 'clave', width: 11 },
      { header: 'Curso', key: 'curso', width: 7 },
      { header: 'Grupo', key: 'grupo', width: 9 },
      { header: 'Apellidos y nombre', key: 'alumno', width: 36 },
      { header: 'Documento', key: 'doc', width: 13 },
      { header: 'Código módulo', key: 'codigo', width: 13 },
      { header: 'Módulo', key: 'modulo', width: 48 },
      { header: 'Tipo', key: 'tipo', width: 18 },
      { header: 'Curso módulo', key: 'cursoMod', width: 14 },
      { header: 'Estado', key: 'estado', width: 20 },
    ];
    let nMod = 0;
    for (const m of matriculas) {
      for (const mat of m.materias) {
        wm.addRow({
          clave: m.cicloClave,
          curso: m.cursoCorto,
          grupo: m.grupo,
          alumno: m.apellidosNombre,
          doc: m.documento,
          codigo: mat.codigo,
          modulo: mat.nombre,
          tipo: mat.tipo,
          cursoMod: mat.curso,
          estado: mat.estado,
        });
        nMod += 1;
      }
    }
    estilarHoja(wm, 10, nMod);

    return wb.xlsx.writeBuffer();
  }

  return { generarListado };
});
