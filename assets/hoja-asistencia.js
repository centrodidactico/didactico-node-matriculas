/*
 * hoja-asistencia.js — Genera las hojas de asistencia semanal en PDF (jsPDF).
 * Una hoja (o varias páginas) por cada ciclo + curso + grupo.
 * A4 apaisado, unidades en puntos.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HojaAsistencia = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const COLORS = {
    navy: '#15356B',
    navy900: '#0F2750',
    navySoft: '#1B4080',
    navyAlt: '#245ABB',
    gold: '#F4C20D',
    headerFg: '#FFFFFF',
    headerMuted: '#CDD4EA',
    rowAlt: '#F5F6F9',
    dayAlt: '#F5F6F9',
    dayAltZebra: '#E7E9F0',
    line: '#C9CFDB',
    text: '#1B2336',
    muted: '#5A6478',
  };

  const WEEK_DAYS_ALL = [
    { key: 'L', name: 'Lunes' },
    { key: 'M', name: 'Martes' },
    { key: 'X', name: 'Miércoles' },
    { key: 'J', name: 'Jueves' },
    { key: 'V', name: 'Viernes' },
    { key: 'S', name: 'Sábado' },
  ];

  function hex(doc, method, color) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    doc[method](r, g, b);
  }

  function fitText(doc, value, maxWidth) {
    let text = String(value == null ? '' : value);
    if (doc.getTextWidth(text) <= maxWidth) return text;
    while (text.length > 1 && doc.getTextWidth(`${text}…`) > maxWidth) text = text.slice(0, -1);
    return `${text}…`;
  }

  function buildPageMetrics(doc, opts) {
    const margin = 22;
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const innerWidth = width - margin * 2;
    const headerH = 70;
    const dayHeaderH = 16;
    const slotHeaderH = 12;
    const tableHeaderH = dayHeaderH + slotHeaderH;
    const rowH = opts.rowH;
    const tableTop = margin + headerH + 6;
    const footerH = 16;
    const usable = height - tableTop - tableHeaderH - margin - footerH;
    const rowsPerPage = Math.max(1, Math.floor(usable / rowH));

    const numW = 24;
    const nDays = opts.days.length;
    const slots = opts.slotsPerDay;
    const minNameW = 150;
    const availDays = innerWidth - numW - minNameW;
    const slotW = Math.min(17, Math.floor(availDays / (nDays * slots)));
    const dayW = slotW * slots;
    const daysTotal = dayW * nDays;
    const nameW = innerWidth - numW - daysTotal;

    return {
      margin,
      width,
      height,
      innerWidth,
      headerH,
      dayHeaderH,
      slotHeaderH,
      tableHeaderH,
      rowH,
      tableTop,
      rowsPerPage,
      col: {
        num: { x: margin, w: numW },
        name: { x: margin + numW, w: nameW },
        days: { x: margin + numW + nameW },
        day: { w: dayW },
        slot: { w: slotW },
      },
    };
  }

  function drawHeader(doc, page, meta) {
    const { margin, width, headerH } = page;
    const { centro, cursoAcademico, clase, pageIndex, pageCount } = meta;
    const n = clase.alumnos.length;
    const leftW = width - margin * 2 - 190;
    const rightX = width - margin - 176;
    const rightW = 162;

    hex(doc, 'setFillColor', COLORS.navy);
    doc.rect(margin, margin, width - margin * 2, headerH, 'F');
    hex(doc, 'setFillColor', COLORS.gold);
    doc.rect(margin, margin + headerH - 3, width - margin * 2, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    hex(doc, 'setTextColor', COLORS.gold);
    doc.text('HOJA DE ASISTENCIA SEMANAL', margin + 14, margin + 8, { baseline: 'top', maxWidth: leftW });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    hex(doc, 'setTextColor', COLORS.headerMuted);
    doc.text(fitText(doc, centro || 'Centro', leftW), margin + 14, margin + 21, { baseline: 'top' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    hex(doc, 'setTextColor', COLORS.headerFg);
    doc.text(fitText(doc, clase.cicloNombre, leftW), margin + 14, margin + 34, { baseline: 'top' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    hex(doc, 'setTextColor', COLORS.gold);
    const grupoTxt = clase.grupoNombre ? `Grupo ${clase.grupoNombre}` : 'Sin grupo asignado';
    const turnoTxt = clase.turnoNombre ? `  ·  ${clase.turnoNombre}` : '';
    doc.text(fitText(doc, `${clase.cursoNombre}  ·  ${grupoTxt}${turnoTxt}`, leftW), margin + 14, margin + 51, {
      baseline: 'top',
    });

    doc.setFontSize(8);
    hex(doc, 'setTextColor', COLORS.headerMuted);
    doc.text(`Curso académico ${cursoAcademico}`, rightX + rightW, margin + 9, { baseline: 'top', align: 'right' });
    if (clase.cicloClave) {
      doc.text(clase.cicloClave, rightX + rightW, margin + 22, { baseline: 'top', align: 'right' });
    }
    doc.text(`${n} alumno${n === 1 ? '' : 's'}`, rightX + rightW, margin + 35, { baseline: 'top', align: 'right' });
    const pag = pageCount > 1 ? `Pág. ${pageIndex} / ${pageCount}` : '';
    if (pag) doc.text(pag, rightX + rightW, margin + 48, { baseline: 'top', align: 'right' });
  }

  function drawTableHeader(doc, page, opts) {
    const { margin, innerWidth, col, tableTop, dayHeaderH, slotHeaderH } = page;
    const headerH = dayHeaderH + slotHeaderH;

    hex(doc, 'setFillColor', COLORS.navySoft);
    doc.rect(margin, tableTop, innerWidth, headerH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    hex(doc, 'setTextColor', COLORS.headerFg);
    const midY = tableTop + headerH / 2;
    doc.text('Nº', col.num.x + col.num.w / 2, midY, { align: 'center', baseline: 'middle' });
    doc.text('Apellidos y nombre', col.name.x + 4, midY, { baseline: 'middle' });

    opts.days.forEach((day, dayIndex) => {
      const x = col.days.x + dayIndex * col.day.w;
      if (dayIndex % 2 === 1) {
        hex(doc, 'setFillColor', COLORS.navyAlt);
        doc.rect(x, tableTop, col.day.w, headerH, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      hex(doc, 'setTextColor', COLORS.headerFg);
      doc.text(day.name, x + col.day.w / 2, tableTop + 3, { align: 'center', baseline: 'top' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      hex(doc, 'setTextColor', COLORS.headerMuted);
      for (let slot = 0; slot < opts.slotsPerDay; slot += 1) {
        const sx = x + slot * col.slot.w + col.slot.w / 2;
        doc.text(String(slot + 1), sx, tableTop + dayHeaderH + 2, { align: 'center', baseline: 'top' });
      }
    });

    hex(doc, 'setDrawColor', COLORS.navy);
    doc.setLineWidth(0.8);
    doc.rect(margin, tableTop, innerWidth, headerH, 'S');
    doc.line(col.name.x, tableTop, col.name.x, tableTop + headerH);
    opts.days.forEach((_, dayIndex) => {
      const x = col.days.x + dayIndex * col.day.w;
      doc.line(x, tableTop, x, tableTop + headerH);
    });
  }

  function drawRow(doc, page, y, index, alumno, zebra, opts) {
    const { margin, innerWidth, col, rowH } = page;

    if (zebra) {
      hex(doc, 'setFillColor', COLORS.rowAlt);
      doc.rect(margin, y, innerWidth, rowH, 'F');
    }
    opts.days.forEach((_, dayIndex) => {
      if (dayIndex % 2 === 1) {
        hex(doc, 'setFillColor', zebra ? COLORS.dayAltZebra : COLORS.dayAlt);
        doc.rect(col.days.x + dayIndex * col.day.w, y, col.day.w, rowH, 'F');
      }
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    hex(doc, 'setTextColor', COLORS.text);
    doc.text(String(index), col.num.x + col.num.w / 2, y + rowH / 2, { align: 'center', baseline: 'middle' });
    doc.text(fitText(doc, alumno.apellidosNombre, col.name.w - 8), col.name.x + 4, y + rowH / 2, {
      baseline: 'middle',
    });

    hex(doc, 'setDrawColor', COLORS.line);
    doc.setLineWidth(0.35);
    doc.rect(margin, y, innerWidth, rowH, 'S');
    doc.line(col.name.x, y, col.name.x, y + rowH);

    opts.days.forEach((_, dayIndex) => {
      const dayX = col.days.x + dayIndex * col.day.w;
      hex(doc, 'setDrawColor', COLORS.navy);
      doc.setLineWidth(0.85);
      doc.line(dayX, y, dayX, y + rowH);
      hex(doc, 'setDrawColor', COLORS.line);
      doc.setLineWidth(0.3);
      for (let slot = 1; slot < opts.slotsPerDay; slot += 1) {
        const sx = dayX + slot * col.slot.w;
        doc.line(sx, y, sx, y + rowH);
      }
    });
  }

  function drawFooter(doc, page, opts) {
    const y = page.height - page.margin - 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    hex(doc, 'setTextColor', COLORS.muted);
    const nDias = opts.days.length;
    doc.text(
      `Hoja común a todo el profesorado.  En blanco = presente.   A = ausencia   J = justificada   R = retraso.   ${opts.slotsPerDay} sesiones por día · ${nDias} días.`,
      page.margin,
      y,
      { baseline: 'top' }
    );
    doc.setFont('helvetica', 'bold');
    hex(doc, 'setTextColor', COLORS.text);
    doc.text('Semana del ________ al ________', page.margin + page.innerWidth, y, { baseline: 'top', align: 'right' });
  }

  /**
   * Genera el documento PDF.
   * @param {Function} jsPDF constructor de jsPDF
   * @param {{centro:string, cursoAcademico:string, clases:Array}} data
   * @param {{slotsPerDay?:number, days?:number, rowH?:number}} [options]
   * @returns jsPDF document
   */
  function generarHojas(jsPDF, data, options) {
    const opts = {
      slotsPerDay: Math.min(10, Math.max(1, Number((options && options.slotsPerDay) || 6))),
      days: WEEK_DAYS_ALL.slice(0, Math.min(6, Math.max(1, Number((options && options.days) || 5)))),
      rowH: Number((options && options.rowH) || 14),
    };

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
    doc.setProperties({
      title: `Hojas de asistencia ${data.cursoAcademico || ''}`.trim(),
      subject: 'Listas de clase',
      author: data.centro || 'Centro Didáctico',
      creator: 'Listados de matrícula · Secretaría',
    });

    const page = buildPageMetrics(doc, opts);
    let firstPage = true;

    for (const clase of data.clases) {
      const pageCount = Math.max(1, Math.ceil(clase.alumnos.length / page.rowsPerPage));
      for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
        if (!firstPage) doc.addPage('a4', 'landscape');
        firstPage = false;

        const start = (pageIndex - 1) * page.rowsPerPage;
        const slice = clase.alumnos.slice(start, start + page.rowsPerPage);

        drawHeader(doc, page, { centro: data.centro, cursoAcademico: data.cursoAcademico, clase, pageIndex, pageCount });
        drawTableHeader(doc, page, opts);
        slice.forEach((alumno, i) => {
          const y = page.tableTop + page.tableHeaderH + page.rowH * i;
          drawRow(doc, page, y, start + i + 1, alumno, i % 2 === 0, opts);
        });
        drawFooter(doc, page, opts);
      }
    }

    return doc;
  }

  return { generarHojas, COLORS, WEEK_DAYS_ALL };
});
