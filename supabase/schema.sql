-- Sistema de Glucemia – esquema de base de datos (Supabase / PostgreSQL)
-- Pegar completo en Supabase > SQL Editor > New query > Run.
-- Se puede ejecutar más de una vez sin romper nada.

-- ---------- Registros diarios ----------
create table if not exists public.registros (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha date not null,
  hora text not null,                       -- 'HH:MM'
  glucemia numeric,                         -- mg/dl
  momento text,                             -- Ayunas, Antes desayuno, ...
  insulina_basal_u numeric,
  insulina_basal_tipo text,
  insulina_rapida_u numeric,
  insulina_rapida_tipo text,
  insulina_correccion_u numeric,
  medicacion jsonb,                         -- [{nombre, dosis}]
  comida_tipo text,
  comida_desc text,
  carbohidratos_g numeric,
  actividad_tipo text,
  actividad_min numeric,
  actividad_intensidad text,
  sintomas jsonb,                           -- ["Temblor", ...]
  peso_kg numeric,
  pa_sistolica numeric,
  pa_diastolica numeric,
  pulso numeric,
  notas text,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  sync_at timestamptz not null default now()
);

-- ---------- Laboratorio ----------
create table if not exists public.laboratorio (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha date not null,
  hba1c numeric,
  glucemia_lab numeric,
  colesterol_total numeric,
  ldl numeric,
  hdl numeric,
  trigliceridos numeric,
  creatinina numeric,
  microalbuminuria numeric,
  otros text,
  notas text,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  sync_at timestamptz not null default now()
);

-- ---------- Historial de modificaciones ----------
create table if not exists public.historial_cambios (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tabla text not null,
  registro_id uuid not null,
  fecha_cambio timestamptz not null,
  datos_anteriores jsonb not null,
  updated_at timestamptz,
  deleted_at timestamptz,
  sync_at timestamptz not null default now()
);

-- ---------- Configuración (perfil, rangos, tratamiento, recordatorios) ----------
create table if not exists public.configuracion (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz,
  deleted_at timestamptz,
  sync_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------- Marca de sincronización (hora del servidor) ----------
create or replace function public.marcar_sync() returns trigger
language plpgsql as $$
begin
  new.sync_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['registros','laboratorio','historial_cambios','configuracion'] loop
    execute format('drop trigger if exists trg_sync on public.%I', t);
    execute format('create trigger trg_sync before insert or update on public.%I
                    for each row execute function public.marcar_sync()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists propio_select on public.%I', t);
    execute format('drop policy if exists propio_insert on public.%I', t);
    execute format('drop policy if exists propio_update on public.%I', t);
    execute format('create policy propio_select on public.%I for select using (user_id = auth.uid())', t);
    execute format('create policy propio_insert on public.%I for insert with check (user_id = auth.uid())', t);
    execute format('create policy propio_update on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create index if not exists %I on public.%I (user_id, sync_at)', t || '_sync_idx', t);
  end loop;
end $$;
