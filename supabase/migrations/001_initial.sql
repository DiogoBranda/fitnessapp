-- Forma: run once in a new Supabase project. No demo users or data are inserted.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 100),
 role text not null check (role in ('student','trainer','admin')),
 invite_code text not null unique default gen_random_uuid()::text
);
create table public.coaching (
 trainer_id uuid not null references public.profiles(id),
 student_id uuid primary key references public.profiles(id),
 created_at timestamptz not null default now(),
 check (trainer_id <> student_id)
);
create table public.plans (
 id uuid primary key default gen_random_uuid(),
 trainer_id uuid not null references public.profiles(id),
 student_id uuid not null references public.profiles(id),
 name text not null check (length(trim(name)) between 1 and 120),
 description text not null default '' check (length(description)<=1000),
 archived boolean not null default false,
 workouts jsonb not null check (jsonb_typeof(workouts)='array' and jsonb_array_length(workouts)>0),
 created_at timestamptz not null default now()
);
create table public.sessions (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.profiles(id),
 plan_id uuid not null references public.plans(id),
 workout_id text not null,
 workout_name text not null,
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 sets jsonb not null check (jsonb_typeof(sets)='array' and jsonb_array_length(sets)>0),
 check (completed_at is null or completed_at >= started_at)
);
create unique index one_active_workout on public.sessions(student_id) where completed_at is null;
create table public.messages (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.profiles(id),
 recipient_id uuid not null references public.profiles(id),
 body text not null check (length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now(),
 plan_id uuid references public.plans(id),
 workout_id text,
 exercise_id text,
 check (sender_id<>recipient_id),
 check ((plan_id is null and workout_id is null and exercise_id is null) or (plan_id is not null and workout_id is not null and exercise_id is not null))
);
create table public.chains (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check (length(trim(name)) between 1 and 100),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_by uuid not null references public.profiles(id)
);
create unique index chains_name_case_insensitive on public.chains(lower(name));
create table public.gyms (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 1 and 120),
 chain text not null references public.chains(name),
 city text not null check (length(trim(city)) between 1 and 100),
 equipment text[] not null check (cardinality(equipment) between 1 and 100),
 created_by uuid not null references public.profiles(id)
);
create index plans_student on public.plans(student_id);
create index plans_trainer on public.plans(trainer_id);
create index coaching_trainer on public.coaching(trainer_id);
create index sessions_student on public.sessions(student_id,completed_at);
create index messages_recipient on public.messages(recipient_id,created_at);
create index messages_sender on public.messages(sender_id,created_at);
create index messages_context on public.messages(plan_id,workout_id,exercise_id);

create function public.app_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.profiles where id=(select auth.uid());
$$;
create function public.are_linked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.coaching where (trainer_id=a and student_id=b) or (trainer_id=b and student_id=a));
$$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,name,role) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'Novo membro'),100),case when new.raw_user_meta_data->>'role'='trainer' then 'trainer' else 'student' end);
 return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.link_student(code text) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if auth.uid() is null or public.app_role()<>'trainer' then raise exception 'Apenas personal trainers podem associar alunos'; end if;
 select id into target from public.profiles where invite_code=code and role='student';
 if target is null then raise exception 'Código inválido'; end if;
 insert into public.coaching(trainer_id,student_id) values(auth.uid(),target);
 -- One-time invitation, so a previously shared code cannot be reused.
 update public.profiles set invite_code=gen_random_uuid()::text where id=target;
end;
$$;

create function public.validate_plan() returns trigger language plpgsql set search_path='' as $$
declare w jsonb; e jsonb; ids text[] := '{}'; exercise_ids text[];
begin
 if TG_OP='UPDATE' then
  if new.trainer_id<>old.trainer_id or new.student_id<>old.student_id or new.id<>old.id then raise exception 'A associação de um plano não pode ser alterada'; end if;
  if new.workouts<>old.workouts and (exists(select 1 from public.sessions where plan_id=old.id) or exists(select 1 from public.messages where plan_id=old.id)) then
   raise exception 'Este plano já tem atividade. Cria um novo plano para alterar os treinos e preservar o histórico.';
  end if;
 end if;
 for w in select value from jsonb_array_elements(new.workouts) loop
  if coalesce(length(trim(w->>'id')),0)=0 or coalesce(length(trim(w->>'name')),0)=0 or w->>'id'=any(ids) or jsonb_typeof(w->'exercises') is distinct from 'array' then raise exception 'Treino inválido'; end if;
  ids=array_append(ids,w->>'id'); exercise_ids='{}';
  if jsonb_array_length(w->'exercises')=0 then raise exception 'Treino sem exercícios'; end if;
  for e in select value from jsonb_array_elements(w->'exercises') loop
   if coalesce(length(trim(e->>'id')),0)=0 or coalesce(length(trim(e->>'name')),0)=0 or e->>'id'=any(exercise_ids)
    or coalesce(e->>'sets','')!~'^[0-9]+$' or coalesce(e->>'min','')!~'^[0-9]+$' or coalesce(e->>'max','')!~'^[0-9]+$'
    then raise exception 'Exercício inválido'; end if;
   if (e->>'sets')::int not between 1 and 20 or (e->>'min')::int<1 or (e->>'max')::int<(e->>'min')::int or (e->>'max')::int>100 then raise exception 'Séries ou repetições inválidas'; end if;
   exercise_ids=array_append(exercise_ids,e->>'id');
  end loop;
 end loop;
 return new;
end;
$$;
create trigger validate_plan before insert or update on public.plans for each row execute function public.validate_plan();

create function public.validate_session() returns trigger language plpgsql set search_path='' as $$
declare w jsonb; p public.plans; item jsonb; prescribed jsonb; keys text[] := '{}'; key text; expected int;
begin
 select * into p from public.plans where id=new.plan_id;
 if p.id is null or p.student_id<>new.student_id then raise exception 'Plano inválido'; end if;
 if TG_OP='INSERT' and p.archived then raise exception 'Plano arquivado'; end if;
 if TG_OP='UPDATE' then
  if old.completed_at is not null then raise exception 'Treino já concluído'; end if;
  if new.id<>old.id or new.student_id<>old.student_id or new.plan_id<>old.plan_id or new.workout_id<>old.workout_id or new.started_at<>old.started_at then raise exception 'A sessão não pode mudar de contexto'; end if;
 end if;
 select value into w from jsonb_array_elements(p.workouts) where value->>'id'=new.workout_id;
 if w is null then raise exception 'Treino inválido'; end if;
 new.workout_name=w->>'name';
 select sum((value->>'sets')::int) into expected from jsonb_array_elements(w->'exercises');
 if jsonb_array_length(new.sets)<>expected then raise exception 'Número de séries inválido'; end if;
 for item in select value from jsonb_array_elements(new.sets) loop
  select value into prescribed from jsonb_array_elements(w->'exercises') where value->>'id'=item->>'exercise_id';
  if prescribed is null or coalesce(item->>'set','')!~'^[0-9]+$' or coalesce(item->>'reps','')!~'^[0-9]+$' or coalesce(item->>'weight','')!~'^[0-9]+(\.[0-9]+)?$' or jsonb_typeof(item->'done') is distinct from 'boolean' then raise exception 'Série inválida'; end if;
  if (item->>'set')::int not between 1 and (prescribed->>'sets')::int or (item->>'reps')::int not between 1 and 100 or (item->>'weight')::numeric not between 0 and 1000 then raise exception 'Valores da série inválidos'; end if;
  key=(item->>'exercise_id')||':'||(item->>'set');
  if key=any(keys) then raise exception 'Série duplicada'; end if;
  keys=array_append(keys,key);
  if new.completed_at is not null and (item->>'done')::boolean is not true then raise exception 'Conclui todas as séries'; end if;
 end loop;
 return new;
end;
$$;
create trigger validate_session before insert or update on public.sessions for each row execute function public.validate_session();

create function public.valid_message_context(p uuid,w text,e text,s uuid,r uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.plans plan cross join lateral jsonb_array_elements(plan.workouts) workout cross join lateral jsonb_array_elements(workout->'exercises') exercise where plan.id=p and workout->>'id'=w and exercise->>'id'=e and ((plan.trainer_id=s and plan.student_id=r) or (plan.student_id=s and plan.trainer_id=r)));
$$;

alter table public.profiles enable row level security;
alter table public.coaching enable row level security;
alter table public.plans enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.chains enable row level security;
alter table public.gyms enable row level security;

create policy profile_read on public.profiles for select to authenticated using (id=auth.uid() or public.are_linked(id,auth.uid()) or public.app_role()='admin');
create policy coaching_read on public.coaching for select to authenticated using (trainer_id=auth.uid() or student_id=auth.uid());
create policy plans_read on public.plans for select to authenticated using (trainer_id=auth.uid() or student_id=auth.uid());
create policy plans_insert on public.plans for insert to authenticated with check (trainer_id=auth.uid() and public.app_role()='trainer' and public.are_linked(trainer_id,student_id));
create policy plans_update on public.plans for update to authenticated using (trainer_id=auth.uid() and public.app_role()='trainer') with check (trainer_id=auth.uid() and public.are_linked(trainer_id,student_id));
create policy sessions_read on public.sessions for select to authenticated using (student_id=auth.uid() or public.are_linked(student_id,auth.uid()));
create policy sessions_insert on public.sessions for insert to authenticated with check (student_id=auth.uid() and public.app_role()='student');
create policy sessions_update on public.sessions for update to authenticated using (student_id=auth.uid() and completed_at is null) with check (student_id=auth.uid() and public.app_role()='student');
create policy messages_read on public.messages for select to authenticated using (sender_id=auth.uid() or recipient_id=auth.uid());
create policy messages_insert on public.messages for insert to authenticated with check (sender_id=auth.uid() and public.are_linked(sender_id,recipient_id) and (plan_id is null or public.valid_message_context(plan_id,workout_id,exercise_id,sender_id,recipient_id)));
create policy chains_read on public.chains for select to authenticated using (true);
create policy chains_insert on public.chains for insert to authenticated with check (created_by=auth.uid() and status='pending');
create policy chains_update on public.chains for update to authenticated using (public.app_role()='admin') with check (public.app_role()='admin');
create policy gyms_read on public.gyms for select to authenticated using (true);
create policy gyms_insert on public.gyms for insert to authenticated with check (created_by=auth.uid());

-- Explicit least-privilege grants: clients cannot promote users, link arbitrary
-- accounts, erase history, edit someone else's messages or approve gym chains.
revoke all on public.profiles,public.coaching,public.plans,public.sessions,public.messages,public.chains,public.gyms from anon,authenticated;
grant select on public.profiles,public.coaching,public.plans,public.sessions,public.messages,public.chains,public.gyms to authenticated;
grant insert on public.plans,public.sessions,public.messages,public.chains,public.gyms to authenticated;
grant update(name,description,archived,workouts) on public.plans to authenticated;
grant update(sets,completed_at) on public.sessions to authenticated;
grant update(status) on public.chains to authenticated;
revoke execute on function public.link_student(text),public.handle_new_user(),public.app_role(),public.are_linked(uuid,uuid),public.valid_message_context(uuid,text,text,uuid,uuid),public.validate_plan(),public.validate_session() from public,anon;
grant execute on function public.link_student(text),public.app_role(),public.are_linked(uuid,uuid),public.valid_message_context(uuid,text,text,uuid,uuid) to authenticated;
commit;
