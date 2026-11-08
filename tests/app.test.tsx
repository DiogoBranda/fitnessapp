// @vitest-environment jsdom
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import App from "../src/App";
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("percursos principais", () => {
  it("cria e arquiva um plano com treinos e exercícios", async () => {
    render(<App />);
    await screen.findByText("Olá, Miguel");
    fireEvent.click(screen.getByRole("button", { name: "Criar plano" }));
    fireEvent.change(screen.getByLabelText("Nome do plano"), {
      target: { value: "Plano de teste" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar treino" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar plano" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Planos de treino" }));
    expect(screen.getByText("Plano de teste")).toBeTruthy();
    const plan = screen.getByText("Plano de teste").closest("section")!;
    fireEvent.click(within(plan).getByRole("button", { name: "Arquivar" }));
    fireEvent.click(screen.getByRole("button", { name: /Arquivados/ }));
    expect(screen.getByText("Plano de teste")).toBeTruthy();
  });
  it("persiste um treino, retoma e conclui todas as séries", async () => {
    render(<App />);
    await screen.findByText("Olá, Miguel");
    fireEvent.change(screen.getByLabelText("Modo de demonstração"), {
      target: { value: "student" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Planos de treino" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver plano completo" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Iniciar treino" })[0],
    );
    await screen.findByText("0 de 12 séries");
    fireEvent.change(
      screen.getByLabelText("Agachamento com barra série 1 carga"),
      { target: { value: "40" } },
    );
    fireEvent.change(
      screen.getByLabelText("Agachamento com barra série 1 repetições"),
      { target: { value: "10" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Concluir série 1 de Agachamento com barra",
      }),
    );
    await screen.findByText("1 de 12 séries");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await screen.findByRole("button", { name: "Retomar treino em curso" });
    fireEvent.click(
      screen.getByRole("button", { name: "Retomar treino em curso" }),
    );
    expect(
      (
        screen.getByLabelText(
          "Agachamento com barra série 1 carga",
        ) as HTMLInputElement
      ).value,
    ).toBe("40");
    for (const button of screen.getAllByRole("button", {
      name: /^Concluir série/,
    })) {
      fireEvent.click(button);
      await waitFor(() =>
        expect((button as HTMLButtonElement).disabled).toBe(false),
      );
    }
    await screen.findByText("12 de 12 séries");
    fireEvent.click(screen.getByRole("button", { name: "Concluir treino" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const state = JSON.parse(localStorage.getItem("forma-demo-v1")!);
    expect(
      state.sessions.filter(
        (s: { completed_at: string | null }) => s.completed_at,
      ),
    ).toHaveLength(13);
  });
  it("persiste comentários por plano/treino/exercício e mensagens privadas", async () => {
    render(<App />);
    await screen.findByText("Olá, Miguel");
    fireEvent.click(screen.getByRole("button", { name: "Planos de treino" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver plano completo" }));
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Comentários: Agachamento com barra",
      })[0],
    );
    fireEvent.change(screen.getByLabelText("Mensagem"), {
      target: { value: "Mantém as costas direitas." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    await screen.findByText("Mantém as costas direitas.");
    const state = JSON.parse(localStorage.getItem("forma-demo-v1")!);
    expect(state.messages.at(-1).plan_id).toBe("plan-1");
    expect(state.messages.at(-1).workout_id).toBe("workout-a");
    expect(state.messages.at(-1).exercise_id).toBeTruthy();
  });
  it("adiciona ginásios e valida a cadeia em modo administrador", async () => {
    render(<App />);
    await screen.findByText("Olá, Miguel");
    fireEvent.click(screen.getByRole("button", { name: "Ginásios" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ginásio" }));
    fireEvent.change(screen.getByLabelText("Nome do ginásio"), {
      target: { value: "Novo Ginásio" },
    });
    fireEvent.change(screen.getByLabelText("Cadeia ou ginásio independente"), {
      target: { value: "Nova Cadeia" },
    });
    fireEvent.change(screen.getByLabelText("Cidade"), {
      target: { value: "Braga" },
    });
    fireEvent.click(screen.getByLabelText("Halteres"));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Adicionar ginásio",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Novo Ginásio")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Modo de demonstração"), {
      target: { value: "admin" },
    });
    const row = screen.getByText("Nova Cadeia").closest(".admin-row")!;
    fireEvent.click(within(row).getByRole("button", { name: "Validar" }));
    await waitFor(() => expect(within(row).getByText("Validada")).toBeTruthy());
  });
});
