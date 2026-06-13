# Piece Ledger V4 Sync einrichten

V4 funktioniert sofort lokal wie V3. Für Login und geräteübergreifende Daten brauchst du ein Supabase-Projekt.

## 1. Supabase vorbereiten

1. Neues Projekt bei Supabase erstellen.
2. Im Supabase SQL Editor den Inhalt aus `supabase-setup.sql` ausführen.
3. Unter `Authentication` > `Providers` sicherstellen, dass `Email` aktiviert ist.
4. Unter `Project Settings` > `API` diese Werte kopieren:
   - Project URL
   - anon public key

## 2. V4 konfigurieren

In `sync-config.js` die beiden leeren Werte eintragen:

```js
window.PIECE_LEDGER_SYNC_CONFIG = {
  supabaseUrl: "https://dein-projekt.supabase.co",
  supabaseAnonKey: "dein-anon-public-key",
};
```

Danach `index.html` neu laden. Oben im Account-Bereich kannst du einen Account erstellen oder dich einloggen.

## Verhalten

- Ohne Supabase-Konfiguration speichert V4 nur lokal im Browser.
- Beim ersten Login werden vorhandene lokale V3/V4-Daten in die Cloud gespeichert, falls dort noch nichts liegt.
- Auf einem anderen Gerät werden nach Login die Cloud-Daten geladen.
- Wenn sowohl lokale als auch Cloud-Daten existieren, fragt V4, welche Version benutzt werden soll.
- JSON Import und Export bleiben weiterhin verfügbar.

## Wichtig

Damit du von anderen Geräten bequem darauf zugreifen kannst, sollte die V4-Seite später online gehostet werden, zum Beispiel über Netlify, Vercel, GitHub Pages oder Supabase Hosting. Nur die lokale Datei auf deinem PC ist noch keine öffentliche Website.
