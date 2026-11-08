import { type Store, type Workout, newExercise } from "./domain";
export const demoIds = {
  trainer: "10000000-0000-4000-8000-000000000001",
  student: "10000000-0000-4000-8000-000000000002",
  admin: "10000000-0000-4000-8000-000000000003",
};
export function demoStore(): Store {
  const t = demoIds.trainer,
    s = demoIds.student;
  const workouts: Workout[] = [
    {
      id: "workout-a",
      name: "Treino A · Membros inferiores",
      focus: "Pernas · Glúteos · Core",
      exercises: [
        "Agachamento com barra",
        "Peso morto romeno",
        "Prensa de pernas",
        "Prancha",
      ].map((n) => newExercise(n)),
    },
    {
      id: "workout-b",
      name: "Treino B · Membros superiores",
      focus: "Peito · Costas · Ombros",
      exercises: [
        "Supino com halteres",
        "Remada na polia baixa",
        "Puxada na polia alta",
        "Elevações laterais",
      ].map((n) => newExercise(n)),
    },
    {
      id: "workout-c",
      name: "Treino C · Corpo inteiro",
      focus: "Força · Estabilidade",
      exercises: [
        "Agachamento com barra",
        "Desenvolvimento de ombros",
        "Curl de bíceps",
      ].map((n) => newExercise(n)),
    },
  ];
  const now = new Date();
  const ago = (days: number) =>
    new Date(now.getTime() - days * 86400000).toISOString();
  return {
    profiles: [
      { id: t, name: "Miguel Santos", role: "trainer", invite_code: "MIGUEL" },
      { id: s, name: "Beatriz Costa", role: "student", invite_code: "BEATRIZ" },
      {
        id: demoIds.admin,
        name: "Administrador",
        role: "admin",
        invite_code: "ADMIN",
      },
      {
        id: "student-2",
        name: "Tomás Ferreira",
        role: "student",
        invite_code: "TOMAS",
      },
      {
        id: "student-3",
        name: "Inês Martins",
        role: "student",
        invite_code: "INES",
      },
      {
        id: "student-4",
        name: "Pedro Silva",
        role: "student",
        invite_code: "PEDRO",
      },
    ],
    plans: [
      {
        id: "plan-1",
        trainer_id: t,
        student_id: s,
        name: "Mais forte, a cada semana",
        description:
          "Um plano de força progressiva, com espaço para evoluir ao teu ritmo.",
        archived: false,
        workouts,
        created_at: ago(28),
      },
    ],
    sessions: Array.from({ length: 12 }, (_, i) => ({
      id: "session-" + i,
      student_id: s,
      plan_id: "plan-1",
      workout_id: workouts[i % 3].id,
      workout_name: workouts[i % 3].name,
      started_at: ago(28 - i * 2),
      completed_at: new Date(
        new Date(ago(28 - i * 2)).getTime() + 52 * 60000,
      ).toISOString(),
      sets: workouts[i % 3].exercises.flatMap((e) =>
        Array.from({ length: 3 }, (_, j) => ({
          exercise_id: e.id,
          name: e.name,
          set: j + 1,
          reps: 10,
          weight: Math.round((20 + i * 2) / 2) * 2,
          done: true,
        })),
      ),
    })),
    messages: [
      {
        id: "msg-1",
        sender_id: s,
        recipient_id: t,
        body: "Olá Miguel! Senti-me muito bem no último treino. Já consegui aumentar a carga no agachamento 💪",
        created_at: ago(1),
        plan_id: null,
        workout_id: null,
        exercise_id: null,
      },
      {
        id: "msg-2",
        sender_id: t,
        recipient_id: s,
        body: "Muito bem, Beatriz! Mantém o foco na técnica. Vamos continuar a progredir, uma série de cada vez.",
        created_at: ago(1),
        plan_id: null,
        workout_id: null,
        exercise_id: null,
      },
    ],
    chains: [
      { id: "chain-1", name: "Fitness Hut", status: "approved", created_by: t },
      { id: "chain-2", name: "Solinca", status: "approved", created_by: t },
      {
        id: "chain-3",
        name: "Clube Movimento",
        status: "pending",
        created_by: s,
      },
    ],
    gyms: [
      {
        id: "gym-1",
        name: "Fitness Hut · Parque das Nações",
        chain: "Fitness Hut",
        city: "Lisboa",
        equipment: [
          "Halteres",
          "Barra olímpica",
          "Banco ajustável",
          "Rack de agachamento",
          "Prensa de pernas",
          "Polia alta",
          "Cabos",
          "Passadeira",
        ],
        created_by: t,
      },
      {
        id: "gym-2",
        name: "Solinca · NorteShopping",
        chain: "Solinca",
        city: "Matosinhos",
        equipment: [
          "Halteres",
          "Banco ajustável",
          "Máquina extensora",
          "Máquina flexora",
          "Bicicleta",
          "Kettlebells",
        ],
        created_by: t,
      },
      {
        id: "gym-3",
        name: "Clube Movimento · Centro",
        chain: "Clube Movimento",
        city: "Porto",
        equipment: ["Halteres", "Barra olímpica", "Kettlebells"],
        created_by: s,
      },
    ],
  };
}
