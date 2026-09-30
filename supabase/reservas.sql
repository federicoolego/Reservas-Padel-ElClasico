-- =====================================================================
-- Reservas de canchas · El Clásico
-- Script para correr UNA vez en el SQL Editor de Supabase.
--
-- Convive con la base de la app de torneos: todas las tablas y funciones
-- llevan el prefijo "reservas_" y no toca nada existente.
--
-- Seguridad:
--   * La lectura de turnos es pública (es lo mismo que se comparte por WhatsApp).
--   * Escribir solo se puede con un token de sesión, que se obtiene con
--     usuario + contraseña vía reservas_login(). La contraseña se guarda
--     hasheada con bcrypt y no está en el código de la app.
--   * Los usuarios de la app de torneos (authenticated) NO pueden escribir.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

-- Credenciales del login genérico (sin políticas RLS: nadie las lee desde la API)
create table if not exists public.reservas_acceso (
  usuario     text primary key,
  clave_hash  text not null,
  creado      timestamptz not null default now()
);

-- Sesiones abiertas (una por dispositivo)
create table if not exists public.reservas_sesiones (
  token    uuid primary key default gen_random_uuid(),
  usuario  text not null references public.reservas_acceso(usuario) on delete cascade,
  nombre   text,                         -- quién está usando el dispositivo (opcional)
  creada   timestamptz not null default now(),
  expira   timestamptz not null default now() + interval '60 days'
);

-- Estado de cada turno. Si no hay fila, el turno está libre.
create table if not exists public.reservas_turnos (
  fecha            date not null,
  complejo         text not null check (complejo in ('el-clasico', 'el-clasico-2')),
  cancha           text not null check (char_length(cancha) between 1 and 20),
  hora             text not null check (hora ~ '^[0-2][0-9]:[0-5][0-9]$'),
  estado           text not null check (estado in ('reservada', 'libre')),
  actualizado_por  text,
  actualizado      timestamptz not null default now(),
  primary key (fecha, complejo, cancha, hora)
);

create index if not exists reservas_turnos_fecha_complejo
  on public.reservas_turnos (fecha, complejo);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.reservas_acceso   enable row level security;
alter table public.reservas_sesiones enable row level security;
alter table public.reservas_turnos   enable row level security;

drop policy if exists "reservas_turnos lectura publica" on public.reservas_turnos;
create policy "reservas_turnos lectura publica"
  on public.reservas_turnos for select
  to anon, authenticated
  using (true);
-- Sin políticas de insert/update/delete: solo se escribe con las funciones de abajo.

-- ---------------------------------------------------------------------
-- Funciones (security definer: son la única puerta de escritura)
-- ---------------------------------------------------------------------

create or replace function public.reservas_login(p_usuario text, p_clave text, p_nombre text default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash  text;
  v_token uuid;
begin
  select clave_hash into v_hash
    from public.reservas_acceso
   where usuario = upper(trim(p_usuario));

  if v_hash is null or v_hash <> crypt(p_clave, v_hash) then
    perform pg_sleep(0.5);  -- frena intentos por fuerza bruta
    raise exception 'Usuario o contraseña incorrectos' using errcode = '28P01';
  end if;

  delete from public.reservas_sesiones where expira < now();

  insert into public.reservas_sesiones (usuario, nombre)
  values (upper(trim(p_usuario)), nullif(left(trim(coalesce(p_nombre, '')), 30), ''))
  returning token into v_token;

  return v_token;
end;
$$;

create or replace function public.reservas_validar(p_token uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.reservas_sesiones where token = p_token and expira > now());
$$;

create or replace function public.reservas_logout(p_token uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.reservas_sesiones where token = p_token;
$$;

create or replace function public.reservas_set_estado(
  p_token    uuid,
  p_fecha    date,
  p_complejo text,
  p_cancha   text,
  p_hora     text,
  p_estado   text
)
returns public.reservas_turnos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
  v_fila   public.reservas_turnos;
begin
  select coalesce(nombre, usuario) into v_nombre
    from public.reservas_sesiones
   where token = p_token and expira > now();

  if v_nombre is null then
    raise exception 'La sesión venció. Volvé a ingresar.' using errcode = '28000';
  end if;

  insert into public.reservas_turnos (fecha, complejo, cancha, hora, estado, actualizado_por, actualizado)
  values (p_fecha, p_complejo, p_cancha, p_hora, p_estado, v_nombre, now())
  on conflict (fecha, complejo, cancha, hora)
  do update set estado = excluded.estado,
                actualizado_por = excluded.actualizado_por,
                actualizado = excluded.actualizado
  returning * into v_fila;

  return v_fila;
end;
$$;

revoke all on function public.reservas_login(text, text, text)                        from public;
revoke all on function public.reservas_validar(uuid)                                  from public;
revoke all on function public.reservas_logout(uuid)                                   from public;
revoke all on function public.reservas_set_estado(uuid, date, text, text, text, text) from public;
grant execute on function public.reservas_login(text, text, text)                        to anon, authenticated;
grant execute on function public.reservas_validar(uuid)                                  to anon, authenticated;
grant execute on function public.reservas_logout(uuid)                                   to anon, authenticated;
grant execute on function public.reservas_set_estado(uuid, date, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Tiempo real: cada cambio llega al instante a todos los celus abiertos
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reservas_turnos'
  ) then
    alter publication supabase_realtime add table public.reservas_turnos;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Usuario genérico
-- ---------------------------------------------------------------------
insert into public.reservas_acceso (usuario, clave_hash)
values ('ELCLASICO', extensions.crypt('ElClasico.Admin.2026!', extensions.gen_salt('bf', 10)))
on conflict (usuario) do nothing;

-- Para CAMBIAR la contraseña más adelante (cierra todas las sesiones abiertas):
--   update public.reservas_acceso
--      set clave_hash = extensions.crypt('ClaveNueva', extensions.gen_salt('bf', 10))
--    where usuario = 'ELCLASICO';
--   delete from public.reservas_sesiones where usuario = 'ELCLASICO';
