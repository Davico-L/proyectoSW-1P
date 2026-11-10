import { randomUUID } from "node:crypto";

/**
 * Estados internos de una propuesta en el backend (almacenamiento en Mongo y flujo de ejecución).
 */
export type ProposalStatus =
  | "pending"
  | "applying"
  | "approved"
  | "rejected"
  | "expired";

export type InternalProposalStatus = ProposalStatus;

/**
 * Estados públicos expuestos a los clientes (idénticos a los internos, pero sin 'applying').
 */
export type PublicProposalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export const VALID_INTERNAL_PROPOSAL_STATUSES: readonly ProposalStatus[] = [
  "pending",
  "applying",
  "approved",
  "rejected",
  "expired",
] as const;

export const VALID_PUBLIC_PROPOSAL_STATUSES: readonly PublicProposalStatus[] = [
  "pending",
  "approved",
  "rejected",
  "expired",
] as const;

export interface Proposal {
  id: string;
  status: ProposalStatus;
  summary: string[];
  requestedBy: string;
  decidedBy?: string;
  decidedAt?: string | Date;
  operations?: any[];
  [key: string]: any;
}

export interface PublicProposal {
  id: string;
  status: PublicProposalStatus;
  summary: string[];
  requestedBy: string;
  decidedBy?: string;
  decidedAt?: string | Date;
}

export interface CreateProposalParams {
  summary: string[];
  requestedBy: string;
}

/**
 * Crea una nueva propuesta en estado inicial "pending" con identificador único UUID v4.
 */
export function createProposal(params: CreateProposalParams): {
  id: string;
  status: "pending";
  summary: string[];
  requestedBy: string;
} {
  return {
    id: randomUUID(),
    status: "pending",
    summary: Array.isArray(params?.summary) ? [...params.summary] : [],
    requestedBy:
      typeof params?.requestedBy === "string" ? params.requestedBy.trim() : "",
  };
}

/**
 * Sanitiza y convierte una propuesta interna a su representación pública para los clientes.
 * - Muestra el estado "applying" como "pending".
 * - Omite estrictamente operaciones internas, notas u otros metadatos privados del servidor.
 * - Devuelve solo: { id, status, summary, requestedBy, decidedBy?, decidedAt? }.
 */
export function toPublicProposal(p: any): PublicProposal {
  if (!p || typeof p !== "object") {
    throw new Error("Invalid proposal");
  }

  // Si no tiene status ni id (p. ej. mocks genéricos de CU18 como { type: "add_class" })
  if (p.status === undefined && p.id === undefined) {
    const copy = { ...p };
    delete copy.operations;
    return copy;
  }

  const effectiveStatus: PublicProposalStatus =
    p.status === "applying" ? "pending" : p.status;

  const publicProp: PublicProposal = {
    id: String(p.id || ""),
    status: effectiveStatus,
    summary: Array.isArray(p.summary) ? [...p.summary] : [],
    requestedBy: typeof p.requestedBy === "string" ? p.requestedBy : "",
  };

  if (p.decidedBy !== undefined && p.decidedBy !== null) {
    publicProp.decidedBy = p.decidedBy;
  }

  if (p.decidedAt !== undefined && p.decidedAt !== null) {
    publicProp.decidedAt = p.decidedAt;
  }

  return publicProp;
}

/**
 * Genera el texto con el que Codia anuncia una propuesta en el chat de la sala:
 * "<Nombre>, propongo: <resumen>. Queda pendiente de aprobación del equipo."
 */
export function buildProposalText(nombre: string, resumen: string): string {
  const cleanNombre = typeof nombre === "string" ? nombre.trim() : "";
  const cleanResumen =
    typeof resumen === "string" ? resumen.trim().replace(/\.+$/, "") : "";
  return `${cleanNombre}, propongo: ${cleanResumen}. Queda pendiente de aprobación del equipo.`;
}
