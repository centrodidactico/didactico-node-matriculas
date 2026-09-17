/*
 * app.js — Interfaz de la herramienta de listados de matrícula.
 * Depende de: Matriculas, Columnas, HojaAsistencia, ListadoXlsx, jspdf, ExcelJS.
 */
(function () {
  'use strict';

  const LS_ASIGNACIONES = 'dm.asignacionesGrupo';
  const LS_COLUMNAS = 'dm.columnasVisibles';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const state = {
    fichero: '',
    model: null,
    clases: [],
    seleccion: new Set(),
    asignaciones: leerLS(LS_ASIGNACIONES, {}),
    columnas: new Set(leerLS(LS_COLUMNAS, null) || Columnas.COLUMNAS.filter((c) => c.visible).map((c) => c.key)),
    sort: { key: null, dir: 'asc' },
    filtros: { ciclo: '', curso: '', grupo: '', turno: '', q: '' },
    filas: [],
  };

  /* ---------- utilidades ---------- */

  function leerLS(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function guardarLS(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* sin almacenamiento: no pasa nada */
    }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function slug(s) {
    return String(s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function descargar(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function mostrarError(msg) {
    $('#error-text').textContent = msg;
    $('#error').hidden = !msg;
    if (msg) $('#error').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function cursoAcademicoSlug() {
    return (state.model && state.model.cursoAcademico ? state.model.cursoAcademico : '').replace('/', '-');
  }

  /* ---------- carga del fichero ---------- */

  async function cargarFichero(file) {
    if (!file) return;
    mostrarError('');
    $('#dz-loading').hidden = false;
    await new Promise((r) => setTimeout(r, 30)); // deja pintar el spinner

    try {
      const buffer = await file.arrayBuffer();
      const { text } = Matriculas.decodeXml(buffer);
      const model = Matriculas.parseMatriculas(text, DOMParser);
      state.model = model;
      state.fichero = file.name;
      state.sort = { key: null, dir: 'asc' };
      state.filtros = { ciclo: '', curso: '', grupo: '', turno: '', q: '' };
      reconstruir(true);
      $('#paso-carga').hidden = true;
      $('#resultado').hidden = false;
      $('#btn-reset').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      mostrarError(`No se ha podido leer «${file.name}»: ${err.message || err}`);
    } finally {
      $('#dz-loading').hidden = true;
      $('#file-input').value = '';
    }
  }

  function reconstruir(resetSeleccion) {
    Matriculas.aplicarAsignaciones(state.model.matriculas, state.asignaciones);
    state.clases = Matriculas.agruparClases(state.model.matriculas);
    if (resetSeleccion) state.seleccion = new Set(state.clases.map((c) => c.key));
    else state.seleccion = new Set([...state.seleccion].filter((k) => state.clases.some((c) => c.key === k)));
    renderResumen();
    renderSinGrupo();
    renderGrupos();
    rellenarFiltros();
    renderListado();
  }

  function reiniciar() {
    state.model = null;
    state.clases = [];
    state.filas = [];
    $('#resultado').hidden = true;
    $('#btn-reset').hidden = true;
    $('#paso-carga').hidden = false;
    mostrarError('');
  }

  /* ---------- resumen ---------- */

  function renderResumen() {
    const m = state.model;
    const alumnos = new Set(m.matriculas.map((x) => x.id)).size;
    const ciclos = new Set(m.matriculas.map((x) => x.cicloClave || x.cicloNombre)).size;
    const stats = [
      { k: 'Centro', v: m.centro || '—', text: true, wide: true },
      { k: 'Curso', v: m.cursoAcademico || '—', text: true },
      { k: 'Matrículas', v: m.matriculas.length },
      { k: 'Alumnos', v: alumnos },
      { k: 'Ciclos', v: ciclos },
      { k: 'Grupos', v: state.clases.filter((c) => !c.sinGrupo).length },
    ];
    $('#summary').innerHTML = stats
      .map(
        (s) =>
          `<div class="stat${s.wide ? ' stat--wide' : ''}"><div class="stat__label">${esc(s.k)}</div><div class="stat__num${s.text ? ' stat__num--text' : ''}">${esc(s.v)}</div></div>`
      )
      .join('');
  }

  /* ---------- alumnos sin grupo ---------- */

  function renderSinGrupo() {
    const wrap = $('#aviso-sin-grupo');
    const box = $('#aviso-sin-grupo-body');
    const sin = state.model.matriculas.filter((m) => !m.grupo);
    const manuales = state.model.matriculas.filter((m) => m.grupoManual);
    if (!sin.length && !manuales.length) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    const items = [...sin, ...manuales].sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'es'));
    box.innerHTML = `
      <h3>${sin.length ? `${sin.length} alumno${sin.length === 1 ? '' : 's'} sin grupo en Stylus` : 'Grupos asignados manualmente'}</h3>
      <p>${sin.length ? 'Asigna un grupo para incluirlos en su hoja de asistencia; si no, aparecerán en una hoja «Sin grupo».' : ''} La asignación se recuerda en este navegador.</p>
      <ul class="sin-grupo-lista">
        ${items
          .map((m) => {
            const opciones = Matriculas.gruposDisponibles(state.model.matriculas, m.cicloClave, m.cursoId);
            const actual = state.asignaciones[m.id] || '';
            return `<li>
              <span class="nombre">${esc(m.apellidosNombre)}</span>
              <span class="meta">${esc(m.cicloClave)} · ${esc(m.cursoCorto)} · ${esc(m.documento)}</span>
              <select data-asignar="${esc(m.id)}" aria-label="Grupo para ${esc(m.apellidosNombre)}">
                <option value="">— Sin grupo —</option>
                ${opciones.map((g) => `<option value="${esc(g)}"${g === actual ? ' selected' : ''}>${esc(g)}</option>`).join('')}
                <option value="__otro__">Otro…</option>
              </select>
              ${actual && !opciones.includes(actual) ? `<input type="text" data-asignar-otro="${esc(m.id)}" value="${esc(actual)}" placeholder="Nombre del grupo">` : ''}
            </li>`;
          })
          .join('')}
      </ul>`;

    box.querySelectorAll('select[data-asignar]').forEach((sel) => {
      const id = sel.dataset.asignar;
      const actual = state.asignaciones[id] || '';
      if (actual && ![...sel.options].some((o) => o.value === actual)) sel.value = '__otro__';
      sel.addEventListener('change', () => {
        if (sel.value === '__otro__') {
          const nombre = prompt('Nombre del grupo:', actual);
          if (nombre && nombre.trim()) asignarGrupo(id, nombre.trim());
          else sel.value = actual && [...sel.options].some((o) => o.value === actual) ? actual : '';
        } else {
          asignarGrupo(id, sel.value);
        }
      });
    });
    box.querySelectorAll('input[data-asignar-otro]').forEach((inp) => {
      inp.addEventListener('change', () => asignarGrupo(inp.dataset.asignarOtro, inp.value.trim()));
    });
  }

  function asignarGrupo(id, grupo) {
    if (grupo) state.asignaciones[id] = grupo;
    else delete state.asignaciones[id];
    guardarLS(LS_ASIGNACIONES, state.asignaciones);
    reconstruir(false);
  }

  /* ---------- hojas de asistencia ---------- */

  function renderGrupos() {
    const tbody = $('#tabla-grupos tbody');
    tbody.innerHTML = state.clases
      .map((c) => {
        const checked = state.seleccion.has(c.key) ? ' checked' : '';
        const grupo = c.sinGrupo
          ? '<span class="tag tag--warn">Sin grupo</span>'
          : `<span class="tag">${esc(c.grupoNombre)}</span>`;
        return `<tr>
          <td class="chk"><input type="checkbox" data-key="${esc(c.key)}"${checked} aria-label="Incluir ${esc(c.grupoNombre || 'sin grupo')}"></td>
          <td class="muted">${esc(c.cicloClave)}</td>
          <td class="strong">${esc(c.cicloNombre)}</td>
          <td>${esc(c.cursoCorto)}</td>
          <td>${grupo}</td>
          <td class="muted">${esc(c.turnoNombre)}</td>
          <td class="num">${c.alumnos.length}</td>
          <td class="act"><button type="button" class="btn btn--outline btn--xs" data-pdf-one="${esc(c.key)}">PDF</button></td>
        </tr>`;
      })
      .join('');
    actualizarSeleccion();
  }

  function actualizarSeleccion() {
    const n = state.seleccion.size;
    const alumnos = state.clases.filter((c) => state.seleccion.has(c.key)).reduce((s, c) => s + c.alumnos.length, 0);
    $('#sel-count').textContent = n
      ? `${n} hoja${n === 1 ? '' : 's'} · ${alumnos} alumno${alumnos === 1 ? '' : 's'}`
      : 'Ningún grupo seleccionado';
    $('#btn-pdf').disabled = n === 0;
    const all = $('#chk-all');
    all.checked = n > 0 && n === state.clases.length;
    all.indeterminate = n > 0 && n < state.clases.length;
  }

  function opcionesPdf() {
    return {
      slotsPerDay: Number($('#opt-sesiones').value) || 6,
      days: Number($('#opt-dias').value) || 5,
    };
  }

  function generarPdf(clases, nombre) {
    if (!clases.length) return;
    const { jsPDF } = window.jspdf;
    const doc = HojaAsistencia.generarHojas(
      jsPDF,
      { centro: state.model.centro, cursoAcademico: state.model.cursoAcademico, clases },
      opcionesPdf()
    );
    descargar(doc.output('blob'), nombre);
  }

  /* ---------- listado ---------- */

  function rellenarFiltros() {
    const ms = state.model.matriculas;
    const uniq = (fn) => [...new Set(ms.map(fn).filter(Boolean))];
    const ciclos = uniq((m) => m.cicloClave || m.cicloNombre)
      .map((clave) => ({ clave, nombre: ms.find((m) => (m.cicloClave || m.cicloNombre) === clave).cicloNombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const cursos = [...new Set(ms.map((m) => m.cursoId))].sort((a, b) => a - b).map((id) => ({
      id,
      nombre: ms.find((m) => m.cursoId === id).cursoNombre,
    }));
    const turnos = uniq((m) => m.turno).sort().map((t) => ({ t, nombre: Matriculas.TURNOS[t] || t }));

    llenarSelect($('#f-ciclo'), ciclos.map((c) => [c.clave, `${c.clave} · ${c.nombre}`]), state.filtros.ciclo);
    llenarSelect($('#f-curso'), cursos.map((c) => [String(c.id), c.nombre]), state.filtros.curso);
    llenarSelect($('#f-turno'), turnos.map((t) => [t.t, t.nombre]), state.filtros.turno);
    rellenarGrupos();
  }

  function rellenarGrupos() {
    const ms = state.model.matriculas.filter(
      (m) =>
        (!state.filtros.ciclo || (m.cicloClave || m.cicloNombre) === state.filtros.ciclo) &&
        (!state.filtros.curso || String(m.cursoId) === state.filtros.curso)
    );
    const grupos = [...new Set(ms.map((m) => m.grupo))].sort((a, b) => a.localeCompare(b, 'es'));
    const opts = grupos.map((g) => [g || '__sin__', g || '(sin grupo)']);
    if (state.filtros.grupo && !opts.some(([v]) => v === state.filtros.grupo)) state.filtros.grupo = '';
    llenarSelect($('#f-grupo'), opts, state.filtros.grupo);
  }

  function llenarSelect(sel, opciones, valor) {
    sel.innerHTML = `<option value="">Todos</option>${opciones
      .map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`)
      .join('')}`;
    sel.value = valor || '';
  }

  function filasFiltradas() {
    const f = state.filtros;
    const q = f.q.trim().toLocaleLowerCase('es');
    let filas = state.model.matriculas.filter((m) => {
      if (f.ciclo && (m.cicloClave || m.cicloNombre) !== f.ciclo) return false;
      if (f.curso && String(m.cursoId) !== f.curso) return false;
      if (f.grupo && (m.grupo || '__sin__') !== f.grupo) return false;
      if (f.turno && m.turno !== f.turno) return false;
      if (q) {
        const hay = [m.apellidosNombre, m.nombre, m.documento, m.cie, m.email, m.telefono1, m.telefono2, m.localidad]
          .join(' ')
          .toLocaleLowerCase('es');
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (state.sort.key && Columnas.porKey[state.sort.key]) {
      filas = filas.sort(Columnas.comparador(Columnas.porKey[state.sort.key], state.sort.dir));
    } else {
      filas = filas.sort(
        (a, b) =>
          a.cicloNombre.localeCompare(b.cicloNombre, 'es') ||
          a.cursoId - b.cursoId ||
          (a.grupo || '~').localeCompare(b.grupo || '~', 'es') ||
          a.sortKey.localeCompare(b.sortKey, 'es')
      );
    }
    return filas;
  }

  function columnasVisibles() {
    return Columnas.COLUMNAS.filter((c) => state.columnas.has(c.key));
  }

  function renderListado() {
    state.filas = filasFiltradas();
    const cols = columnasVisibles();
    const thead = $('#tabla-alumnos thead');
    const tbody = $('#tabla-alumnos tbody');

    thead.innerHTML = `<tr><th class="num">#</th>${cols
      .map((c) => {
        const cls = [c.type === 'number' ? 'num' : '', state.sort.key === c.key ? state.sort.dir : ''].filter(Boolean).join(' ');
        const arrow = state.sort.key === c.key ? (state.sort.dir === 'asc' ? '▲' : '▼') : '↕';
        return `<th data-sort="${esc(c.key)}" class="${cls}" title="Ordenar por ${esc(c.label)}">${esc(c.label)}<span class="arrow">${arrow}</span></th>`;
      })
      .join('')}</tr>`;

    if (!state.filas.length) {
      tbody.innerHTML = `<tr><td class="empty" colspan="${cols.length + 1}">No hay alumnos que coincidan con el filtro.</td></tr>`;
    } else {
      tbody.innerHTML = state.filas
        .map(
          (m, i) =>
            `<tr><td class="num muted">${i + 1}</td>${cols
              .map((c) => {
                const v = c.get(m);
                if (c.key === 'grupo') {
                  return `<td>${
                    v ? `<span class="tag${m.grupoManual ? ' tag--manual' : ''}" title="${m.grupoManual ? 'Asignado manualmente' : ''}">${esc(v)}</span>` : '<span class="tag tag--warn">Sin grupo</span>'
                  }</td>`;
                }
                return `<td class="${c.type === 'number' ? 'num' : ''}">${esc(v)}</td>`;
              })
              .join('')}</tr>`
        )
        .join('');
    }

    const total = state.model.matriculas.length;
    $('#list-count').textContent =
      state.filas.length === total ? `${total} alumnos` : `${state.filas.length} de ${total} alumnos`;
  }

  function renderColChooser() {
    const box = $('#col-chooser');
    const grupos = [...new Set(Columnas.COLUMNAS.map((c) => c.grupo))];
    box.innerHTML = grupos
      .map(
        (g) => `<div><h4>${esc(g)}</h4>${Columnas.COLUMNAS.filter((c) => c.grupo === g)
          .map(
            (c) =>
              `<label><input type="checkbox" data-col="${esc(c.key)}"${state.columnas.has(c.key) ? ' checked' : ''}> ${esc(c.label)}</label>`
          )
          .join('')}</div>`
      )
      .join('');
    box.querySelectorAll('input[data-col]').forEach((inp) => {
      inp.addEventListener('change', () => {
        if (inp.checked) state.columnas.add(inp.dataset.col);
        else state.columnas.delete(inp.dataset.col);
        if (state.columnas.size === 0) {
          state.columnas.add(inp.dataset.col);
          inp.checked = true;
        }
        guardarLS(LS_COLUMNAS, [...state.columnas]);
        if (state.model) renderListado();
      });
    });
  }

  async function generarXlsx() {
    const btn = $('#btn-xlsx');
    btn.disabled = true;
    try {
      const cols = $('#opt-solo-visibles').checked ? columnasVisibles() : Columnas.COLUMNAS;
      const clases = Matriculas.agruparClases(state.filas);
      const buffer = await ListadoXlsx.generarListado(ExcelJS, state.model, state.filas, cols, { clases });
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const f = state.filtros;
      const sufijo = [f.ciclo, f.curso ? `${f.curso}curso` : '', f.grupo === '__sin__' ? 'sin-grupo' : f.grupo].filter(Boolean).map(slug).join('_');
      descargar(blob, `listado-matriculas-${cursoAcademicoSlug()}${sufijo ? `-${sufijo}` : ''}.xlsx`);
    } catch (err) {
      console.error(err);
      mostrarError(`No se ha podido generar el Excel: ${err.message || err}`);
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- eventos ---------- */

  function bind() {
    const dz = $('#dropzone');
    const input = $('#file-input');

    $('#btn-elegir').addEventListener('click', (e) => {
      e.stopPropagation();
      input.click();
    });
    dz.addEventListener('click', () => input.click());
    dz.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener('change', () => cargarFichero(input.files[0]));

    // arrastrar y soltar en toda la página
    let dragDepth = 0;
    window.addEventListener('dragenter', (e) => {
      if (![...e.dataTransfer.types].includes('Files')) return;
      dragDepth += 1;
      $('#drop-overlay').hidden = false;
      dz.classList.add('is-over');
    });
    window.addEventListener('dragleave', () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        $('#drop-overlay').hidden = true;
        dz.classList.remove('is-over');
      }
    });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragDepth = 0;
      $('#drop-overlay').hidden = true;
      dz.classList.remove('is-over');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) cargarFichero(file);
    });

    $('#btn-reset').addEventListener('click', reiniciar);

    // pestañas
    $$('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.tab').forEach((t) => {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        $$('.tab-panel').forEach((p) => (p.hidden = p.id !== `tab-${tab.dataset.tab}`));
      });
    });

    // hojas de asistencia
    $('#chk-all').addEventListener('change', (e) => {
      state.seleccion = e.target.checked ? new Set(state.clases.map((c) => c.key)) : new Set();
      renderGrupos();
    });
    $('#tabla-grupos').addEventListener('change', (e) => {
      const chk = e.target.closest('input[data-key]');
      if (!chk) return;
      if (chk.checked) state.seleccion.add(chk.dataset.key);
      else state.seleccion.delete(chk.dataset.key);
      actualizarSeleccion();
    });
    $('#tabla-grupos').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-pdf-one]');
      if (!btn) return;
      const clase = state.clases.find((c) => c.key === btn.dataset.pdfOne);
      if (!clase) return;
      const nombre = `hoja-asistencia-${slug(clase.grupoNombre || `${clase.cicloClave}-${clase.cursoCorto}-sin-grupo`)}-${cursoAcademicoSlug()}.pdf`;
      generarPdf([clase], nombre);
    });
    $('#btn-pdf').addEventListener('click', () => {
      const clases = state.clases.filter((c) => state.seleccion.has(c.key));
      generarPdf(clases, `hojas-asistencia-${cursoAcademicoSlug()}.pdf`);
    });

    // listado
    const onFiltro = () => {
      state.filtros.ciclo = $('#f-ciclo').value;
      state.filtros.curso = $('#f-curso').value;
      state.filtros.turno = $('#f-turno').value;
      state.filtros.grupo = $('#f-grupo').value;
      rellenarGrupos();
      renderListado();
    };
    ['#f-ciclo', '#f-curso', '#f-grupo', '#f-turno'].forEach((s) => $(s).addEventListener('change', onFiltro));
    let qTimer;
    $('#f-q').addEventListener('input', () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => {
        state.filtros.q = $('#f-q').value;
        renderListado();
      }, 120);
    });
    $('#btn-limpiar').addEventListener('click', () => {
      state.filtros = { ciclo: '', curso: '', grupo: '', turno: '', q: '' };
      $('#f-q').value = '';
      rellenarFiltros();
      renderListado();
    });
    $('#tabla-alumnos thead').addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort]');
      if (!th) return;
      const key = th.dataset.sort;
      if (state.sort.key === key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      else state.sort = { key, dir: 'asc' };
      renderListado();
    });
    $('#btn-columnas').addEventListener('click', () => {
      const box = $('#col-chooser');
      box.hidden = !box.hidden;
      $('#btn-columnas').setAttribute('aria-expanded', box.hidden ? 'false' : 'true');
    });
    $('#btn-xlsx').addEventListener('click', generarXlsx);

    renderColChooser();
  }

  bind();

  // gancho para pruebas automatizadas (no se usa en producción)
  window.__dm = { state, cargarFichero };
})();
