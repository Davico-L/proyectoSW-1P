import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProposalCard, ProposalData } from "./ProposalCard";

describe("CU22 Fase 3B: ProposalCard", () => {
  const baseProposal: ProposalData = {
    id: "prop-123",
    status: "pending",
    summary: ["creé la clase Factura", "creé la clase Detalle"],
    requestedBy: "Carlos",
  };

  it("renderiza correctamente el estado 'pending' con viñetas y botones habilitados", () => {
    const onDecision = vi.fn();

    render(
      <ProposalCard
        proposal={baseProposal}
        connected={true}
        busy={false}
        onDecision={onDecision}
      />
    );

    // Encabezado
    expect(screen.getByText("Propuesta de Codia")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();

    // Viñetas del resumen
    expect(screen.getByText("creé la clase Factura")).toBeInTheDocument();
    expect(screen.getByText("creé la clase Detalle")).toBeInTheDocument();

    // Botones
    const approveBtn = screen.getByRole("button", { name: "Aprobar" });
    const rejectBtn = screen.getByRole("button", { name: "Rechazar" });

    expect(approveBtn).toBeInTheDocument();
    expect(approveBtn).not.toBeDisabled();
    expect(rejectBtn).toBeInTheDocument();
    expect(rejectBtn).not.toBeDisabled();

    // No debe haber nota de sin conexión ni error
    expect(screen.queryByText("Sin conexión")).not.toBeInTheDocument();
  });

  it("llama a onDecision con 'approve' y 'reject' al hacer clic en los botones", () => {
    const onDecision = vi.fn();

    const { rerender } = render(
      <ProposalCard
        proposal={baseProposal}
        connected={true}
        busy={false}
        onDecision={onDecision}
      />
    );

    const approveBtn = screen.getByRole("button", { name: "Aprobar" });
    fireEvent.click(approveBtn);
    expect(onDecision).toHaveBeenCalledTimes(1);
    expect(onDecision).toHaveBeenCalledWith("approve");

    const rejectBtn = screen.getByRole("button", { name: "Rechazar" });
    fireEvent.click(rejectBtn);
    expect(onDecision).toHaveBeenCalledTimes(2);
    expect(onDecision).toHaveBeenCalledWith("reject");
  });

  it("deshabilita los botones y muestra 'Procesando…' en Aprobar cuando busy es true", () => {
    const onDecision = vi.fn();

    render(
      <ProposalCard
        proposal={baseProposal}
        connected={true}
        busy={true}
        onDecision={onDecision}
      />
    );

    // El botón Aprobar cambia de texto a 'Procesando…'
    const processingBtn = screen.getByRole("button", { name: "Procesando…" });
    expect(processingBtn).toBeInTheDocument();
    expect(processingBtn).toBeDisabled();

    const rejectBtn = screen.getByRole("button", { name: "Rechazar" });
    expect(rejectBtn).toBeDisabled();

    // Clics no deben disparar onDecision
    fireEvent.click(processingBtn);
    fireEvent.click(rejectBtn);
    expect(onDecision).not.toHaveBeenCalled();
  });

  it("deshabilita los botones y muestra la nota 'Sin conexión' cuando connected es false", () => {
    const onDecision = vi.fn();

    render(
      <ProposalCard
        proposal={baseProposal}
        connected={false}
        busy={false}
        onDecision={onDecision}
      />
    );

    const approveBtn = screen.getByRole("button", { name: "Aprobar" });
    const rejectBtn = screen.getByRole("button", { name: "Rechazar" });

    expect(approveBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
    expect(screen.getByText("Sin conexión")).toBeInTheDocument();

    fireEvent.click(approveBtn);
    fireEvent.click(rejectBtn);
    expect(onDecision).not.toHaveBeenCalled();
  });

  it("muestra la línea de aviso de error bajo los botones si error está presente", () => {
    render(
      <ProposalCard
        proposal={baseProposal}
        connected={true}
        busy={false}
        error="No se pudieron aplicar las operaciones en el diagrama"
        onDecision={vi.fn()}
      />
    );

    const errorAlert = screen.getByRole("alert");
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent(
      "No se pudieron aplicar las operaciones en el diagrama"
    );
  });

  it("renderiza el estado 'approved' sin botones y con etiqueta 'Aprobada por X'", () => {
    const approvedProposal: ProposalData = {
      ...baseProposal,
      status: "approved",
      decidedBy: "Ana",
      decidedAt: "2026-11-10T00:00:00.000Z",
    };

    render(
      <ProposalCard
        proposal={approvedProposal}
        connected={true}
        busy={false}
        onDecision={vi.fn()}
      />
    );

    // No debe haber botones de acción
    expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();

    // Badge superior
    expect(screen.getByText("Aprobada")).toBeInTheDocument();

    // Etiqueta descriptiva
    expect(screen.getByText("Aprobada por Ana")).toBeInTheDocument();
  });

  it("renderiza el estado 'approved' con 'Aprobada por el equipo' si decidedBy no está definido", () => {
    const approvedProposal: ProposalData = {
      ...baseProposal,
      status: "approved",
    };

    render(
      <ProposalCard
        proposal={approvedProposal}
        connected={true}
        busy={false}
        onDecision={vi.fn()}
      />
    );

    expect(screen.getByText("Aprobada por el equipo")).toBeInTheDocument();
  });

  it("renderiza el estado 'rejected' sin botones y con etiqueta 'Rechazada por X'", () => {
    const rejectedProposal: ProposalData = {
      ...baseProposal,
      status: "rejected",
      decidedBy: "Luis",
      decidedAt: "2026-11-10T00:00:00.000Z",
    };

    render(
      <ProposalCard
        proposal={rejectedProposal}
        connected={true}
        busy={false}
        onDecision={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
    expect(screen.getByText("Rechazada")).toBeInTheDocument();
    expect(screen.getByText("Rechazada por Luis")).toBeInTheDocument();
  });

  it("renderiza el estado 'expired' sin botones y con etiqueta 'Caducada: repite el pedido a Codia'", () => {
    const expiredProposal: ProposalData = {
      ...baseProposal,
      status: "expired",
    };

    render(
      <ProposalCard
        proposal={expiredProposal}
        connected={true}
        busy={false}
        onDecision={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
    expect(screen.getByText("Caducada")).toBeInTheDocument();
    expect(
      screen.getByText("Caducada: repite el pedido a Codia")
    ).toBeInTheDocument();
  });
});
