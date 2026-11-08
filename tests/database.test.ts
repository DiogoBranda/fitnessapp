import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const db = new PGlite();
const ids = {
  trainer: "00000000-0000-4000-8000-000000000001",
  student: "00000000-0000-4000-8000-000000000002",
  other: "00000000-0000-4000-8000-000000000003",
  admin: "00000000-0000-4000-8000-000000000004",
  plan: "00000000-0000-4000-8000-000000000005",
  session: "00000000-0000-4000-8000-000000000006",
  chain: "00000000-0000-4000-8000-000000000007",
};
const workouts = [
  {
    id: "w1",
    name: "Treino A",
    focus: "Força",
    exercises: [
      {
        id: "e1",
        name: "Agachamento",
        sets: 2,
        min: 8,
        max: 12,
        rest: 90,
        equipment: "Barra",
      },
    ],
  },
];
const sets = [1, 2].map((n) => ({
  exercise_id: "e1",
  name: "Agachamento",
  set: n,
  reps: 10,
  weight: 20,
  done: false,
}));
async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
beforeAll(async () => {
  await db.exec(
    "create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;",
  );
  await db.exec(readFileSync("supabase/migrations/001_initial.sql", "utf8"));
  for (const [name, id] of Object.entries(ids).slice(0, 4))
    await db.query("insert into auth.users values($1,$2)", [
      id,
      JSON.stringify({ name, role: name === "other" ? "student" : name }),
    ]);
  await db.query("update public.profiles set role='admin' where id=$1", [
    ids.admin,
  ]);
  const { rows } = await db.query<{ invite_code: string }>(
    "select invite_code from profiles where id=$1",
    [ids.student],
  );
  await asUser(ids.trainer);
  await db.query("select public.link_student($1)", [rows[0].invite_code]);
  await db.query(
    "insert into plans(id,trainer_id,student_id,name,workouts) values($1,$2,$3,$4,$5)",
    [
      ids.plan,
      ids.trainer,
      ids.student,
      "Plano de força",
      JSON.stringify(workouts),
    ],
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
describe.sequential("permissões e integridade PostgreSQL", () => {
  it("isola alunos e impede a promoção de privilégios", async () => {
    await asUser(ids.other);
    expect((await db.query("select * from plans")).rows).toHaveLength(0);
    expect((await db.query("select * from profiles")).rows).toHaveLength(1);
    await expect(
      db.query("update profiles set role='admin' where id=$1", [ids.other]),
    ).rejects.toThrow();
    await expect(
      db.query("insert into coaching(trainer_id,student_id) values($1,$2)", [
        ids.trainer,
        ids.other,
      ]),
    ).rejects.toThrow();
  });
  it("permite mensagens apenas entre associados e no contexto correto", async () => {
    await asUser(ids.student);
    await db.query(
      "insert into messages(sender_id,recipient_id,body,plan_id,workout_id,exercise_id) values($1,$2,$3,$4,$5,$6)",
      [
        ids.student,
        ids.trainer,
        "A técnica está melhor?",
        ids.plan,
        "w1",
        "e1",
      ],
    );
    await expect(
      db.query(
        "insert into messages(sender_id,recipient_id,body) values($1,$2,$3)",
        [ids.student, ids.other, "Não autorizado"],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into messages(sender_id,recipient_id,body,plan_id,workout_id,exercise_id) values($1,$2,$3,$4,$5,$6)",
        [ids.student, ids.trainer, "Contexto inválido", ids.plan, "w2", "e1"],
      ),
    ).rejects.toThrow();
  });
  it("regista séries, bloqueia duplicados e só conclui treinos completos", async () => {
    await asUser(ids.student);
    await db.query(
      "insert into sessions(id,student_id,plan_id,workout_id,workout_name,sets) values($1,$2,$3,$4,$5,$6)",
      [
        ids.session,
        ids.student,
        ids.plan,
        "w1",
        "Treino A",
        JSON.stringify(sets),
      ],
    );
    await expect(
      db.query("update sessions set completed_at=now() where id=$1", [
        ids.session,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query("update sessions set sets=$1 where id=$2", [
        JSON.stringify([sets[0], sets[0]]),
        ids.session,
      ]),
    ).rejects.toThrow();
    await db.query(
      "update sessions set sets=$1,completed_at=now() where id=$2",
      [JSON.stringify(sets.map((s) => ({ ...s, done: true }))), ids.session],
    );
    expect(
      (await db.query("select * from sessions where completed_at is not null"))
        .rows,
    ).toHaveLength(1);
    await asUser(ids.other);
    expect((await db.query("select * from sessions")).rows).toHaveLength(0);
    await asUser(ids.trainer);
    expect((await db.query("select * from sessions")).rows).toHaveLength(1);
    expect(
      (
        await db.query("update sessions set sets=$1 where id=$2 returning id", [
          JSON.stringify(sets),
          ids.session,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("arquiva preservando as conversas e o histórico", async () => {
    await asUser(ids.trainer);
    await db.query("update plans set archived=true where id=$1", [ids.plan]);
    expect((await db.query("select * from messages")).rows).toHaveLength(1);
    expect((await db.query("select * from sessions")).rows).toHaveLength(1);
    await expect(
      db.query("update plans set workouts=$1 where id=$2", [
        JSON.stringify([{ ...workouts[0], name: "Alterado" }]),
        ids.plan,
      ]),
    ).rejects.toThrow();
    await asUser(ids.student);
    await expect(
      db.query(
        "insert into sessions(student_id,plan_id,workout_id,workout_name,sets) values($1,$2,$3,$4,$5)",
        [ids.student, ids.plan, "w1", "Treino A", JSON.stringify(sets)],
      ),
    ).rejects.toThrow();
  });
  it("reserva a validação das cadeias ao administrador", async () => {
    await asUser(ids.student);
    await db.query("insert into chains(id,name,created_by) values($1,$2,$3)", [
      ids.chain,
      "Ginásio da comunidade",
      ids.student,
    ]);
    expect(
      (
        await db.query(
          "update chains set status='approved' where id=$1 returning id",
          [ids.chain],
        )
      ).rows,
    ).toHaveLength(0);
    await asUser(ids.admin);
    expect(
      (
        await db.query(
          "update chains set status='approved' where id=$1 returning id",
          [ids.chain],
        )
      ).rows,
    ).toHaveLength(1);
    expect((await db.query("select * from sessions")).rows).toHaveLength(0);
  });
});
