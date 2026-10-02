-- =====================================================================
-- Migración 003 · "¿Para quién es la reserva?"
-- Correr UNA vez en el SQL Editor de Supabase, después de la 001 y la 002.
--
-- * Agrega reservas_turnos.reservado_para.
-- * Agrega una sobrecarga de reservas_set_estado con p_para.
--   NO reemplaza la función de 6 parámetros: la llama, así se mantienen
--   la validación de rango de fechas, la limpieza y todo lo que ya haga.
-- =====================================================================

alter table public.reservas_turnos
  add column if not exists reservado_para text
  check (reservado_para is null or char_length(reservado_para) between 1 and 40);

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
  v_fila public.reservas_turnos;
  v_act  public.reservas_turnos;
begin
  if p_estado = 'reservada' and v_para is null then
    raise exception 'Indicá para quién es la reserva.' using errcode = '22023';
  end if;

  -- valida sesión y rango de fechas, guarda estado y quién lo cambió
  v_fila := public.reservas_set_estado(p_token, p_fecha, p_complejo, p_cancha, p_hora, p_estado);

  -- al liberar se limpia el "para quién"
  update public.reservas_turnos
     set reservado_para = case when p_estado = 'reservada' then v_para else null end
   where fecha = p_fecha and complejo = p_complejo and cancha = p_cancha and hora = p_hora
  returning * into v_act;

  if not found then
    return v_fila;  -- por si la función base borra la fila al liberar
  end if;
  return v_act;
end;
$$;

revoke all on function public.reservas_set_estado(uuid, date, text, text, text, text, text) from public;
grant execute on function public.reservas_set_estado(uuid, date, text, text, text, text, text) to anon, authenticated;
