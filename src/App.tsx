import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Archive,
  BarChart3,
  Bell,
  Building2,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Users,
  X,
  Play,
  CheckCircle2,
  LoaderCircle,
  Link2,
} from "lucide-react";
import {
  type Store,
  type Profile,
  type Role,
  type Plan,
  type Workout,
  type Exercise,
  type Session,
  type SetLog,
  type Message,
  type Gym,
  type Chain,
  emptyStore,
  uid,
  newWorkout,
  newExercise,
  equipment,
  catalogue,
  createSession,
  validatePlan,
  volume,
  csvReport,
  canComplete,
} from "./domain";
import { demoStore, demoIds } from "./seed";
import { supabase, loadRemote, saveRemote, myProfile } from "./data";

type Page =
  "dashboard" | "students" | "plans" | "progress" | "chat" | "gyms" | "admin";
const pageNames: Record<Page, string> = {
  dashboard: "Visão geral",
  students: "Alunos",
  plans: "Planos de treino",
  progress: "Evolução",
  chat: "Mensagens",
  gyms: "Ginásios",
  admin: "Administração",
};
const roleNames: Record<Role, string> = {
  trainer: "Personal trainer",
  student: "Aluno",
  admin: "Administrador",
};
const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
const number = (n: number) => n.toLocaleString("pt-PT");
const date = (d: string) =>
  new Date(d).toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
const errorText = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "Não foi possível guardar. Verifica a ligação e tenta novamente.";

function Avatar({ name, size = "normal" }: { name: string; size?: string }) {
  return <span className={"avatar " + size}>{initials(name)}</span>;
}
function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Dumbbell size={34} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const closeRef = useRef(onClose),
    dialogRef = useRef<HTMLElement>(null);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    const handler = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== dialogRef.current) return;
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          dialogRef.current!.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a",
          ),
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <span className="eyebrow">FORMA / O TEU ESPAÇO</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function App() {
  const [store, setStore] = useState<Store>(emptyStore),
    [profile, setProfile] = useState<Profile | null>(null),
    [demo, setDemo] = useState(false),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState<Page>("dashboard"),
    [studentId, setStudentId] = useState(""),
    [search, setSearch] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false);
  const [editor, setEditor] = useState<Plan | null>(null),
    [detail, setDetail] = useState<Plan | null>(null),
    [active, setActive] = useState<Session | null>(null),
    [comment, setComment] = useState<{
      plan: Plan;
      workout: Workout;
      exercise: Exercise;
    } | null>(null),
    [gymForm, setGymForm] = useState(false),
    [linkForm, setLinkForm] = useState(false),
    [authModal, setAuthModal] = useState(false);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const startDemo = useCallback(() => {
    let state: Store;
    try {
      state =
        JSON.parse(localStorage.getItem("forma-demo-v1") || "null") ||
        demoStore();
    } catch {
      state = demoStore();
    }
    setStore(state);
    setProfile(state.profiles.find((p) => p.id === demoIds.trainer)!);
    setStudentId(demoIds.student);
    setDemo(true);
    setLoading(false);
    setPage("dashboard");
  }, []);
  useEffect(() => {
    let alive = true;
    const init = async () => {
      try {
        const p = await myProfile();
        if (!alive) return;
        if (p) {
          setProfile(p);
          setStore(await loadRemote());
          setDemo(false);
        } else startDemo();
      } catch (e) {
        notify(errorText(e));
        startDemo();
      } finally {
        if (alive) setLoading(false);
      }
    };
    void init();
    return () => {
      alive = false;
    };
  }, [startDemo, notify]);
  useEffect(() => {
    if (demo && profile)
      try {
        localStorage.setItem("forma-demo-v1", JSON.stringify(store));
      } catch {
        notify(
          "O armazenamento do navegador está cheio. As alterações desta sessão não serão preservadas.",
        );
      }
  }, [store, demo, profile, notify]);
  useEffect(() => {
    if (demo || !profile) return;
    const timer = setInterval(() => {
      void loadRemote()
        .then(setStore)
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [demo, profile]);
  const save = async <T extends { id: string }>(
    table: Exclude<keyof Store, "profiles">,
    row: T,
    isNew = false,
  ) => {
    setBusy(true);
    try {
      if (!demo) await saveRemote(table, row, isNew);
      setStore((old) => ({
        ...old,
        [table]: isNew
          ? [...old[table], row]
          : old[table].map((r) => (r.id === row.id ? row : r)),
      }));
      return true;
    } catch (e) {
      notify(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const students = store.profiles.filter((p) => p.role === "student");
  const student =
    profile?.role === "student"
      ? profile
      : students.find((s) => s.id === studentId) || students[0];
  const studentPlans = store.plans.filter((p) => p.student_id === student?.id);
  const sessions = store.sessions
    .filter((s) => s.student_id === student?.id && s.completed_at)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const nav = (p: Page) => {
    setPage(p);
    setSearch("");
    setMobile(false);
  };
  const newPlan = () =>
    setEditor({
      id: uid(),
      trainer_id: profile!.id,
      student_id: student?.id || "",
      name: "",
      description: "",
      archived: false,
      workouts: [newWorkout()],
      created_at: new Date().toISOString(),
    });
  const begin = async (plan: Plan, workout: Workout) => {
    const existing = store.sessions.find(
      (s) => s.student_id === profile!.id && !s.completed_at,
    );
    if (existing) {
      setActive(existing);
      setDetail(null);
      return;
    }
    const s = createSession(plan, workout, profile!.id);
    if (await save("sessions", s, true)) {
      setActive(s);
      setDetail(null);
    }
  };
  const exportData = () => {
    if (!sessions.length) {
      notify("Ainda não existem treinos concluídos para exportar.");
      return;
    }
    const blob = new Blob([csvReport(sessions)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "forma-" + (student?.name || "aluno").replaceAll(" ", "-") + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Relatório exportado. Podes abri-lo no Excel.");
  };
  const authSuccess = async () => {
    setLoading(true);
    try {
      const p = await myProfile();
      if (!p) throw new Error("Confirma o teu email para entrar.");
      setProfile(p);
      setStore(await loadRemote());
      setDemo(false);
      setAuthModal(false);
      setPage("dashboard");
    } catch (e) {
      notify(errorText(e));
    } finally {
      setLoading(false);
    }
  };
  if (loading)
    return (
      <div className="loading">
        <span className="brand-icon">f</span>
        <LoaderCircle className="spin" />
        <p>A preparar o teu espaço…</p>
      </div>
    );
  if (!profile) return <Auth onSuccess={authSuccess} onDemo={startDemo} />;
  const trainer = profile.role === "trainer",
    admin = profile.role === "admin";
  const navItems = [
    { id: "dashboard" as Page, label: "Visão geral", icon: LayoutDashboard },
    ...(trainer
      ? [{ id: "students" as Page, label: "Alunos", icon: Users }]
      : []),
    { id: "plans" as Page, label: "Planos de treino", icon: Dumbbell },
    { id: "progress" as Page, label: "Evolução", icon: BarChart3 },
    { id: "chat" as Page, label: "Mensagens", icon: MessageCircle },
    { id: "gyms" as Page, label: "Ginásios", icon: Building2 },
    ...(admin
      ? [{ id: "admin" as Page, label: "Administração", icon: ShieldCheck }]
      : []),
  ];
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-scrim" onClick={() => setMobile(false)} />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            nav("dashboard");
          }}
        >
          <span className="brand-icon">f</span>forma
          <span className="brand-dot">.</span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-icon">
            <Dumbbell size={19} />
          </span>
          <div>
            <b>O meu espaço</b>
            <small>{roleNames[profile.role]}</small>
          </div>
          <ChevronDown size={16} />
        </div>
        <span className="nav-caption">ACOMPANHAMENTO</span>
        <nav aria-label="Navegação principal">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "selected" : ""}
              onClick={() => nav(item.id)}
            >
              <item.icon size={20} />
              {item.label}
              {item.id === "chat" &&
                store.messages.some((m) => m.recipient_id === profile.id) && (
                  <span className="nav-dot" />
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <Sparkles size={20} />
            </span>
            <b>
              Pequenos passos.
              <br />
              Grandes mudanças.
            </b>
            <p>O progresso começa com a consistência.</p>
          </div>
          {demo && (
            <label className="role-label">
              EXPLORAR DEMONSTRAÇÃO
              <select
                aria-label="Modo de demonstração"
                value={profile.role}
                onChange={(e) => {
                  const role = e.target.value as Role;
                  setProfile(
                    store.profiles.find((p) => p.id === demoIds[role])!,
                  );
                  setPage(role === "admin" ? "admin" : "dashboard");
                  setActive(null);
                }}
              >
                <option value="trainer">Personal trainer</option>
                <option value="student">Aluno</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
          )}
          <button
            className="profile-button"
            onClick={() =>
              demo
                ? setAuthModal(true)
                : void supabase?.auth.signOut().then(() => {
                    setProfile(null);
                    setStore(emptyStore());
                  })
            }
          >
            <Avatar name={profile.name} />
            <span>
              <b>{profile.name}</b>
              <small>
                {demo ? "Entrar na minha conta" : "Terminar sessão"}
              </small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <span>O meu espaço</span>
            <ChevronRight size={14} />
            <b>{pageNames[page]}</b>
          </div>
          <div className="topbar-actions">
            {demo ? (
              <button className="demo-badge" onClick={() => setAuthModal(true)}>
                <span />
                Demonstração <ArrowUpRight size={13} />
              </button>
            ) : (
              <Badge>
                <span className="live-dot" />
                Ligado
              </Badge>
            )}
            <button
              className="icon-button"
              aria-label="Ver mensagens"
              onClick={() => nav("chat")}
            >
              <Bell size={19} />
            </button>
            <Avatar name={profile.name} size="small" />
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {new Date().toLocaleDateString("pt-PT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </div>
              <h1>
                {page === "dashboard"
                  ? `Olá, ${profile.name.split(" ")[0]}`
                  : pageNames[page]}
                {page === "dashboard" && (
                  <span className="greeting-dot">✳</span>
                )}
              </h1>
              <p>
                {page === "dashboard"
                  ? trainer
                    ? "Mais perto dos teus alunos. Mais longe nos resultados."
                    : "Cada treino conta. Vamos dar o próximo passo?"
                  : (
                      {
                        students:
                          "Cada pessoa, um percurso. Acompanha os teus alunos.",
                        plans: "Uma direção clara para cada objetivo.",
                        progress: "Transforma a consistência em resultados.",
                        chat: "A conversa também faz parte do treino.",
                        gyms: "Encontra o espaço certo para o próximo treino.",
                        admin: "Uma comunidade de confiança começa aqui.",
                      } as Record<string, string>
                    )[page]}
              </p>
            </div>
            <div className="heading-actions">
              {(page === "dashboard" || page === "progress") && trainer && (
                <button className="button secondary" onClick={exportData}>
                  <ArrowDownToLine size={16} />
                  Exportar relatório
                </button>
              )}
              {trainer && (page === "dashboard" || page === "plans") && (
                <button className="button" onClick={newPlan}>
                  <Plus size={18} />
                  Criar plano
                </button>
              )}
              {page === "students" && (
                <button className="button" onClick={() => setLinkForm(true)}>
                  <Plus size={18} />
                  Adicionar aluno
                </button>
              )}
              {page === "gyms" && (
                <button className="button" onClick={() => setGymForm(true)}>
                  <Plus size={18} />
                  Adicionar ginásio
                </button>
              )}
            </div>
          </div>
          {demo && (
            <div className="demo-notice">
              <span>
                <Sparkles size={14} /> Estás a explorar dados de exemplo. As
                alterações são guardadas apenas neste navegador.
              </span>
              <button onClick={() => setAuthModal(true)}>
                Usar com a minha conta <ArrowRight size={14} />
              </button>
            </div>
          )}
          {!demo && profile.role === "student" && page === "dashboard" && (
            <div className="community-banner">
              <Link2 size={20} />
              <div>
                <b>Associa-te ao teu personal trainer</b>
                <p>
                  Partilha este código apenas com o treinador que escolheste:{" "}
                  <code>{profile.invite_code}</code>
                </p>
              </div>
              <button
                className="button secondary"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(profile.invite_code)
                    .then(() => notify("Código copiado."))
                    .catch(() =>
                      notify("Seleciona o código para o copiar manualmente."),
                    )
                }
              >
                Copiar código
              </button>
            </div>
          )}
          {trainer && ["dashboard", "plans", "progress"].includes(page) && (
            <div className="student-selector">
              <span className="muted">A acompanhar</span>
              <select
                aria-label="Selecionar aluno"
                value={student?.id || ""}
                onChange={(e) => setStudentId(e.target.value)}
              >
                {students.length ? (
                  students.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                ) : (
                  <option value="">Sem alunos associados</option>
                )}
              </select>
              {student && <Badge tone="neutral">Aluno</Badge>}
            </div>
          )}
          {page === "dashboard" && (
            <>
              <div className="dashboard-grid">
                <section className="welcome-card">
                  <div className="welcome-text">
                    <span className="pill-light">
                      <span />
                      UM PASSO DE CADA VEZ
                    </span>
                    <h2>
                      {trainer ? (
                        <>
                          O próximo capítulo
                          <br />
                          começa com um treino.
                        </>
                      ) : (
                        <>
                          Hoje é um bom dia
                          <br />
                          para te superares.
                        </>
                      )}
                    </h2>
                    <p>
                      {trainer
                        ? "Planeia com intenção. Acompanha de perto. Celebra cada conquista."
                        : "O teu plano está pronto. Traz a vontade, nós ajudamos com o resto."}
                    </p>
                    <button
                      className="button lime"
                      onClick={() => nav("plans")}
                    >
                      {trainer ? "Explorar planos" : "Ver o meu plano"}
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="orbit orbit-one" />
                    <div className="orbit orbit-two" />
                    <div className="orbit orbit-three" />
                    <div className="floating-label">
                      <Activity size={16} />
                      <span>Em movimento</span>
                    </div>
                    <div className="sculpture">
                      <div className="weight weight-left" />
                      <div className="bar" />
                      <div className="weight weight-right" />
                    </div>
                    <span className="art-star">✳</span>
                    <div className="art-caption">
                      O TEU MELHOR ESTÁ À FRENTE.
                    </div>
                  </div>
                </section>
                <section className="card weekly-card">
                  <div className="section-title">
                    <h3>Esta semana</h3>
                    <span className="icon-tile">
                      <Target size={18} />
                    </span>
                  </div>
                  <Weekly sessions={sessions} />
                  <div className="week-days">
                    {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
                      <span
                        key={i}
                        className={
                          i <
                          Math.min(
                            sessions.filter(
                              (s) =>
                                Date.now() -
                                  new Date(s.completed_at!).getTime() <
                                7 * 86400000,
                            ).length,
                            7,
                          )
                            ? "done"
                            : ""
                        }
                      >
                        {i <
                        Math.min(
                          sessions.filter(
                            (s) =>
                              Date.now() - new Date(s.completed_at!).getTime() <
                              7 * 86400000,
                          ).length,
                          7,
                        ) ? (
                          <Check size={14} />
                        ) : (
                          d
                        )}
                      </span>
                    ))}
                  </div>
                  <p className="muted small-text">
                    Um treino de cada vez. Uma versão melhor de ti.
                  </p>
                </section>
              </div>
              <div className="stats-grid">
                <Stat
                  icon={<Dumbbell />}
                  label="Treinos concluídos"
                  value={String(sessions.length)}
                  note="Histórico do aluno"
                />
                <Stat
                  icon={<TrendingUp />}
                  label="Volume total"
                  value={number(sessions.reduce((n, s) => n + volume(s), 0))}
                  unit="kg"
                  note="Carga × repetições registadas"
                />
                <Stat
                  icon={<Clock />}
                  label="Tempo de treino"
                  value={String(
                    Math.round(
                      sessions.reduce(
                        (n, s) =>
                          n +
                          (new Date(s.completed_at!).getTime() -
                            new Date(s.started_at).getTime()) /
                            60000,
                        0,
                      ),
                    ),
                  )}
                  unit="min"
                  note="Tempo acumulado"
                />
                <Stat
                  icon={<Target />}
                  label="Planos ativos"
                  value={String(studentPlans.filter((p) => !p.archived).length)}
                  note="Um caminho para o objetivo"
                />
              </div>
              <div className="dashboard-lower">
                <section className="card">
                  <div className="section-title">
                    <div>
                      <h3>Evolução do volume</h3>
                      <p>A consistência ganha forma.</p>
                    </div>
                    <Badge tone="neutral">Últimos 8 treinos</Badge>
                  </div>
                  <VolumeChart sessions={sessions} />
                </section>
                <section className="card">
                  <div className="section-title">
                    <div>
                      <h3>Últimas conversas</h3>
                      <p>O acompanhamento continua aqui.</p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Abrir mensagens"
                      onClick={() => nav("chat")}
                    >
                      <ArrowUpRight size={20} />
                    </button>
                  </div>
                  <div className="conversation-preview">
                    {store.messages
                      .filter(
                        (m) =>
                          !m.plan_id &&
                          (m.sender_id === profile.id ||
                            m.recipient_id === profile.id),
                      )
                      .slice(-2)
                      .reverse()
                      .map((m) => {
                        const p = store.profiles.find(
                          (p) =>
                            p.id ===
                            (m.sender_id === profile.id
                              ? m.recipient_id
                              : m.sender_id),
                        );
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              if (p?.role === "student") setStudentId(p.id);
                              nav("chat");
                            }}
                          >
                            <Avatar name={p?.name || "Utilizador"} />
                            <div>
                              <div className="row-between">
                                <b>{p?.name}</b>
                                <small>{date(m.created_at)}</small>
                              </div>
                              <p>{m.body}</p>
                            </div>
                          </button>
                        );
                      })}
                    {!store.messages.length && (
                      <p className="muted">
                        As tuas conversas vão aparecer aqui.
                      </p>
                    )}
                  </div>
                  <div className="conversation-footer">
                    <MessageCircle size={16} />
                    <span>Uma boa conversa faz a diferença.</span>
                  </div>
                </section>
              </div>
              <section className="card recent-card">
                <div className="section-title">
                  <div>
                    <h3>Atividade recente</h3>
                    <p>
                      {student?.name || "Os teus alunos"} · Cada sessão é mais
                      um passo.
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => nav("progress")}
                  >
                    Ver histórico <ArrowRight size={15} />
                  </button>
                </div>
                <SessionTable sessions={sessions.slice(-3).reverse()} />
              </section>
            </>
          )}
          {page === "students" && (
            <>
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="Procurar aluno…"
              />
              <div className="student-cards">
                {students
                  .filter((s) =>
                    s.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((s, i) => {
                    const count = store.sessions.filter(
                      (x) => x.student_id === s.id && x.completed_at,
                    ).length;
                    return (
                      <button
                        className="card student-card"
                        key={s.id}
                        onClick={() => {
                          setStudentId(s.id);
                          nav("dashboard");
                        }}
                      >
                        <div className={"student-cover cover-" + (i % 4)}>
                          <span className="cover-shape" />
                        </div>
                        <Avatar name={s.name} size="large" />
                        <h3>{s.name}</h3>
                        <p>Acompanhamento personalizado</p>
                        <div className="student-facts">
                          <span>
                            <b>
                              {
                                store.plans.filter(
                                  (p) => p.student_id === s.id && !p.archived,
                                ).length
                              }
                            </b>{" "}
                            planos ativos
                          </span>
                          <span>
                            <b>{count}</b> treinos
                          </span>
                        </div>
                        <div className="student-open">
                          Acompanhar evolução <ArrowUpRight size={18} />
                        </div>
                      </button>
                    );
                  })}
              </div>
              {!students.length && (
                <Empty
                  title="O teu primeiro aluno começa aqui"
                  description="Associa um aluno através do código de partilha da conta dele."
                  action={
                    <button
                      className="button"
                      onClick={() => setLinkForm(true)}
                    >
                      Adicionar aluno
                    </button>
                  }
                />
              )}
            </>
          )}
          {page === "plans" && (
            <Plans
              plans={studentPlans}
              trainer={trainer}
              onOpen={setDetail}
              onEdit={setEditor}
              onArchive={async (p) => {
                if (await save("plans", { ...p, archived: !p.archived }))
                  notify(
                    p.archived
                      ? "Plano reativado."
                      : "Plano arquivado. O histórico e os comentários foram preservados.",
                  );
              }}
              onCreate={newPlan}
            />
          )}
          {page === "progress" && (
            <>
              <div className="stats-grid">
                <Stat
                  icon={<CheckCircle2 />}
                  label="Treinos concluídos"
                  value={String(sessions.length)}
                  note="Todas as sessões"
                />
                <Stat
                  icon={<TrendingUp />}
                  label="Volume total"
                  value={number(sessions.reduce((n, s) => n + volume(s), 0))}
                  unit="kg"
                  note="Séries concluídas"
                />
                <Stat
                  icon={<Dumbbell />}
                  label="Séries realizadas"
                  value={String(
                    sessions.reduce(
                      (n, s) => n + s.sets.filter((x) => x.done).length,
                      0,
                    ),
                  )}
                  note="Passo a passo"
                />
                <Stat
                  icon={<Flame />}
                  label="Esta semana"
                  value={String(
                    sessions.filter(
                      (s) =>
                        Date.now() - new Date(s.completed_at!).getTime() <
                        7 * 86400000,
                    ).length,
                  )}
                  note="Treinos nos últimos 7 dias"
                />
              </div>
              <section className="card">
                <div className="section-title">
                  <h3>O teu percurso em números</h3>
                  <Badge tone="neutral">Volume por sessão</Badge>
                </div>
                <VolumeChart sessions={sessions} />
              </section>
              <section className="card recent-card">
                <div className="section-title">
                  <h3>Histórico de treinos</h3>
                  <button className="button secondary" onClick={exportData}>
                    <ArrowDownToLine size={16} />
                    Exportar CSV
                  </button>
                </div>
                <SessionTable sessions={[...sessions].reverse()} />
              </section>
            </>
          )}
          {page === "chat" && (
            <Chat
              store={store}
              profile={profile}
              selected={student?.id}
              busy={busy}
              onSend={async (m) => save("messages", m, true)}
            />
          )}
          {page === "gyms" && (
            <Gyms store={store} search={search} onSearch={setSearch} />
          )}
          {page === "admin" && admin && (
            <Admin
              store={store}
              busy={busy}
              onReview={async (c, status) => {
                if (await save("chains", { ...c, status }))
                  notify(
                    status === "approved"
                      ? "Cadeia validada."
                      : "Cadeia rejeitada.",
                  );
              }}
            />
          )}
          <footer className="page-footer">
            <span>
              forma<span className="brand-dot">.</span>
            </span>
            <span>Treinar melhor, juntos.</span>
            <span>
              Feito para o teu próximo passo <ArrowUpRight size={13} />
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button aria-label="Fechar aviso" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {editor && (
        <PlanEditor
          plan={editor}
          students={students}
          busy={busy}
          onClose={() => setEditor(null)}
          onSave={async (p) => {
            if (
              await save("plans", p, !store.plans.some((x) => x.id === p.id))
            ) {
              setEditor(null);
              notify("Plano guardado e disponível para o aluno.");
            }
          }}
        />
      )}
      {detail && (
        <Modal title={detail.name} wide onClose={() => setDetail(null)}>
          <p className="muted">{detail.description}</p>
          {detail.archived && (
            <div className="inline-notice">
              Plano arquivado. O histórico e as conversas continuam disponíveis.
            </div>
          )}
          {detail.workouts.map((w, i) => (
            <section key={w.id} className="workout-detail">
              <div className="section-title">
                <div className="workout-title">
                  <span className="workout-letter">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <div>
                    <h3>{w.name}</h3>
                    <p>
                      {w.focus} · {w.exercises.length} exercícios
                    </p>
                  </div>
                </div>
                {profile.role === "student" && !detail.archived && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => void begin(detail, w)}
                  >
                    <Play size={15} />
                    Iniciar treino
                  </button>
                )}
              </div>
              {w.exercises.map((e) => (
                <div className="exercise-row" key={e.id}>
                  <span className="exercise-icon">
                    <Dumbbell size={20} />
                  </span>
                  <div>
                    <b>{e.name}</b>
                    <small>
                      {e.equipment} · {e.rest}s de descanso
                    </small>
                  </div>
                  <span className="exercise-prescription">
                    {e.sets} × {e.min}–{e.max}
                    <small> séries × repetições</small>
                  </span>
                  <button
                    className="icon-button"
                    aria-label={"Comentários: " + e.name}
                    onClick={() =>
                      setComment({ plan: detail, workout: w, exercise: e })
                    }
                  >
                    <MessageCircle size={18} />
                    {store.messages.filter(
                      (m) =>
                        m.plan_id === detail.id &&
                        m.workout_id === w.id &&
                        m.exercise_id === e.id,
                    ).length || ""}
                  </button>
                </div>
              ))}
            </section>
          ))}
        </Modal>
      )}
      {active && (
        <WorkoutRunner
          session={active}
          busy={busy}
          onClose={() => setActive(null)}
          onSave={async (s) => {
            if (await save("sessions", s)) {
              setActive(s);
              return true;
            }
            return false;
          }}
          onComplete={async (s) => {
            if (await save("sessions", s)) {
              setActive(null);
              notify("Treino concluído. Mais um passo na direção certa!");
              nav("progress");
            }
          }}
          onComment={(id) => {
            const p = store.plans.find((p) => p.id === active.plan_id),
              w = p?.workouts.find((w) => w.id === active.workout_id),
              e = w?.exercises.find((e) => e.id === id);
            if (p && w && e) setComment({ plan: p, workout: w, exercise: e });
          }}
        />
      )}
      {!active &&
        profile.role === "student" &&
        store.sessions.find(
          (s) => s.student_id === profile.id && !s.completed_at,
        ) && (
          <button
            className="resume-workout button"
            onClick={() =>
              setActive(
                store.sessions.find(
                  (s) => s.student_id === profile.id && !s.completed_at,
                )!,
              )
            }
          >
            <Play size={17} />
            Retomar treino em curso
          </button>
        )}
      {comment && (
        <Modal title={comment.exercise.name} onClose={() => setComment(null)}>
          <p className="muted small-text">
            {comment.plan.name} / {comment.workout.name}
          </p>
          <ChatThread
            messages={store.messages.filter(
              (m) =>
                m.plan_id === comment.plan.id &&
                m.workout_id === comment.workout.id &&
                m.exercise_id === comment.exercise.id,
            )}
            profile={profile}
            profiles={store.profiles}
            busy={busy}
            onSend={async (body) =>
              save(
                "messages",
                {
                  id: uid(),
                  sender_id: profile.id,
                  recipient_id:
                    profile.id === comment.plan.trainer_id
                      ? comment.plan.student_id
                      : comment.plan.trainer_id,
                  body,
                  created_at: new Date().toISOString(),
                  plan_id: comment.plan.id,
                  workout_id: comment.workout.id,
                  exercise_id: comment.exercise.id,
                },
                true,
              )
            }
          />
        </Modal>
      )}
      {gymForm && (
        <GymForm
          busy={busy}
          chains={store.chains}
          onClose={() => setGymForm(false)}
          onSave={async (data) => {
            let chain = store.chains.find(
              (c) => c.name.toLowerCase() === data.chain.toLowerCase(),
            );
            if (!chain) {
              chain = {
                id: uid(),
                name: data.chain,
                status: "pending",
                created_by: profile.id,
              };
              if (!(await save("chains", chain, true))) return;
            }
            if (
              await save(
                "gyms",
                {
                  ...data,
                  chain: chain.name,
                  id: uid(),
                  created_by: profile.id,
                },
                true,
              )
            ) {
              setGymForm(false);
              notify(
                "Ginásio adicionado. As novas cadeias ficam pendentes de validação.",
              );
            }
          }}
        />
      )}
      {linkForm && (
        <LinkStudent
          demo={demo}
          onClose={() => setLinkForm(false)}
          onSuccess={async () => {
            setStore(await loadRemote());
            setLinkForm(false);
            notify("Aluno associado ao teu acompanhamento.");
          }}
        />
      )}
      {authModal && (
        <Modal
          title="O teu próximo passo começa aqui"
          onClose={() => setAuthModal(false)}
        >
          <Auth
            onSuccess={authSuccess}
            onDemo={() => setAuthModal(false)}
            compact
          />
        </Modal>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  unit,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  note: string;
}) {
  return (
    <section className="card stat">
      <div className="row-between">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
      <p>
        <span className="tiny-dot" />
        {note}
      </p>
    </section>
  );
}
function Weekly({ sessions }: { sessions: Session[] }) {
  const count = sessions.filter(
    (s) => Date.now() - new Date(s.completed_at!).getTime() < 7 * 86400000,
  ).length;
  return (
    <div className="weekly-total">
      <strong>{count}</strong>
      <div>
        <b>treinos concluídos</b>
        <span>nos últimos 7 dias</span>
      </div>
      <div className="week-ring">
        <Flame size={25} />
      </div>
    </div>
  );
}
function VolumeChart({ sessions }: { sessions: Session[] }) {
  const data = sessions.slice(-8),
    max = Math.max(...data.map(volume), 1);
  return data.length ? (
    <div className="chart">
      <div className="chart-y">
        <span>{number(max)}</span>
        <span>{number(Math.round(max / 2))}</span>
        <span>0 kg</span>
      </div>
      <div className="chart-bars">
        {data.map((s, i) => (
          <div className="chart-column" key={s.id}>
            <div
              className={"chart-bar " + (i === data.length - 1 ? "latest" : "")}
              style={{ height: Math.max(2, (volume(s) / max) * 100) + "%" }}
              title={date(s.started_at) + ": " + number(volume(s)) + " kg"}
            >
              <span>{number(volume(s))} kg</span>
            </div>
            <small>{date(s.started_at)}</small>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <Empty
      title="O progresso começa no primeiro treino"
      description="Conclui uma sessão para acompanhar a tua evolução."
    />
  );
}
function SessionTable({ sessions }: { sessions: Session[] }) {
  return sessions.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Treino</th>
            <th>Data</th>
            <th>Séries</th>
            <th>Volume</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>
                <span className="table-workout">
                  <span className="exercise-icon">
                    <Dumbbell size={17} />
                  </span>
                  {s.workout_name}
                </span>
              </td>
              <td>{date(s.completed_at!)}</td>
              <td>{s.sets.filter((s) => s.done).length}</td>
              <td>{number(volume(s))} kg</td>
              <td>
                <Badge>
                  <Check size={12} />
                  Concluído
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title="Ainda não há treinos concluídos"
      description="Os registos de séries, repetições e cargas vão aparecer aqui."
    />
  );
}
function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search-field">
      <Search size={18} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          className="icon-button"
          aria-label="Limpar pesquisa"
          onClick={() => onChange("")}
        >
          <X size={15} />
        </button>
      )}
    </label>
  );
}

function Plans({
  plans,
  trainer,
  onOpen,
  onEdit,
  onArchive,
  onCreate,
}: {
  plans: Plan[];
  trainer: boolean;
  onOpen: (p: Plan) => void;
  onEdit: (p: Plan) => void;
  onArchive: (p: Plan) => void;
  onCreate: () => void;
}) {
  const [archived, setArchived] = useState(false);
  const visible = plans.filter((p) => p.archived === archived);
  return (
    <>
      <div className="tabs">
        <button
          className={!archived ? "active" : ""}
          onClick={() => setArchived(false)}
        >
          Planos ativos <span>{plans.filter((p) => !p.archived).length}</span>
        </button>
        <button
          className={archived ? "active" : ""}
          onClick={() => setArchived(true)}
        >
          Arquivados <span>{plans.filter((p) => p.archived).length}</span>
        </button>
      </div>
      <div className="plan-grid">
        {visible.map((p) => (
          <section className="card plan-card" key={p.id}>
            <div className="plan-top">
              <span className="plan-icon">
                <Dumbbell size={26} />
              </span>
              <Badge tone={p.archived ? "neutral" : "green"}>
                {p.archived ? "Arquivado" : "Em progresso"}
              </Badge>
            </div>
            <span className="eyebrow">O TEU PLANO, O TEU RITMO</span>
            <h2>{p.name}</h2>
            <p>{p.description || "Um plano feito para o próximo passo."}</p>
            <div className="plan-meta">
              <span>
                <Dumbbell size={15} />
                {p.workouts.length} treinos
              </span>
              <span>
                <Activity size={15} />
                {p.workouts.reduce((n, w) => n + w.exercises.length, 0)}{" "}
                exercícios
              </span>
            </div>
            <div className="plan-workouts">
              {p.workouts.map((w, i) => (
                <button key={w.id} onClick={() => onOpen(p)}>
                  <span className="workout-letter">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <div>
                    <b>{w.name}</b>
                    <small>
                      {w.exercises.length} exercícios · {w.focus}
                    </small>
                  </div>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
            <button className="button full" onClick={() => onOpen(p)}>
              Ver plano completo <ArrowRight size={17} />
            </button>
            {trainer && (
              <div className="plan-controls">
                <button className="text-button" onClick={() => onEdit(p)}>
                  <Settings2 size={15} />
                  Editar plano
                </button>
                <button className="text-button" onClick={() => onArchive(p)}>
                  <Archive size={15} />
                  {p.archived ? "Reativar" : "Arquivar"}
                </button>
              </div>
            )}
          </section>
        ))}
      </div>
      {!visible.length && (
        <Empty
          title={
            archived
              ? "Sem planos arquivados"
              : "Vamos dar forma ao próximo objetivo?"
          }
          description={
            archived
              ? "Os planos arquivados preservam o histórico e as conversas."
              : trainer
                ? "Cria um plano personalizado e associa-o a um aluno."
                : "O teu personal trainer ainda não te atribuiu um plano."
          }
          action={
            trainer && !archived ? (
              <button className="button" onClick={onCreate}>
                <Plus size={16} />
                Criar plano
              </button>
            ) : undefined
          }
        />
      )}
    </>
  );
}

function PlanEditor({
  plan,
  students,
  busy,
  onClose,
  onSave,
}: {
  plan: Plan;
  students: Profile[];
  busy: boolean;
  onClose: () => void;
  onSave: (p: Plan) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Plan>(() => structuredClone(plan)),
    [error, setError] = useState("");
  const updateWorkout = (id: string, patch: Partial<Workout>) =>
    setDraft((p) => ({
      ...p,
      workouts: p.workouts.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
  const updateExercise = (wid: string, id: string, patch: Partial<Exercise>) =>
    setDraft((p) => ({
      ...p,
      workouts: p.workouts.map((w) =>
        w.id === wid
          ? {
              ...w,
              exercises: w.exercises.map((e) =>
                e.id === id ? { ...e, ...patch } : e,
              ),
            }
          : w,
      ),
    }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = validatePlan(draft);
    if (err) {
      setError(err);
      return;
    }
    void onSave(draft);
  };
  return (
    <Modal
      title={plan.name ? "Editar plano" : "Criar um plano de treino"}
      wide
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>
            Nome do plano
            <input
              required
              maxLength={120}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ex.: Força e consistência"
            />
          </label>
          <label>
            Aluno
            <select
              required
              value={draft.student_id}
              disabled={Boolean(plan.name)}
              onChange={(e) =>
                setDraft({ ...draft, student_id: e.target.value })
              }
            >
              <option value="">Selecionar aluno</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Objetivo e orientações
          <textarea
            maxLength={1000}
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            placeholder="O que vamos trabalhar neste plano?"
          />
        </label>
        {draft.workouts.map((w, i) => (
          <div className="editor-workout" key={w.id}>
            <div className="section-title">
              <span className="eyebrow">
                TREINO {String.fromCharCode(65 + i)}
              </span>
              <button
                type="button"
                className="icon-button danger"
                aria-label={"Remover " + w.name}
                onClick={() =>
                  setDraft({
                    ...draft,
                    workouts: draft.workouts.filter((x) => x.id !== w.id),
                  })
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
            <div className="form-grid">
              <label>
                Nome do treino
                <input
                  required
                  maxLength={120}
                  value={w.name}
                  onChange={(e) =>
                    updateWorkout(w.id, { name: e.target.value })
                  }
                />
              </label>
              <label>
                Foco
                <input
                  maxLength={120}
                  value={w.focus}
                  onChange={(e) =>
                    updateWorkout(w.id, { focus: e.target.value })
                  }
                  placeholder="Pernas, peito, costas…"
                />
              </label>
            </div>
            {w.exercises.map((ex, j) => (
              <div className="editor-exercise" key={ex.id}>
                <div className="editor-exercise-title">
                  <b>{String(j + 1).padStart(2, "0")}</b>
                  <label>
                    Exercício
                    <input
                      required
                      list="exercise-catalogue"
                      value={ex.name}
                      maxLength={120}
                      onChange={(e) =>
                        updateExercise(w.id, ex.id, {
                          name: e.target.value,
                          equipment:
                            catalogue.find((c) => c.name === e.target.value)
                              ?.equipment || ex.equipment,
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={"Remover " + ex.name}
                    onClick={() =>
                      updateWorkout(w.id, {
                        exercises: w.exercises.filter((e) => e.id !== ex.id),
                      })
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="exercise-fields">
                  <label>
                    Séries
                    <input
                      type="number"
                      min="1"
                      max="20"
                      required
                      value={ex.sets}
                      onChange={(e) =>
                        updateExercise(w.id, ex.id, {
                          sets: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Reps. mín.
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={ex.min}
                      onChange={(e) =>
                        updateExercise(w.id, ex.id, {
                          min: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Reps. máx.
                    <input
                      type="number"
                      min={ex.min}
                      max="100"
                      required
                      value={ex.max}
                      onChange={(e) =>
                        updateExercise(w.id, ex.id, {
                          max: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Descanso (s)
                    <input
                      type="number"
                      min="0"
                      max="600"
                      required
                      value={ex.rest}
                      onChange={(e) =>
                        updateExercise(w.id, ex.id, {
                          rest: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              onClick={() =>
                updateWorkout(w.id, {
                  exercises: [...w.exercises, newExercise()],
                })
              }
            >
              <Plus size={16} />
              Adicionar exercício
            </button>
          </div>
        ))}
        <datalist id="exercise-catalogue">
          {catalogue.map((e) => (
            <option key={e.name} value={e.name} />
          ))}
        </datalist>
        <button
          type="button"
          className="button secondary"
          onClick={() =>
            setDraft({
              ...draft,
              workouts: [
                ...draft.workouts,
                {
                  ...newWorkout(),
                  name:
                    "Treino " + String.fromCharCode(65 + draft.workouts.length),
                },
              ],
            })
          }
        >
          <Plus size={17} />
          Adicionar treino
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button" disabled={busy || !students.length}>
            {busy ? "A guardar…" : "Guardar plano"}
            <Check size={17} />
          </button>
        </div>
        {!students.length && (
          <p className="inline-notice">
            Associa primeiro um aluno na página Alunos.
          </p>
        )}
      </form>
    </Modal>
  );
}

function WorkoutRunner({
  session,
  busy,
  onClose,
  onSave,
  onComplete,
  onComment,
}: {
  session: Session;
  busy: boolean;
  onClose: () => void;
  onSave: (s: Session) => Promise<boolean>;
  onComplete: (s: Session) => Promise<void>;
  onComment: (id: string) => void;
}) {
  const [draft, setDraft] = useState(session),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = Math.floor(
      (now - new Date(session.started_at).getTime()) / 1000,
    ),
    done = draft.sets.filter((s) => s.done).length;
  const edit = (index: number, patch: Partial<SetLog>) =>
    setDraft((s) => ({
      ...s,
      sets: s.sets.map((x, i) => (i === index ? { ...x, ...patch } : x)),
    }));
  const toggle = async (index: number) => {
    const row = draft.sets[index];
    if (
      !Number.isInteger(row.reps) ||
      row.reps < 1 ||
      row.reps > 100 ||
      !Number.isFinite(row.weight) ||
      row.weight < 0 ||
      row.weight > 1000
    ) {
      setError(
        "Indica repetições entre 1 e 100 e uma carga válida entre 0 e 1000 kg.",
      );
      return;
    }
    setError("");
    const updated = {
      ...draft,
      sets: draft.sets.map((x, i) =>
        i === index ? { ...x, done: !x.done } : x,
      ),
    };
    if (await onSave(updated)) setDraft(updated);
  };
  return (
    <Modal
      title={session.workout_name}
      wide
      onClose={() => {
        void onSave(draft).then((ok) => {
          if (ok) onClose();
        });
      }}
    >
      <div className="workout-status">
        <span>
          <Clock size={17} />
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
        </span>
        <b>
          {done} de {draft.sets.length} séries
        </b>
        <Badge>Em curso</Badge>
      </div>
      <div className="progress-track">
        <span style={{ width: (done / draft.sets.length) * 100 + "%" }} />
      </div>
      {[...new Set(draft.sets.map((s) => s.exercise_id))].map((id, i) => (
        <section className="workout-detail" key={id}>
          <div className="section-title">
            <div className="workout-title">
              <span className="workout-letter">{i + 1}</span>
              <h3>{draft.sets.find((s) => s.exercise_id === id)!.name}</h3>
            </div>
            <button
              className="icon-button"
              aria-label="Comentários do exercício"
              onClick={() => onComment(id)}
            >
              <MessageCircle size={18} />
            </button>
          </div>
          <div className="set-grid set-header">
            <span>SÉRIE</span>
            <span>CARGA (KG)</span>
            <span>REPETIÇÕES</span>
            <span>FEITO</span>
          </div>
          {draft.sets.map(
            (s, index) =>
              s.exercise_id === id && (
                <div
                  className={"set-grid " + (s.done ? "set-done" : "")}
                  key={index}
                >
                  <b>{s.set}</b>
                  <input
                    aria-label={s.name + " série " + s.set + " carga"}
                    disabled={busy || s.done}
                    type="number"
                    min="0"
                    max="1000"
                    step="0.5"
                    value={s.weight}
                    onChange={(e) =>
                      edit(index, { weight: Number(e.target.value) })
                    }
                  />
                  <input
                    aria-label={s.name + " série " + s.set + " repetições"}
                    disabled={busy || s.done}
                    type="number"
                    min="1"
                    max="100"
                    value={s.reps}
                    onChange={(e) =>
                      edit(index, { reps: Number(e.target.value) })
                    }
                  />
                  <button
                    className={"set-check " + (s.done ? "checked" : "")}
                    aria-label={
                      (s.done ? "Desmarcar" : "Concluir") +
                      " série " +
                      s.set +
                      " de " +
                      s.name
                    }
                    aria-pressed={s.done}
                    disabled={busy}
                    onClick={() => void toggle(index)}
                  >
                    <Check size={20} />
                  </button>
                </div>
              ),
          )}
        </section>
      ))}
      {error && <p className="error">{error}</p>}
      <div className="modal-actions">
        <span className="muted small-text">
          {canComplete(draft)
            ? "Excelente trabalho. Está tudo registado!"
            : "Assinala todas as séries para concluir."}
        </span>
        <button
          className="button"
          disabled={busy || !canComplete(draft)}
          onClick={() =>
            void onComplete({
              ...draft,
              completed_at: new Date().toISOString(),
            })
          }
        >
          <CheckCheck size={18} />
          Concluir treino
        </button>
      </div>
    </Modal>
  );
}

function ChatThread({
  messages,
  profile,
  profiles,
  busy,
  onSend,
}: {
  messages: Message[];
  profile: Profile;
  profiles: Profile[];
  busy: boolean;
  onSend: (body: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (text.trim() && (await onSend(text.trim()))) setText("");
  };
  return (
    <div className="chat-thread">
      <div className="message-list">
        {messages.length ? (
          messages
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((m) => (
              <div
                key={m.id}
                className={
                  "message " + (m.sender_id === profile.id ? "mine" : "")
                }
              >
                <small>
                  {profiles.find((p) => p.id === m.sender_id)?.name ||
                    "Utilizador"}
                </small>
                <div>{m.body}</div>
                <time>
                  {date(m.created_at)} ·{" "}
                  {new Date(m.created_at).toLocaleTimeString("pt-PT", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {m.sender_id === profile.id && <Check size={12} />}
                </time>
              </div>
            ))
        ) : (
          <div className="chat-empty">
            <MessageCircle size={36} />
            <h3>A conversa começa aqui.</h3>
            <p>Partilha uma dúvida, uma conquista ou o próximo objetivo.</p>
          </div>
        )}
      </div>
      <form className="message-compose" onSubmit={(e) => void submit(e)}>
        <input
          aria-label="Mensagem"
          placeholder="Escreve uma mensagem…"
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="button"
          disabled={busy || !text.trim()}
          aria-label="Enviar mensagem"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
function Chat({
  store,
  profile,
  selected,
  busy,
  onSend,
}: {
  store: Store;
  profile: Profile;
  selected?: string;
  busy: boolean;
  onSend: (m: Message) => Promise<boolean>;
}) {
  const contacts = store.profiles.filter((p) =>
    profile.role === "trainer" ? p.role === "student" : p.role === "trainer",
  );
  const [contactId, setContactId] = useState(selected || contacts[0]?.id);
  const contact = contacts.find((p) => p.id === contactId) || contacts[0];
  return (
    <section className="card chat-layout">
      <aside className="chat-contacts">
        <h3>
          Conversas <span>{contacts.length}</span>
        </h3>
        {contacts.map((c) => (
          <button
            key={c.id}
            className={c.id === contact?.id ? "active" : ""}
            onClick={() => setContactId(c.id)}
          >
            <Avatar name={c.name} />
            <span>
              <b>{c.name}</b>
              <small>{roleNames[c.role]}</small>
            </span>
            <ChevronRight size={15} />
          </button>
        ))}
      </aside>
      <div className="chat-main">
        {contact ? (
          <>
            <div className="chat-person">
              <Avatar name={contact.name} />
              <div>
                <b>{contact.name}</b>
                <small>{roleNames[contact.role]} · Acompanhamento</small>
              </div>
              <Badge tone="neutral">Conversa privada</Badge>
            </div>
            <ChatThread
              messages={store.messages.filter(
                (m) =>
                  !m.plan_id &&
                  ((m.sender_id === profile.id &&
                    m.recipient_id === contact.id) ||
                    (m.recipient_id === profile.id &&
                      m.sender_id === contact.id)),
              )}
              profile={profile}
              profiles={store.profiles}
              busy={busy}
              onSend={(body) =>
                onSend({
                  id: uid(),
                  sender_id: profile.id,
                  recipient_id: contact.id,
                  body,
                  created_at: new Date().toISOString(),
                  plan_id: null,
                  workout_id: null,
                  exercise_id: null,
                })
              }
            />
          </>
        ) : (
          <Empty
            title="Ainda não tens contactos"
            description="As conversas ficam disponíveis quando um aluno e um treinador estão associados."
          />
        )}
      </div>
    </section>
  );
}

function Gyms({
  store,
  search,
  onSearch,
}: {
  store: Store;
  search: string;
  onSearch: (s: string) => void;
}) {
  const [filter, setFilter] = useState(""),
    [selected, setSelected] = useState<Gym | null>(null);
  const gyms = store.gyms.filter(
    (g) =>
      (g.name + " " + g.city + " " + g.chain)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!filter || g.equipment.includes(filter)),
  );
  return (
    <>
      <div className="filter-row">
        <SearchField
          value={search}
          onChange={onSearch}
          placeholder="Procurar por ginásio, cidade ou cadeia…"
        />
        <select
          aria-label="Filtrar por equipamento"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Todos os equipamentos</option>
          {equipment.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
      </div>
      <div className="community-banner">
        <span className="icon-tile">
          <Users size={22} />
        </span>
        <div>
          <b>Construído pela comunidade. Melhor para todos.</b>
          <p>
            Adiciona o teu ginásio e os equipamentos disponíveis. As cadeias são
            validadas pela administração.
          </p>
        </div>
        <Badge tone="neutral">{store.gyms.length} ginásios</Badge>
      </div>
      <div className="gym-grid">
        {gyms.map((g, i) => {
          const chain = store.chains.find((c) => c.name === g.chain);
          return (
            <button
              className="card gym-card"
              key={g.id}
              onClick={() => setSelected(g)}
            >
              <div className={"gym-visual gym-visual-" + (i % 3)}>
                <Dumbbell size={80} strokeWidth={1} />
                <span>
                  {String(i + 1).padStart(2, "0")} / ESPAÇOS PARA EVOLUIR
                </span>
              </div>
              <div className="gym-info">
                <Badge tone={chain?.status === "approved" ? "green" : "amber"}>
                  {chain?.status === "approved" ? (
                    <>
                      <ShieldCheck size={12} />
                      Cadeia validada
                    </>
                  ) : chain?.status === "rejected" ? (
                    "Cadeia não validada"
                  ) : (
                    "Validação pendente"
                  )}
                </Badge>
                <h3>{g.name}</h3>
                <p>
                  <MapPin size={15} />
                  {g.city}
                </p>
                <div className="equipment-tags">
                  {g.equipment.slice(0, 3).map((e) => (
                    <span key={e}>{e}</span>
                  ))}
                  {g.equipment.length > 3 && (
                    <span>+{g.equipment.length - 3}</span>
                  )}
                </div>
                <div className="gym-footer">
                  {g.equipment.length} equipamentos <ArrowUpRight size={17} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {!gyms.length && (
        <Empty
          title="Nenhum ginásio encontrado"
          description="Experimenta outra pesquisa ou adiciona um novo espaço."
        />
      )}
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <p className="location">
            <MapPin size={16} />
            {selected.city} · {selected.chain}
          </p>
          <h3>Equipamentos disponíveis</h3>
          <div className="equipment-list">
            {selected.equipment.map((e) => (
              <div key={e}>
                <CheckCircle2 size={17} />
                {e}
              </div>
            ))}
          </div>
          <p className="muted small-text">
            Informação adicionada pela comunidade. A validação da cadeia não
            confirma o inventário de cada espaço.
          </p>
        </Modal>
      )}
    </>
  );
}
function GymForm({
  busy,
  chains,
  onClose,
  onSave,
}: {
  busy: boolean;
  chains: Chain[];
  onClose: () => void;
  onSave: (g: Omit<Gym, "id" | "created_by">) => Promise<void>;
}) {
  const [data, setData] = useState({
    name: "",
    chain: "",
    city: "",
    equipment: [] as string[],
  });
  return (
    <Modal title="Adicionar um ginásio" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({
            ...data,
            name: data.name.trim(),
            chain: data.chain.trim(),
            city: data.city.trim(),
          });
        }}
      >
        <label>
          Nome do ginásio
          <input
            required
            maxLength={120}
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="Ex.: Fitness Hut · Saldanha"
          />
        </label>
        <div className="form-grid">
          <label>
            Cadeia ou ginásio independente
            <input
              aria-label="Cadeia ou ginásio independente"
              required
              list="chains"
              maxLength={100}
              value={data.chain}
              onChange={(e) => setData({ ...data, chain: e.target.value })}
            />
            <datalist id="chains">
              {chains.map((c) => (
                <option key={c.id}>{c.name}</option>
              ))}
            </datalist>
          </label>
          <label>
            Cidade
            <input
              required
              maxLength={100}
              value={data.city}
              onChange={(e) => setData({ ...data, city: e.target.value })}
            />
          </label>
        </div>
        <label>Equipamentos disponíveis</label>
        <div className="equipment-checks">
          {equipment.map((eq) => (
            <label key={eq}>
              <input
                type="checkbox"
                checked={data.equipment.includes(eq)}
                onChange={(e) =>
                  setData({
                    ...data,
                    equipment: e.target.checked
                      ? [...data.equipment, eq]
                      : data.equipment.filter((x) => x !== eq),
                  })
                }
              />
              {eq}
            </label>
          ))}
        </div>
        <p className="inline-notice">
          Se a cadeia ainda não existir, será enviada para validação pelo
          administrador.
        </p>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button"
            disabled={
              busy ||
              !data.equipment.length ||
              !data.name.trim() ||
              !data.chain.trim() ||
              !data.city.trim()
            }
          >
            {busy ? "A guardar…" : "Adicionar ginásio"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Admin({
  store,
  busy,
  onReview,
}: {
  store: Store;
  busy: boolean;
  onReview: (c: Chain, s: Chain["status"]) => void;
}) {
  return (
    <>
      <div className="stats-grid">
        <Stat
          icon={<Building2 />}
          label="Ginásios"
          value={String(store.gyms.length)}
          note="Adicionados pela comunidade"
        />
        <Stat
          icon={<ShieldCheck />}
          label="Cadeias validadas"
          value={String(
            store.chains.filter((c) => c.status === "approved").length,
          )}
          note="Identidade verificada"
        />
        <Stat
          icon={<Clock />}
          label="Por validar"
          value={String(
            store.chains.filter((c) => c.status === "pending").length,
          )}
          note="A aguardar revisão"
        />
        <Stat
          icon={<Users />}
          label="Utilizadores"
          value={String(store.profiles.length)}
          note="Membros da comunidade"
        />
      </div>
      <section className="card">
        <div className="section-title">
          <div>
            <h3>Validação de cadeias</h3>
            <p>Confirma a identidade de cada cadeia antes de a validar.</p>
          </div>
          <ShieldCheck size={24} />
        </div>
        {store.chains.map((c) => (
          <div className="admin-row" key={c.id}>
            <span className="icon-tile">
              <Building2 size={22} />
            </span>
            <div>
              <b>{c.name}</b>
              <small>
                {store.gyms.filter((g) => g.chain === c.name).length} ginásios
                adicionados
              </small>
            </div>
            <Badge
              tone={
                c.status === "approved"
                  ? "green"
                  : c.status === "pending"
                    ? "amber"
                    : "neutral"
              }
            >
              {c.status === "approved"
                ? "Validada"
                : c.status === "pending"
                  ? "Pendente"
                  : "Rejeitada"}
            </Badge>
            <div className="admin-actions">
              {c.status !== "approved" && (
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => onReview(c, "approved")}
                >
                  <Check size={15} />
                  Validar
                </button>
              )}
              {c.status !== "rejected" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => onReview(c, "rejected")}
                >
                  Rejeitar
                </button>
              )}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

function Auth({
  onSuccess,
  onDemo,
  compact = false,
}: {
  onSuccess: () => Promise<void>;
  onDemo: () => void;
  compact?: boolean;
}) {
  const [signup, setSignup] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [role, setRole] = useState<Role>("student"),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [info, setInfo] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setPending(true);
    setError("");
    setInfo("");
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, role },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo("Conta criada. Confirma o teu email e entra para começar.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      await onSuccess();
    } catch {
      setError(
        signup
          ? "Não foi possível criar a conta. Verifica os dados e tenta novamente."
          : "Não foi possível entrar. Verifica o email, a palavra-passe e a confirmação do email.",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <div className={compact ? "auth-content" : "auth-page"}>
      {!compact && (
        <div className="auth-brand">
          <span className="brand-icon">f</span>
          <h1>
            Treinar melhor,
            <br />
            juntos.
          </h1>
          <p>O teu plano. O teu progresso. A tua equipa.</p>
        </div>
      )}
      <div className="auth-form">
        <h2>{signup ? "Cria o teu espaço" : "Bem-vindo à Forma"}</h2>
        <p className="muted">
          {signup
            ? "Um novo capítulo começa com o primeiro passo."
            : "Entra para continuar o teu percurso."}
        </p>
        {!supabase && (
          <div className="inline-notice">
            As contas reais ficam disponíveis quando a ligação ao Supabase
            estiver configurada. Podes explorar todas as funcionalidades na
            demonstração.
          </div>
        )}
        <form onSubmit={(e) => void submit(e)}>
          {signup && (
            <>
              <label>
                O teu nome
                <input
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Sou
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  <option value="student">Aluno</option>
                  <option value="trainer">Personal trainer</option>
                </select>
              </label>
            </>
          )}
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Palavra-passe
            <input
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="inline-notice" role="status">
              {info}
            </p>
          )}
          <button className="button full" disabled={!supabase || pending}>
            {pending ? "A entrar…" : signup ? "Criar conta" : "Entrar"}
            <ArrowRight size={16} />
          </button>
        </form>
        <button
          className="text-button auth-toggle"
          onClick={() => {
            setSignup(!signup);
            setError("");
          }}
        >
          {signup
            ? "Já tenho conta. Entrar"
            : "Ainda não tenho conta. Criar conta"}
        </button>
        <button className="button secondary full" onClick={onDemo}>
          Explorar demonstração <Sparkles size={16} />
        </button>
      </div>
    </div>
  );
}
function LinkStudent({
  demo,
  onClose,
  onSuccess,
}: {
  demo: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <Modal title="Associar um aluno" onClose={onClose}>
      <p className="muted">
        Pede ao aluno o código de partilha da conta. O código autoriza a
        associação ao teu acompanhamento.
      </p>
      {demo ? (
        <p className="inline-notice">
          Na demonstração, os alunos de exemplo já estão associados. Entra numa
          conta real para adicionar os teus alunos.
        </p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            try {
              const { error } = await supabase!.rpc("link_student", {
                code: code.trim(),
              });
              if (error) throw error;
              await onSuccess();
            } catch {
              setError(
                "Código inválido ou aluno já associado. Confirma o código com o aluno.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <label>
            Código do aluno
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Código de partilha"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="button full" disabled={pending}>
            <Link2 size={16} />
            Associar aluno
          </button>
        </form>
      )}
    </Modal>
  );
}
