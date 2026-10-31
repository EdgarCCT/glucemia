# Glucemia – Guía de instalación

La app ya funciona **en modo local** (datos guardados en el dispositivo). Para que el celular y la PC
compartan los datos en la nube, seguí estos pasos una sola vez (≈ 20 minutos).

## 1. Base de datos en Supabase (gratis)

1. Entrá a <https://supabase.com> → **Start your project** → creá tu cuenta.
2. **New project**: nombre `glucemia`, una clave de base de datos (guardala), región **South America (São Paulo)**.
3. Cuando termine de crearse: menú izquierdo **SQL Editor** → **New query** → pegá todo el contenido de
   [`supabase/schema.sql`](supabase/schema.sql) → **Run**. Debe decir *Success*.
4. **Authentication → Users → Add user → Create new user**: tu email y una clave. Marcá *Auto Confirm User*.
5. **Authentication → Sign In / Providers → Email**: desactivá **Allow new users to sign up**
   (así nadie más puede crear cuentas en tu base).
6. **Project Settings → API** (o *Data API*): copiá **Project URL** y la clave **anon public**.
7. Abrí `js/config.js` y pegalas:

```js
export const CONFIG = {
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...",
};
```

## 2. Publicar la app en GitHub Pages (gratis)

1. Creá una cuenta en <https://github.com>.
2. **New repository** → nombre `glucemia` → *Public* → **Create repository**.
3. En la página del repositorio: **Add file → Upload files** → arrastrá **todo el contenido de la carpeta `app`**
   (no la carpeta en sí: `index.html`, `css`, `js`, `icons`, etc.) → **Commit changes**.
4. **Settings → Pages** → *Source*: **Deploy from a branch**, rama `main`, carpeta `/ (root)` → **Save**.
5. En un par de minutos queda en `https://TU-USUARIO.github.io/glucemia/`.

> El código es público, pero tus datos **no**: quedan en Supabase, protegidos por tu email y clave.

## 3. Instalar en el celular (Android) y en la PC

- **Celular**: abrí la dirección en Chrome → menú ⋮ → **Agregar a pantalla principal / Instalar app**.
- **PC**: abrí la dirección en Chrome o Edge → ícono **Instalar** en la barra de direcciones.
- Ingresá con el email y la clave del paso 1.4.

## 4. Pasar los datos de la app anterior

En la app vieja (`Glucemia.html`) en el celular tocá **Copiar para pegar en Excel**. En la nueva:
**Más → Importar, respaldo y papelera** → pegá → **Importar**. Los repetidos se saltean.

## 5. Recordatorios

**Más → Recordatorios**: cargá los horarios y tocá **Agregar a Google Calendar** en cada uno
(el calendario avisa aunque la app esté cerrada).

## Bueno saber

- **Sin internet** se sigue usando normal; los cambios se suben solos al volver la conexión
  (el indicador arriba a la derecha muestra el estado y los pendientes).
- Supabase gratis **pausa el proyecto si no se usa 7 días**. Con uso diario no pasa; si pasa,
  entrá a supabase.com y tocá *Restore* (no se pierde nada).
- Hacé un **respaldo .json** una vez por mes (Más → Importar, respaldo y papelera).
- Al **actualizar la app** subiendo archivos nuevos, cambiá `glucemia-v1` por `glucemia-v2` en `sw.js`.

## Probar en la PC sin publicar

```bash
python -m http.server 8765 --directory app
```

Abrir <http://localhost:8765>. Pruebas automáticas: <http://localhost:8765/tests.html>.
