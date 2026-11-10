import React from "react";
import type { PublicProposalData } from "./types";
import "./ProposalCard.scss";

export type ProposalData = PublicProposalData;

export interface ProposalCardProps {
  proposal: ProposalData;
  connected: boolean;
  busy: boolean;
  error?: string;
  onDecision: (decision: "approve" | "reject") => void;
}

function getStatusBadgeLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "approved":
      return "Aprobada";
    case "rejected":
      return "Rechazada";
    case "expired":
      return "Caducada";
    default:
      return status;
  }
}

function getDecisionBannerText(status: string, decidedBy?: string): string {
  switch (status) {
    case "approved":
      return `Aprobada por ${decidedBy || "el equipo"}`;
    case "rejected":
      return `Rechazada por ${decidedBy || "el equipo"}`;
    case "expired":
      return "Caducada: repite el pedido a Codia";
    default:
      return status;
  }
}

export const ProposalCard: React.FC<ProposalCardProps> = ({
  proposal,
  connected,
  busy,
  error,
  onDecision,
}) => {
  const isPending = proposal.status === "pending";
  const statusBadgeLabel = getStatusBadgeLabel(proposal.status);
  const summaryItems = Array.isArray(proposal.summary) ? proposal.summary : [];

  return (
    <div
      className={`proposal-card proposal-card--${proposal.status}`}
      role="region"
      aria-label="Propuesta de Codia"
    >
      {/* Línea superior: título a la izquierda, etiqueta de estado a la derecha */}
      <div className="proposal-card-header">
        <span className="proposal-card-title">Propuesta de Codia</span>
        <span
          className={`proposal-card-badge proposal-card-badge--${proposal.status}`}
        >
          {statusBadgeLabel}
        </span>
      </div>

      {/* Lista del resumen con una viñeta por línea */}
      {summaryItems.length > 0 && (
        <ul className="proposal-card-summary">
          {summaryItems.map((item, idx) => (
            <li key={idx} className="proposal-card-summary-item">
              {item}
            </li>
          ))}
        </ul>
      )}

      {/* Acciones para estado pendiente */}
      {isPending ? (
        <>
          <div className="proposal-card-actions">
            <button
              type="button"
              className="proposal-card-btn proposal-card-btn--approve"
              onClick={() => onDecision("approve")}
              disabled={busy || !connected}
              aria-busy={busy}
            >
              {busy ? "Procesando…" : "Aprobar"}
            </button>
            <button
              type="button"
              className="proposal-card-btn proposal-card-btn--reject"
              onClick={() => onDecision("reject")}
              disabled={busy || !connected}
            >
              Rechazar
            </button>
            {!connected && (
              <span className="proposal-card-offline-note">Sin conexión</span>
            )}
          </div>

          {/* Línea de aviso de error bajo los botones */}
          {error && (
            <div className="proposal-card-error" role="alert">
              {error}
            </div>
          )}
        </>
      ) : (
        /* Si no está pendiente: sin botones y con etiqueta descriptiva */
        <div
          className={`proposal-card-decision-banner proposal-card-decision-banner--${proposal.status}`}
        >
          {getDecisionBannerText(proposal.status, proposal.decidedBy)}
        </div>
      )}
    </div>
  );
};
