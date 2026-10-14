-- =====================================================================
-- El Clásico · Migración 008 · Horarios administrables
-- Correr UNA vez en el SQL Editor de Supabase (se puede volver a correr).
--
--   * public.reservas_horarios: la grilla de horarios de cada complejo, editable desde la app
--     (ícono ⚙ junto a Ayuda). Reemplaza la lista fija que antes vivía en complejos.ts.
--   * Al agregar un horario no hay nada que revisar.
--   * Al eliminar un horario:
--       - se liberan las reservas futuras en ese horario, en ese complejo;
--       - se eliminan los turnos fijos en ese horario (sus reservas futuras se liberan primero);
--       - se les saca ese horario a los bloqueos que lo tenían marcado (si un bloqueo se queda
--         sin ningún horario, se elimina solo: ya no bloquearía nada).
--   * Siempre tiene que quedar al menos un horario por complejo.
--
-- Se arranca con los horarios actuales de la app. Para agregar o sacar horarios de acá en
-- adelante, usar el ícono ⚙ en la app: no hace falta tocar el código.
-- =====================================================================

create table if not exists public.reservas_horarios (
  complejo text not null check (complejo in ('el-clasico', 'el-clasico-2')),
  hora     text not null check (hora ~ '^[0-2][0-9]:[0-5][0-9]$'),
  creado   timestamptz not null default now(),
  primary key (complejo, hora)
);

alter table public.reservas_horarios enable row level security;
drop policy if exists "reservas_horarios lectura publica" on public.reservas_horarios;
create policy "reservas_horarios lectura publica"
  on public.reservas_horarios for select to anon, authenticated using (true);
grant select on table public.reservas_horarios to anon, authenticated;

insert into public.reservas_horarios (complejo, hora)
values ('el-clasico', '10:00'),
       ('el-clasico', '11:30'),
       ('el-clasico', '13:00'),
       ('el-clasico', '14:30'),
       ('el-clasico', '16:00'),
       ('el-clasico', '17:30'),
       ('el-clasico', '19:00'),
       ('el-clasico', '20:30'),
       ('el-clasico', '22:00'),
       ('el-clasico', '23:30'),
       ('el-clasico-2', '10:00'),
       ('el-clasico-2', '11:30'),
       ('el-clasico-2', '13:00'),
       ('el-clasico-2', '14:30'),
       ('el-clasico-2', '16:00'),
       ('el-clasico-2', '17:30'),
       ('el-clasico-2', '19:00'),
       ('el-clasico-2', '20:30'),
       ('el-clasico-2', '22:00'),
       ('el-clasico-2', '23:30')
on conflict (complejo, hora) do nothing;

-- Qué reservas, fijos y bloqueos usan ese horario en ese complejo (para avisar antes de eliminarlo)
create or replace function public.reservas_horario_previsualizar(p_complejo text, p_hora text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'reservas', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', t.fecha, 'cancha', t.cancha, 'para', t.reservado_para, 'cargo', t.actualizado_por) order by t.fecha, t.cancha)
        from public.reservas_turnos t
       where t.complejo = p_complejo and t.hora = p_hora and t.estado = 'reservada' and public.reservas__futuro(t.fecha, t.hora)
    ), '[]'::jsonb),
    'fijos', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'cancha', f.cancha, 'para', f.para, 'dia_semana', f.dia_semana) order by f.dia_semana, f.cancha)
        from public.reservas_fijos f
       where f.complejo = p_complejo and f.hora = p_hora
    ), '[]'::jsonb),
    'bloqueos', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'canchas', b.canchas, 'desde', b.desde, 'hasta', b.hasta, 'motivo', b.motivo, 'nota', b.nota) order by b.desde)
        from public.reservas_bloqueos b
       where b.complejo = p_complejo and b.horas is not null and p_hora = any (b.horas)
    ), '[]'::jsonb)
  )
$$;

create or replace function public.reservas_horario_agregar(p_token uuid, p_complejo text, p_hora text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.reservas__sesion(p_token);
  if p_hora !~ '^[0-2][0-9]:[0-5][0-9]$' then
    raise exception 'Ese horario no es válido.' using errcode = '22023';
  end if;
  insert into public.reservas_horarios (complejo, hora) values (p_complejo, p_hora)
  on conflict (complejo, hora) do nothing;
end;
$$;

create or replace function public.reservas_horario_eliminar(p_token uuid, p_complejo text, p_hora text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text := public.reservas__sesion(p_token);
  b        record;
begin
  if (select count(*) from public.reservas_horarios where complejo = p_complejo) <= 1 then
    raise exception 'Tiene que quedar al menos un horario.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.reservas_horarios where complejo = p_complejo and hora = p_hora) then
    return; -- ya no está: nada que hacer
  end if;

  -- liberar reservas futuras de ese horario, en ese complejo
  update public.reservas_turnos t
     set estado = 'libre', reservado_para = null, fijo_id = null,
         actualizado_por = v_nombre, actualizado = now()
   where t.complejo = p_complejo and t.hora = p_hora and t.estado = 'reservada' and public.reservas__futuro(t.fecha, t.hora);

  -- eliminar los fijos de ese horario en ese complejo (ya liberados arriba; esto además borra la regla)
  delete from public.reservas_fijos where complejo = p_complejo and hora = p_hora;

  -- sacarle ese horario a los bloqueos puntuales de ese complejo; si queda sin ninguno, se elimina
  for b in select id, horas from public.reservas_bloqueos where complejo = p_complejo and horas is not null and p_hora = any (horas)
  loop
    if cardinality(b.horas) <= 1 then
      delete from public.reservas_bloqueos where id = b.id;
    else
      update public.reservas_bloqueos set horas = array_remove(b.horas, p_hora) where id = b.id;
    end if;
  end loop;

  delete from public.reservas_horarios where complejo = p_complejo and hora = p_hora;
end;
$$;

revoke all on function public.reservas_horario_previsualizar(text, text) from public;
revoke all on function public.reservas_horario_agregar(uuid, text, text) from public;
revoke all on function public.reservas_horario_eliminar(uuid, text, text) from public;
grant execute on function public.reservas_horario_previsualizar(text, text) to anon, authenticated;
grant execute on function public.reservas_horario_agregar(uuid, text, text) to anon, authenticated;
grant execute on function public.reservas_horario_eliminar(uuid, text, text) to anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reservas_horarios') then
    alter publication supabase_realtime add table public.reservas_horarios;
  end if;
end $$;
