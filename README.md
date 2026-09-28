# Trons del Baró · app de pràctica

App per practicar les línies de la batucada a l'estil Guitar Hero. La cançó baixa per
l'autopista amb un carril per instrument; tries el teu instrument i toques al ritme.

**Obrir:** https://bass2015.github.io/trons-hero/

## Instal·lar al mòbil

- **iPhone:** obre l'enllaç a Safari → botó Compartir → *Afegir a la pantalla d'inici*.
- **Android:** obre l'enllaç a Chrome → menú ⋮ → *Instal·lar aplicació* (o accepta l'avís).

Un cop instal·lada funciona sense connexió. Apuja el volum i treu el mode silenci.

## Modes

- **Escoltar:** sonen totes les línies.
- **Només la meva línia:** només sona el teu instrument.
- **Practicar:** sona tot menys la teva línia; la toques tu amb els dos botons (o `V` i `N`).

A més: velocitat ajustable en bpm, bucle per compassos, metrònom, compte d'entrada,
amagar notes (pràctica de memòria), puntuació amb combo, resultats amb nota, mescla per
línia, calibratge del desfasament i idioma català / castellà.

## Instruments

Surdo, Contra, Goliat, Mig, Repe i Caixa, cadascun amb el seu color. Al `song.json`, l'`id`
o el camp `instrument` d'una línia ha de coincidir amb un d'aquests noms per heretar color,
icona i so.

## Logo

Posa `logo.png` (logo complet) i `bolt.png` (només el llamp) a `public/branding/`. Mentre
no hi siguin, l'app mostra un logotip de text. La icona de l'app es genera a partir de
`bolt.png` en fer `npm run build`.

## Afegir cançons

Vegeu [docs/exportar-desde-ableton.md](docs/exportar-desde-ableton.md).

## Desenvolupament

```bash
npm install
npm run dev      # http://localhost:5173/trons-hero/
npm test
npm run build
```

Cada push a `main` publica l'app a GitHub Pages.
