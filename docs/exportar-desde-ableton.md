# Exportar una canción desde Ableton

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
    { "id": "surdo",  "name": "Surdo",     "file": "surdo.mid",  "sound": "surdo" },
    { "id": "caixa",  "name": "Caixa",     "file": "caixa.mid",  "sound": "caixa" },
    { "id": "repe",   "name": "Repinique", "file": "repe.mid",   "sound": "repinique" }
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
| `lines[].id` | sí | Identificador corto, sin espacios. |
| `lines[].name` | sí | Nombre que se muestra en el carril. |
| `lines[].file` | sí | Archivo MIDI, relativo a la carpeta. |
| `lines[].pitches` | no | Notas MIDI que pertenecen a esta línea. Sin él, se usan todas las notas del archivo. Útil cuando varias líneas están en un mismo archivo. |
| `lines[].sound` | no | Sonido sintetizado: `surdo`, `caixa`, `repinique`, `agogo`, `tamborim`, `chocalho`, `generic`. |
| `lines[].sample` | no | Archivo `.wav` grabado, relativo a la carpeta. Si existe, sustituye al sintetizador. |

## Un solo archivo con varias líneas

Si el MIDI trae varios instrumentos en una sola pista (por ejemplo un drum rack), separa
las líneas por nota con `pitches`. Así está hecha la demo `batucada`: el surdo es la
nota 47 y la caixa la 56.

## Sonidos reales

Graba un golpe corto de cada instrumento (mono, 44.1 kHz, `.wav`, sin silencio al
principio), guárdalo en la carpeta de la canción y añade `"sample": "surdo.wav"` a la
línea. El sintetizador solo se usa si la muestra no carga.
