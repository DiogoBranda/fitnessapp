export type Role = "trainer" | "student" | "admin";
export type Profile = {
  id: string;
  name: string;
  role: Role;
  invite_code: string;
};
export type Exercise = {
  id: string;
  name: string;
  sets: number;
  min: number;
  max: number;
  rest: number;
  equipment: string;
};
export type Workout = {
  id: string;
  name: string;
  focus: string;
  exercises: Exercise[];
};
export type Plan = {
  id: string;
  trainer_id: string;
  student_id: string;
  name: string;
  description: string;
  archived: boolean;
  workouts: Workout[];
  created_at: string;
};
export type SetLog = {
  exercise_id: string;
  name: string;
  set: number;
  reps: number;
  weight: number;
  done: boolean;
};
export type Session = {
  id: string;
  student_id: string;
  plan_id: string;
  workout_id: string;
  workout_name: string;
  started_at: string;
  completed_at: string | null;
  sets: SetLog[];
};
export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  plan_id: string | null;
  workout_id: string | null;
  exercise_id: string | null;
};
export type Gym = {
  id: string;
  name: string;
  chain: string;
  city: string;
  equipment: string[];
  created_by: string;
};
export type Chain = {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  created_by: string;
};
export type Store = {
  profiles: Profile[];
  plans: Plan[];
  sessions: Session[];
  messages: Message[];
  gyms: Gym[];
  chains: Chain[];
};
export const uid = () => crypto.randomUUID();
export const emptyStore = (): Store => ({
  profiles: [],
  plans: [],
  sessions: [],
  messages: [],
  gyms: [],
  chains: [],
});
export const equipment = [
  "Halteres",
  "Barra olímpica",
  "Banco ajustável",
  "Rack de agachamento",
  "Prensa de pernas",
  "Polia alta",
  "Cabos",
  "Máquina extensora",
  "Máquina flexora",
  "Passadeira",
  "Bicicleta",
  "Kettlebells",
];
export const catalogue = [
  { name: "Agachamento com barra", equipment: "Rack de agachamento" },
  { name: "Supino com halteres", equipment: "Halteres" },
  { name: "Remada na polia baixa", equipment: "Cabos" },
  { name: "Peso morto romeno", equipment: "Barra olímpica" },
  { name: "Puxada na polia alta", equipment: "Polia alta" },
  { name: "Prensa de pernas", equipment: "Prensa de pernas" },
  { name: "Desenvolvimento de ombros", equipment: "Halteres" },
  { name: "Elevações laterais", equipment: "Halteres" },
  { name: "Curl de bíceps", equipment: "Halteres" },
  { name: "Extensão de tríceps", equipment: "Cabos" },
  { name: "Prancha", equipment: "Peso corporal" },
];
export function newExercise(name = catalogue[0].name): Exercise {
  return {
    id: uid(),
    name,
    sets: 3,
    min: 8,
    max: 12,
    rest: 90,
    equipment:
      catalogue.find((e) => e.name === name)?.equipment || "Peso corporal",
  };
}
export function newWorkout(): Workout {
  return {
    id: uid(),
    name: "Treino A",
    focus: "Corpo inteiro",
    exercises: [newExercise()],
  };
}
export function createSession(
  plan: Plan,
  workout: Workout,
  studentId: string,
): Session {
  if (plan.archived || plan.student_id !== studentId)
    throw new Error("Este plano não está disponível.");
  return {
    id: uid(),
    student_id: studentId,
    plan_id: plan.id,
    workout_id: workout.id,
    workout_name: workout.name,
    started_at: new Date().toISOString(),
    completed_at: null,
    sets: workout.exercises.flatMap((e) =>
      Array.from({ length: e.sets }, (_, i) => ({
        exercise_id: e.id,
        name: e.name,
        set: i + 1,
        reps: e.min,
        weight: 0,
        done: false,
      })),
    ),
  };
}
export const volume = (session: Session) =>
  session.sets.filter((s) => s.done).reduce((n, s) => n + s.reps * s.weight, 0);
export function validatePlan(plan: Plan): string | null {
  if (!plan.name.trim() || !plan.student_id)
    return "Indica o nome do plano e o aluno.";
  if (!plan.workouts.length) return "Adiciona pelo menos um treino.";
  for (const w of plan.workouts) {
    if (!w.name.trim() || !w.exercises.length)
      return "Cada treino precisa de um nome e de exercícios.";
    for (const e of w.exercises)
      if (
        !e.name.trim() ||
        !Number.isInteger(e.sets) ||
        e.sets < 1 ||
        e.sets > 20 ||
        !Number.isInteger(e.min) ||
        !Number.isInteger(e.max) ||
        e.min < 1 ||
        e.max < e.min ||
        e.max > 100 ||
        !Number.isFinite(e.rest) ||
        e.rest < 0
      )
        return "Verifica as séries (1–20) e o intervalo de repetições (1–100).";
  }
  return null;
}
export function canComplete(session: Session) {
  return (
    session.sets.length > 0 &&
    session.sets.every(
      (s) =>
        s.done &&
        Number.isInteger(s.reps) &&
        s.reps > 0 &&
        s.reps <= 100 &&
        Number.isFinite(s.weight) &&
        s.weight >= 0 &&
        s.weight <= 1000,
    )
  );
}
export function csvReport(sessions: Session[]): string {
  const cell = (v: unknown) =>
    '"' +
    String(v)
      .replace(/^[=+@\-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return (
    "\uFEFF" +
    [
      [
        "Data",
        "Treino",
        "Exercício",
        "Série",
        "Repetições",
        "Carga (kg)",
        "Volume (kg)",
      ],
      ...sessions
        .filter((s) => s.completed_at)
        .flatMap((s) =>
          s.sets
            .filter((x) => x.done)
            .map((x) => [
              new Date(s.completed_at!).toLocaleDateString("pt-PT"),
              s.workout_name,
              x.name,
              x.set,
              x.reps,
              x.weight,
              x.reps * x.weight,
            ]),
        ),
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n")
  );
}
