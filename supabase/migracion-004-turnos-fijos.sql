-- =====================================================================
-- Migración 004 · Turnos fijos
-- Correr UNA vez en el SQL Editor de Supabase, después de la 003.
--
-- Cómo funciona:
--   * reservas_fijos guarda la regla ("martes 19:00 BX1 para Juan").
--   * Cada regla se "materializa": se crean las reservas reales en
--     reservas_turnos para los próximos DIAS_ADELANTE días (fijo_id apunta
--     a la regla). Así la tabla, la imagen y el tiempo real no cambian.
--   * Nunca se pisa un turno ya reservado: esa fecha se saltea.
--   * Si liberan una sola fecha de un fijo, se anota en
--     reservas_fijos_excepciones para que no se vuelva a reservar sola.
--   * Editar o eliminar un fijo libera sus reservas de hoy en adelante
--     (las pasadas quedan como historial) y vuelve a materializar.
--   * La ventana se corre sola: la app llama a reservas_fijos_sincronizar()
--     al abrir. Opcional: programarlo con pg_cron (ver al final).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create table if not exists public.reservas_fijos (
  id               uuid primary key default gen_random_uuid(),
  complejo         text not null check (complejo in ('el-clasico', 'el-clasico-2')),
  cancha           text not null check (char_length(cancha) between 1 and 20),
  dia_semana       smallint not null check (dia_semana between 0 and 6),  -- 0 = domingo (como extract(dow))
  hora             text not null check (hora ~ '^[0-2][0-9]:[0-5][0-9]$'),
  para             text not null check (char_length(para) between 1 and 40),
  desde            date not null,
  hasta            date,                                                 -- null = sin fin
  creado_por       text,
  creado           timestamptz not null default now(),
  actualizado_por  text,
  actualizado      timestamptz not null default now(),
  check (hasta is null or hasta >= desde)
);

create index if not exists reservas_fijos_complejo on public.reservas_fijos (complejo);

create table if not exists public.reservas_fijos_excepciones (
  fijo_id  uuid not null references public.reservas_fijos(id) on delete cascade,
  fecha    date not null,
  primary key (fijo_id, fecha)
);

alter table public.reservas_turnos
  add column if not exists fijo_id uuid references public.reservas_fijos(id) on delete set null;

create index if not exists reservas_turnos_fijo on public.reservas_turnos (fijo_id) where fijo_id is not null;

alter table public.reservas_fijos             enable row level security;
alter table public.reservas_fijos_excepciones enable row level security;

drop policy if exists "reservas_fijos lectura publica" on public.reservas_fijos;
create policy "reservas_fijos lectura publica"
  on public.reservas_fijos for select
  to anon, authenticated
  using (true);
-- Sin políticas de escritura: solo se escribe con las funciones de abajo.

-- ---------------------------------------------------------------------
-- Funciones internas (no se exponen a la API)
-- ---------------------------------------------------------------------

-- Días hacia adelante que se materializan. Mantener igual a DIAS_ADELANTE (src/config/limites.ts).
create or replace function public.reservas__dias_adelante()
returns int language sql immutable as $$ select 60 $$;

create or replace function public.reservas__hoy()
returns date language sql stable as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;

-- true si el turno (fecha, hora) todavía no empezó, en hora argentina
create or replace function public.reservas__futuro(p_fecha date, p_hora text)
returns boolean language sql stable as $$
  select p_fecha > public.reservas__hoy()
      or (p_fecha = public.reservas__hoy()
          and p_hora > to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI'))
$$;

-- Nombre de quien usa la sesión, o error si venció
create or replace function public.reservas__sesion(p_token uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v text;
begin
  select coalesce(nombre, usuario) into v
    from public.reservas_sesiones
   where token = p_token and expira > now();
  if v is null then
    raise exception 'La sesión venció. Volvé a ingresar.' using errcode = '28000';
  end if;
  return v;
end;
$$;

-- Crea las reservas de un fijo dentro de la ventana. No pisa turnos reservados.
create or replace function public.reservas__fijo_materializar(p_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy date := public.reservas__hoy();
  v_fin date := v_hoy + public.reservas__dias_adelante();
  v_n   int;
begin
  insert into public.reservas_turnos
         (fecha, complejo, cancha, hora, estado, actualizado_por, actualizado, reservado_para, fijo_id)
  select d.fecha, f.complejo, f.cancha, f.hora, 'reservada',
         coalesce(f.actualizado_por, f.creado_por, 'Turno fijo'), now(), f.para, f.id
    from public.reservas_fijos f
   cross join lateral (
         select g::date as fecha
           from generate_series(greatest(f.desde, v_hoy), least(coalesce(f.hasta, v_fin), v_fin), interval '1 day') g
        ) d
   where f.id = p_id
     and extract(dow from d.fecha) = f.dia_semana
     and public.reservas__futuro(d.fecha, f.hora)
     and not exists (select 1 from public.reservas_fijos_excepciones e
                      where e.fijo_id = f.id and e.fecha = d.fecha)
  on conflict (fecha, complejo, cancha, hora) do update
     set estado          = 'reservada',
         actualizado_por = excluded.actualizado_por,
         actualizado     = excluded.actualizado,
         reservado_para  = excluded.reservado_para,
         fijo_id         = excluded.fijo_id
   where public.reservas_turnos.estado <> 'reservada';   -- ocupado: se saltea

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Libera las reservas de un fijo que todavía no se jugaron. Las pasadas quedan.
create or replace function public.reservas__fijo_liberar_futuros(p_id uuid, p_nombre text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.reservas_turnos
     set estado = 'libre', reservado_para = null, fijo_id = null,
         actualizado_por = p_nombre, actualizado = now()
   where fijo_id = p_id
     and estado = 'reservada'
     and public.reservas__futuro(fecha, hora);
$$;

-- Materializa todos los fijos vigentes (los más viejos tienen prioridad).
create or replace function public.reservas__fijos_sincronizar_todos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int := 0;
  v_id    uuid;
begin
  delete from public.reservas_fijos_excepciones where fecha < public.reservas__hoy();
  for v_id in
    select id from public.reservas_fijos
     where hasta is null or hasta >= public.reservas__hoy()
     order by creado
  loop
    v_total := v_total + public.reservas__fijo_materializar(v_id);
  end loop;
  return v_total;
end;
$$;

-- ---------------------------------------------------------------------
-- Funciones de la API
-- ---------------------------------------------------------------------

create or replace function public.reservas_fijos_sincronizar(p_token uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.reservas__sesion(p_token);
  return public.reservas__fijos_sincronizar_todos();
end;
$$;

-- Para cada fecha que tocaría el fijo (dentro de la ventana): qué canchas están libres
-- a esa hora y, si la cancha pedida está ocupada, por quién.
-- p_excluir: id del fijo que se está editando (sus propias reservas no cuentan como ocupado).
create or replace function public.reservas_fijo_previsualizar(
  p_complejo text,
  p_canchas  text[],
  p_cancha   text,
  p_dia      smallint,
  p_hora     text,
  p_desde    date,
  p_hasta    date default null,
  p_excluir  uuid default null
)
returns table (dia date, libres text[], ocupado_por text, ocupado_para text, ocupado_fijo boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ventana as (
    select public.reservas__hoy() as hoy,
           public.reservas__hoy() + public.reservas__dias_adelante() as fin
  ),
  dias as (
    select g::date as fecha
      from ventana v,
           generate_series(greatest(p_desde, v.hoy), least(coalesce(p_hasta, v.fin), v.fin), interval '1 day') g
     where extract(dow from g) = p_dia
       and public.reservas__futuro(g::date, p_hora)
  ),
  ocup as (
    select t.fecha, t.cancha, t.actualizado_por, t.reservado_para, t.fijo_id
      from public.reservas_turnos t
      join dias d on d.fecha = t.fecha
     where t.complejo = p_complejo
       and t.hora = p_hora
       and t.estado = 'reservada'
       and (p_excluir is null or t.fijo_id is distinct from p_excluir)
  )
  select d.fecha,
         array(select u.c
                 from unnest(p_canchas) with ordinality u(c, pos)
                where not exists (select 1 from ocup x where x.fecha = d.fecha and x.cancha = u.c)
                order by u.pos),
         o.actualizado_por,
         o.reservado_para,
         o.fijo_id is not null
    from dias d
    left join ocup o on o.fecha = d.fecha and o.cancha = p_cancha
   order by d.fecha;
$$;

-- Crea (p_id null) o edita un fijo y actualiza sus reservas. Devuelve el id.
create or replace function public.reservas_fijo_guardar(
  p_token    uuid,
  p_id       uuid,
  p_complejo text,
  p_cancha   text,
  p_dia      smallint,
  p_hora     text,
  p_para     text,
  p_desde    date,
  p_hasta    date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text := public.reservas__sesion(p_token);
  v_para   text := nullif(left(trim(coalesce(p_para, '')), 40), '');
  v_ant    public.reservas_fijos;
  v_choque text;
  v_id     uuid;
begin
  if v_para is null then
    raise exception 'Indicá para quién es el turno fijo.' using errcode = '22023';
  end if;
  if p_desde is null then
    raise exception 'Indicá desde qué fecha arranca.' using errcode = '22023';
  end if;
  if p_hasta is not null and p_hasta < p_desde then
    raise exception 'La fecha "hasta" no puede ser anterior a "desde".' using errcode = '22023';
  end if;

  select f.para into v_choque
    from public.reservas_fijos f
   where f.complejo = p_complejo and f.cancha = p_cancha
     and f.dia_semana = p_dia and f.hora = p_hora
     and f.id is distinct from p_id
     and daterange(f.desde, f.hasta, '[]') && daterange(p_desde, p_hasta, '[]')
   limit 1;
  if v_choque is not null then
    raise exception 'Ya hay un turno fijo en ese día, horario y cancha (para %).', v_choque using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.reservas_fijos
           (complejo, cancha, dia_semana, hora, para, desde, hasta, creado_por, actualizado_por)
    values (p_complejo, p_cancha, p_dia, p_hora, v_para, p_desde, p_hasta, v_nombre, v_nombre)
    returning id into v_id;
  else
    select * into v_ant from public.reservas_fijos where id = p_id for update;
    if not found then
      raise exception 'Ese turno fijo ya no existe.' using errcode = '22023';
    end if;

    perform public.reservas__fijo_liberar_futuros(p_id, v_nombre);

    -- si cambió el horario, las fechas salteadas a mano ya no aplican
    if (v_ant.complejo, v_ant.cancha, v_ant.dia_semana, v_ant.hora)
       is distinct from (p_complejo, p_cancha, p_dia, p_hora) then
      delete from public.reservas_fijos_excepciones where fijo_id = p_id;
    end if;

    update public.reservas_fijos
       set complejo = p_complejo, cancha = p_cancha, dia_semana = p_dia, hora = p_hora,
           para = v_para, desde = p_desde, hasta = p_hasta,
           actualizado_por = v_nombre, actualizado = now()
     where id = p_id;
    v_id := p_id;
  end if;

  perform public.reservas__fijo_materializar(v_id);
  return v_id;
end;
$$;

create or replace function public.reservas_fijo_eliminar(p_token uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text := public.reservas__sesion(p_token);
begin
  perform public.reservas__fijo_liberar_futuros(p_id, v_nombre);
  delete from public.reservas_fijos where id = p_id;  -- las reservas pasadas quedan, con fijo_id en null
end;
$$;

-- ---------------------------------------------------------------------
-- reservas_set_estado (7 parámetros, la de la migración 003) ahora
-- también maneja fijos: liberar una fecha de un fijo la anota como
-- excepción y una reserva a mano nunca queda atada a un fijo.
-- ---------------------------------------------------------------------
create or replace function public.reservas_set_estado(
  p_token    uuid,
  p_fecha    date,
  p_complejo text,
  p_cancha   text,
  p_hora     text,
  p_estado   text,
  p_para     text
)
returns public.reservas_turnos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_para text := nullif(left(trim(coalesce(p_para, '')), 40), '');
  v_fijo uuid;
  v_fila public.reservas_turnos;
  v_act  public.reservas_turnos;
  v_hay  boolean;
begin
  if p_estado = 'reservada' and v_para is null then
    raise exception 'Indicá para quién es la reserva.' using errcode = '22023';
  end if;

  select fijo_id into v_fijo
    from public.reservas_turnos
   where fecha = p_fecha and complejo = p_complejo and cancha = p_cancha and hora = p_hora;

  -- valida sesión y rango de fechas, guarda estado y quién lo cambió
  v_fila := public.reservas_set_estado(p_token, p_fecha, p_complejo, p_cancha, p_hora, p_estado);

  update public.reservas_turnos
     set reservado_para = case when p_estado = 'reservada' then v_para else null end,
         fijo_id = null
   where fecha = p_fecha and complejo = p_complejo and cancha = p_cancha and hora = p_hora
  returning * into v_act;
  v_hay := found;

  if p_estado = 'libre' and v_fijo is not null then
    insert into public.reservas_fijos_excepciones (fijo_id, fecha)
    values (v_fijo, p_fecha)
    on conflict do nothing;
  end if;

  if not v_hay then
    return v_fila;  -- por si la función base borra la fila al liberar
  end if;
  return v_act;
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke all on function public.reservas__dias_adelante()                 from public;
revoke all on function public.reservas__hoy()                           from public;
revoke all on function public.reservas__futuro(date, text)              from public;
revoke all on function public.reservas__sesion(uuid)                    from public;
revoke all on function public.reservas__fijo_materializar(uuid)         from public;
revoke all on function public.reservas__fijo_liberar_futuros(uuid, text) from public;
revoke all on function public.reservas__fijos_sincronizar_todos()       from public;

revoke all on function public.reservas_fijos_sincronizar(uuid)                                              from public;
revoke all on function public.reservas_fijo_previsualizar(text, text[], text, smallint, text, date, date, uuid) from public;
revoke all on function public.reservas_fijo_guardar(uuid, uuid, text, text, smallint, text, text, date, date)  from public;
revoke all on function public.reservas_fijo_eliminar(uuid, uuid)                                            from public;
revoke all on function public.reservas_set_estado(uuid, date, text, text, text, text, text)                from public;

grant execute on function public.reservas_fijos_sincronizar(uuid)                                              to anon, authenticated;
grant execute on function public.reservas_fijo_previsualizar(text, text[], text, smallint, text, date, date, uuid) to anon, authenticated;
grant execute on function public.reservas_fijo_guardar(uuid, uuid, text, text, smallint, text, text, date, date)  to anon, authenticated;
grant execute on function public.reservas_fijo_eliminar(uuid, uuid)                                            to anon, authenticated;
grant execute on function public.reservas_set_estado(uuid, date, text, text, text, text, text)                to anon, authenticated;

-- ---------------------------------------------------------------------
-- Tiempo real para la lista de fijos
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reservas_fijos'
  ) then
    alter publication supabase_realtime add table public.reservas_fijos;
  end if;
end $$;

-- Primera carga
select public.reservas__fijos_sincronizar_todos();

-- ---------------------------------------------------------------------
-- OPCIONAL: que la ventana se corra sola aunque nadie abra la app.
-- Requiere la extensión pg_cron (Database → Extensions → pg_cron).
--   select cron.schedule('reservas-fijos-diario', '5 3 * * *',
--                        $$select public.reservas__fijos_sincronizar_todos()$$);
-- ---------------------------------------------------------------------
