-- =====================================================================
-- Migración 007 · Motivos de bloqueo "Torneo" y "Clases"
-- Correr UNA vez en el SQL Editor de Supabase, después de la 006 (se puede volver a correr).
-- =====================================================================

-- reemplaza el control de motivos válidos (el nombre lo puso Postgres, así que se busca)
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.reservas_bloqueos'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%motivo%'
  loop
    execute format('alter table public.reservas_bloqueos drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.reservas_bloqueos
  add constraint reservas_bloqueos_motivo_check
  check (motivo in ('reparacion', 'evento', 'torneo', 'clases', 'otro'));

create or replace function public.reservas__motivo_bloqueo(p_complejo text, p_cancha text, p_fecha date, p_hora text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case b.motivo when 'reparacion' then 'Reparación' when 'evento' then 'Evento' when 'torneo' then 'Torneo' when 'clases' then 'Clases' else 'Otro' end
    from public.reservas_bloqueos b
   where b.complejo = p_complejo
     and p_fecha between b.desde and b.hasta
     and (b.canchas is null or p_cancha = any (b.canchas))
     and (b.horas is null or p_hora = any (b.horas))
   order by b.creado
   limit 1
$$;

create or replace function public.reservas_bloqueo_guardar(
  p_token    uuid,
  p_id       uuid,
  p_complejo text,
  p_canchas  text[],
  p_desde    date,
  p_hasta    date,
  p_horas    text[],
  p_motivo   text,
  p_nota     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text := public.reservas__sesion(p_token);
  v_nota   text := nullif(left(trim(coalesce(p_nota, '')), 60), '');
  v_canch  text[] := case when p_canchas is null or cardinality(p_canchas) = 0 then null else p_canchas end;
  v_horas  text[] := case when p_horas is null or cardinality(p_horas) = 0 then null else p_horas end;
  v_id     uuid;
begin
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Revisá las fechas: "hasta" no puede ser anterior a "desde".' using errcode = '22023';
  end if;
  if p_hasta < public.reservas__hoy() then
    raise exception 'El bloqueo tiene que incluir hoy o días posteriores.' using errcode = '22023';
  end if;
  if p_motivo not in ('reparacion', 'evento', 'torneo', 'clases', 'otro') then
    raise exception 'Elegí un motivo.' using errcode = '22023';
  end if;
  if v_horas is not null and exists (select 1 from unnest(v_horas) h where h !~ '^[0-2][0-9]:[0-5][0-9]$') then
    raise exception 'Hay un turno con formato inválido.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.reservas_bloqueos (complejo, canchas, desde, hasta, horas, motivo, nota, creado_por, actualizado_por)
    values (p_complejo, v_canch, p_desde, p_hasta, v_horas, p_motivo, v_nota, v_nombre, v_nombre)
    returning id into v_id;
  else
    update public.reservas_bloqueos
       set complejo = p_complejo, canchas = v_canch, desde = p_desde, hasta = p_hasta, horas = v_horas,
           motivo = p_motivo, nota = v_nota, actualizado_por = v_nombre, actualizado = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Ese bloqueo ya no existe.' using errcode = '22023';
    end if;
  end if;

  -- liberar lo que choca (de fijos, solo esa fecha: el fijo no lo vuelve a tomar mientras esté bloqueado)
  update public.reservas_turnos t
     set estado = 'libre', reservado_para = null, fijo_id = null,
         actualizado_por = v_nombre, actualizado = now()
   where t.complejo = p_complejo
     and t.estado = 'reservada'
     and t.fecha between p_desde and p_hasta
     and (v_canch is null or t.cancha = any (v_canch))
     and (v_horas is null or t.hora = any (v_horas))
     and public.reservas__futuro(t.fecha, t.hora);

  -- si se achicó un bloqueo, los fijos vuelven a tomar lo que quedó libre
  perform public.reservas__fijos_sincronizar_todos();
  return v_id;
end;
$$;