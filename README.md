# Listados de matrícula · Secretaría

Herramienta web **estática** (GitHub Pages) para Secretaría del Centro Didáctico.
Se arrastra el fichero `matriculas.xml` exportado desde **Stylus** y, sin instalar nada
y sin enviar datos a ningún servidor, permite descargar:

- **Hojas de asistencia semanal en PDF**: una hoja por ciclo + curso + grupo, con la
  rejilla de lunes a viernes y 6 sesiones por día (configurable). Se pueden descargar
  todas en un único PDF o una a una.
- **Listado completo en Excel (.xlsx)**: una fila por alumno con todas las columnas de la
  matrícula (ciclo, curso, grupo, turno, datos personales, contacto, tutores…), con
  autofiltro y cabecera fija para ordenar desde Excel. Incluye además las hojas
  «Grupos» (resumen por grupo) y «Módulos» (una fila por alumno y módulo).

En pantalla, el listado se puede **filtrar** (ciclo, curso, grupo, turno, búsqueda libre)
y **ordenar** pulsando en cualquier cabecera; el Excel respeta el filtro y el orden actual.

## Uso

1. Abrir la página (GitHub Pages o el `index.html` en local).
2. Arrastrar `matriculas.xml` sobre la zona de carga o pulsar «Elegir archivo».
3. Pestaña **Hojas de asistencia**: marcar los grupos y «Descargar PDF».
4. Pestaña **Listado completo**: filtrar/ordenar y «Descargar Excel».

Si algún alumno viene **sin grupo** en Stylus, aparece un aviso para asignarle uno; la
asignación se recuerda en el navegador (no en ningún servidor).

## Privacidad

Todo el procesado ocurre en el navegador. El XML no se sube a ningún sitio y los datos
desaparecen al cerrar o recargar la pestaña. El repositorio ignora `*.xml`, `*.xlsx`
y `*.pdf` para que nunca se suba una exportación por error.

## Estructura

```
index.html               Página única
assets/style.css         Estilos (tokens y componentes de la web del centro)
assets/app.js            Interfaz: carga, filtros, orden, descargas
assets/matriculas.js     Lectura del XML de Stylus → modelo (alumnos, grupos)
assets/columnas.js       Definición de columnas del listado (pantalla y Excel)
assets/hoja-asistencia.js Hojas de asistencia en PDF (jsPDF)
assets/listado-xlsx.js   Exportación a Excel (ExcelJS)
assets/logo.png          Logotipo
vendor/                  jsPDF 2.5.2 y ExcelJS 4.4.0 (sin CDN, funciona sin conexión)
```

No hay proceso de build ni dependencias que instalar.

## Publicación en GitHub Pages

1. Subir el contenido a la rama `main` del repositorio.
2. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   rama `main`, carpeta `/ (root)`.
3. La página queda en `https://centrodidactico.github.io/didactico-node-matriculas/`.

## Probar en local

Basta con abrir `index.html` en el navegador. Si se prefiere un servidor local:

```
python -m http.server 8000
```

y abrir `http://localhost:8000/`.
