# Trons Hero

App para practicar las líneas de la batucada al estilo Guitar Hero. La canción baja por
la pantalla con un carril por instrumento; eliges tu instrumento y tocas al ritmo.

**Abrir:** https://bass2015.github.io/trons-hero/

## Instalar en el móvil

- **iPhone:** abre el enlace en Safari → botón Compartir → *Añadir a pantalla de inicio*.
- **Android:** abre el enlace en Chrome → menú ⋮ → *Instalar aplicación* (o acepta el aviso).

Una vez instalada funciona sin conexión. Sube el volumen y quita el modo silencio.

## Modos

- **Escuchar:** suenan todas las líneas.
- **Solo mi línea:** solo suena tu instrumento.
- **Practicar:** suena todo menos tu línea; la tocas tú con los dos botones (o `V` y `N`).

Además: tempo ajustable, bucle por compases, metrónomo, cuenta de entrada, puntuación y
racha, mezcla por línea y calibración del desfase en Ajustes.

## Añadir canciones

Ver [docs/exportar-desde-ableton.md](docs/exportar-desde-ableton.md).

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173/trons-hero/
npm test
npm run build
```

Cada push a `main` publica la app en GitHub Pages.
