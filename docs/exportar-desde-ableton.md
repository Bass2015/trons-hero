# Exportar una canción desde Ableton

Hay dos caminos: **importar el proyecto `.als` directamente** (un comando, recomendado) o
exportar cada instrumento como clip MIDI a mano.

## Camino rápido: importar el `.als`

1. Guarda el proyecto en Ableton.
2. Crea la carpeta de la canción y copia dentro el `.als`:
   `public/songs/pachuco/pachuco.als`.
3. Ejecuta `npm run import:als public/songs/pachuco`.
4. Añade `"pachuco"` a `public/songs/index.json`, commit y push.

El importador lee todos los clips MIDI del arrangement, desenrolla los loops, y escribe un
`.mid` por línea más el `song.json`. Se mantienen los números de compás de Ableton, el tempo y
el compás del set. Las notas desactivadas se ignoran. Si el set tiene **automatización de
tempo**, se importa como mapa de tempos (`tempos` en `song.json`) y la app sigue los cambios;
las rampas se aproximan en escalones de un pulso.

Mapeo por defecto según el nombre de la pista (mayúsculas y espacios no importan):

| Pista en Ableton | Línea | Rol |
|---|---|---|
| SURDO, CONTRA, GOLIAT, MIG, CAIXA | mismo id | carril |
| REPLANA, REPE, REPINIQUE | `repe` | carril |
| ROCAR … (varias pistas se fusionan; las que contienen FLUIX suenan al 60 %) | `rocar` | `hidden`: suena, sin carril |
| CLAQUETA, CLICK, METRÓNOMO | `claqueta` | `click`: suena como metrónomo de la canción (la nota más alta es el acento) |
| FERRO | `ferro` | `hidden` |
| REPE CANTO | se fusiona en `repe` | carril |
| cualquier otra | se ignora con aviso | |

El importador recorta el silencio inicial (empieza en el primer compás con notas) y el
final (tras la última nota que no sea claqueta), pero **mantiene los números de compás de
Ableton** en la app gracias al campo `firstBar`. Si hay un `cover.jpg` en la carpeta, se usa
como portada.

Para cambiar el título, el rango o el mapeo, crea `import.json` en la carpeta:

```json
{
  "title": "Pachuco",
  "endBar": 41,
  "tracks": {
    "HIHAT": null,
    "13 Ferro / Rim": { "id": "ferro", "name": "Ferro", "role": "hidden" },
    "20-TronRakos": "caixa"
  }
}
```

Requiere Node 23.6 o superior (el script importa código TypeScript directamente).

## Camino manual: un clip MIDI por instrumento

Cada canción es una carpeta dentro de `public/songs/` con un `song.json` y uno o más
archivos MIDI. La forma más sencilla desde Ableton es **un archivo MIDI por instrumento**.

## Pasos

1. En Ableton, asegúrate de que cada instrumento (surdo, caixa, repinique…) está en su
   propia pista MIDI.
2. Para cada pista, selecciona todos los clips de la canción y usa
   **Consolidar** (`Cmd+J`) para que quede un único clip que empiece en el compás 1.
   Si el clip no empieza en el 1, la línea saldrá desplazada.
3. Arrastra el clip consolidado desde Ableton al Finder, dentro de la carpeta de la
   canción, y renómbralo con el nombre del instrumento: `surdo.mid`, `caixa.mid`, etc.
4. Crea `song.json` en la misma carpeta:

```json
{
  "title": "Nombre de la canción",
  "bpm": 110,
  "lines": [
    { "id": "surdo",  "name": "Surdo",  "file": "surdo.mid" },
    { "id": "contra", "name": "Contra", "file": "contra.mid" },
    { "id": "goliat", "name": "Goliat", "file": "goliat.mid" },
    { "id": "mig",    "name": "Mig",    "file": "mig.mid" },
    { "id": "repe",   "name": "Repe",   "file": "repe.mid" },
    { "id": "caixa",  "name": "Caixa",  "file": "caixa.mid" }
  ]
}
```

5. Añade el nombre de la carpeta a `public/songs/index.json`.
6. Haz commit y push. La app se publica sola.

## Campos de `song.json`

| Campo | Obligatorio | Significado |
|---|---|---|
| `title` | sí | Nombre que se muestra. |
| `bpm` | no | Tempo. Si falta, se lee del MIDI (Ableton lo incluye). |
| `beatsPerBar` | no | Pulsos por compás. Si falta, se lee del MIDI o se usa 4. |
| `firstBar` | no | Número de compás (de Ableton) del primer compás de la app. Por defecto 1. |
| `tempos` | no | Cambios de tempo: `[{ "beat": 0, "bpm": 136 }, { "beat": 60, "bpm": 144 }]` en pulsos de la app. `bpm` es el tempo inicial. |
| `cover` | no | Imagen de portada, relativa a la carpeta. |
| `lines[].id` | sí | Identificador corto, sin espacios. |
| `lines[].name` | sí | Nombre que se muestra en el carril. |
| `lines[].file` | sí | Archivo MIDI, relativo a la carpeta. |
| `lines[].instrument` | no | Uno de `surdo`, `contra`, `goliat`, `mig`, `repe`, `caixa`. Da color, icono y sonido por defecto. Si falta, se usa el `id`. |
| `lines[].pitches` | no | Notas MIDI que pertenecen a esta línea. Sin él, se usan todas las notas del archivo. Útil cuando varias líneas están en un mismo archivo. |
| `lines[].sound` | no | Sonido sintetizado (por defecto el del instrumento): `surdo`, `caixa`, `repinique`, `agogo`, `tamborim`, `chocalho`, `generic`. |
| `lines[].sample` | no | Archivo `.wav` grabado, relativo a la carpeta. Si existe, sustituye al sintetizador. |
| `lines[].role` | no | `lane` (por defecto), `hidden` (suena pero no se ve ni se elige) o `click` (claqueta de la canción; sustituye al metrónomo continuo cuando el metrónomo está activo). |

## Un solo archivo con varias líneas

Si el MIDI trae varios instrumentos en una sola pista (por ejemplo un drum rack), separa
las líneas por nota con `pitches`. Así está hecha la demo `batucada`: el surdo es la
nota 47 y la caixa la 56.

## Sonidos reales

Graba un golpe corto de cada instrumento (mono, 44.1 kHz, `.wav`, sin silencio al
principio), guárdalo en la carpeta de la canción y añade `"sample": "surdo.wav"` a la
línea. El sintetizador solo se usa si la muestra no carga.
