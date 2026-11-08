import { describe, it, expect } from "vitest";
import { demoStore, demoIds } from "./seed";
import {
  createSession,
  canComplete,
  volume,
  validatePlan,
  csvReport,
} from "./domain";
describe("registo de treinos", () => {
  it("cria uma série por prescrição sem misturar exercícios", () => {
    const p = demoStore().plans[0],
      w = p.workouts[0],
      s = createSession(p, w, demoIds.student);
    expect(s.sets).toHaveLength(w.exercises.reduce((n, e) => n + e.sets, 0));
    expect(s.sets.every((x) => !x.done)).toBe(true);
    expect(s.plan_id).toBe(p.id);
    expect(s.workout_id).toBe(w.id);
  });
  it("impede começar planos arquivados ou de outro aluno", () => {
    const p = demoStore().plans[0];
    expect(() =>
      createSession({ ...p, archived: true }, p.workouts[0], demoIds.student),
    ).toThrow();
    expect(() => createSession(p, p.workouts[0], "outro-aluno")).toThrow();
  });
  it("exige todas as séries válidas para concluir", () => {
    const p = demoStore().plans[0],
      s = createSession(p, p.workouts[0], demoIds.student);
    expect(canComplete(s)).toBe(false);
    s.sets = s.sets.map((x) => ({ ...x, done: true, reps: 10, weight: 20 }));
    expect(canComplete(s)).toBe(true);
    expect(volume(s)).toBe(s.sets.length * 200);
    s.sets[0].weight = -1;
    expect(canComplete(s)).toBe(false);
  });
  it("não inclui séries incompletas no volume", () => {
    const p = demoStore().plans[0],
      s = createSession(p, p.workouts[0], demoIds.student);
    s.sets[0] = { ...s.sets[0], done: true, weight: 25, reps: 8 };
    s.sets[1] = { ...s.sets[1], weight: 100, reps: 10 };
    expect(volume(s)).toBe(200);
  });
});
describe("planos e relatórios", () => {
  it("valida séries e intervalos de repetições", () => {
    const p = demoStore().plans[0];
    expect(validatePlan(p)).toBeNull();
    p.workouts[0].exercises[0].min = 15;
    p.workouts[0].exercises[0].max = 8;
    expect(validatePlan(p)).not.toBeNull();
    p.workouts = [];
    expect(validatePlan(p)).not.toBeNull();
  });
  it("protege CSV de fórmulas e preserva acentos, separadores e aspas", () => {
    const s = demoStore().sessions[0];
    s.workout_name = '=HYPERLINK("teste")';
    s.sets[0].name = 'Extensão; "tríceps"';
    const csv = csvReport([s]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('Extensão; ""tríceps""');
    expect(csv).toContain("Repetições");
  });
  it("exporta apenas sessões concluídas", () => {
    const s = demoStore().sessions[0];
    expect(
      csvReport([{ ...s, completed_at: null }]).split("\r\n"),
    ).toHaveLength(1);
  });
});
