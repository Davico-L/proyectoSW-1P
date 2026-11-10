import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createProposal,
  toPublicProposal,
  buildProposalText,
  VALID_INTERNAL_PROPOSAL_STATUSES,
  VALID_PUBLIC_PROPOSAL_STATUSES,
  Proposal,
} from "./proposalHelpers";
import { AnswerInRoomResult } from "./aiChatService";

describe("CU22 Fase 1B - proposalHelpers", () => {
  describe("1. Definición de ProposalStatus interno y público", () => {
    test("estados internos contienen pending, applying, approved, rejected, expired", () => {
      assert.deepEqual(VALID_INTERNAL_PROPOSAL_STATUSES, [
        "pending",
        "applying",
        "approved",
        "rejected",
        "expired",
      ]);
    });

    test("estados públicos contienen pending, approved, rejected, expired (sin applying)", () => {
      assert.deepEqual(VALID_PUBLIC_PROPOSAL_STATUSES, [
        "pending",
        "approved",
        "rejected",
        "expired",
      ]);
      assert.equal(VALID_PUBLIC_PROPOSAL_STATUSES.includes("applying" as any), false);
    });
  });

  describe("2. createProposal", () => {
    test("genera id UUID v4 válido, status 'pending', summary y requestedBy", () => {
      const summary = ["Crear clase Factura", "Asociar Factura con Cliente"];
      const requestedBy = "Carlos";

      const prop = createProposal({ summary, requestedBy });

      assert.ok(prop.id, "Debe tener un id generado");
      assert.match(
        prop.id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        "El id debe ser un UUID v4 válido"
      );
      assert.equal(prop.status, "pending");
      assert.deepEqual(prop.summary, summary);
      assert.equal(prop.requestedBy, "Carlos");
    });

    test("genera identificadores únicos (randomUUID) en llamadas sucesivas", () => {
      const p1 = createProposal({ summary: ["A"], requestedBy: "Ana" });
      const p2 = createProposal({ summary: ["B"], requestedBy: "Beto" });

      assert.notEqual(p1.id, p2.id);
    });

    test("maneja parámetros vacíos o límites con valores seguros", () => {
      const prop = createProposal({ summary: [] as any, requestedBy: "  Ana  " });
      assert.deepEqual(prop.summary, []);
      assert.equal(prop.requestedBy, "Ana");
    });
  });

  describe("3. toPublicProposal", () => {
    test("muestra 'applying' como 'pending'", () => {
      const internalProp: Proposal = {
        id: "prop-123",
        status: "applying",
        summary: ["Agregar atributo /total"],
        requestedBy: "Diego",
        operations: [{ action: "addAttribute", className: "Factura" }],
      };

      const pub = toPublicProposal(internalProp);

      assert.equal(pub.status, "pending");
      assert.equal(pub.id, "prop-123");
      assert.deepEqual(pub.summary, ["Agregar atributo /total"]);
      assert.equal(pub.requestedBy, "Diego");
      assert.equal((pub as any).operations, undefined, "operations no debe viajar al cliente");
    });

    test("conserva estados 'pending', 'approved', 'rejected' y 'expired'", () => {
      const statuses = ["pending", "approved", "rejected", "expired"] as const;

      for (const st of statuses) {
        const pub = toPublicProposal({
          id: `id-${st}`,
          status: st,
          summary: ["Cambio"],
          requestedBy: "Tester",
        });
        assert.equal(pub.status, st);
      }
    });

    test("omite estrictamente cualquier campo interno adicional", () => {
      const internalProp = {
        id: "prop-safe-check",
        status: "pending",
        summary: ["Crear clase Pago"],
        requestedBy: "Elena",
        operations: [{ action: "addClass", name: "Pago" }],
        warnings: ["Clase ya existía"],
        mongo_id: "60c72b2f9b1d8b2bad000001",
        secretInternalHash: "xyz123",
      };

      const pub = toPublicProposal(internalProp);

      assert.deepEqual(pub, {
        id: "prop-safe-check",
        status: "pending",
        summary: ["Crear clase Pago"],
        requestedBy: "Elena",
      });
      assert.equal("operations" in pub, false);
      assert.equal("warnings" in pub, false);
      assert.equal("mongo_id" in pub, false);
      assert.equal("secretInternalHash" in pub, false);
    });

    test("incluye decidedBy y decidedAt únicamente si están definidos", () => {
      const date = new Date("2026-11-09T22:00:00.000Z");
      const propWithDecision = {
        id: "prop-decided",
        status: "approved" as const,
        summary: ["Cambio aprobado"],
        requestedBy: "Laura",
        decidedBy: "Martín",
        decidedAt: date,
      };

      const pub = toPublicProposal(propWithDecision);

      assert.equal(pub.decidedBy, "Martín");
      assert.equal(pub.decidedAt, date);

      // Sin decisión
      const propWithoutDecision = {
        id: "prop-undecided",
        status: "pending" as const,
        summary: ["Pendiente"],
        requestedBy: "Laura",
      };

      const pub2 = toPublicProposal(propWithoutDecision);
      assert.equal("decidedBy" in pub2, false);
      assert.equal("decidedAt" in pub2, false);
    });

    test("lanza error ante argumento inválido", () => {
      assert.throws(() => toPublicProposal(null), /Invalid proposal/);
      assert.throws(() => toPublicProposal(undefined), /Invalid proposal/);
      assert.throws(() => toPublicProposal("not-an-object"), /Invalid proposal/);
    });
  });

  describe("4. buildProposalText", () => {
    test("devuelve '<Nombre>, propongo: <resumen>. Queda pendiente de aprobación del equipo.'", () => {
      const text = buildProposalText(
        "Ana",
        "agregar la clase Factura con los atributos id y monto, y asociarla con Cliente"
      );

      assert.equal(
        text,
        "Ana, propongo: agregar la clase Factura con los atributos id y monto, y asociarla con Cliente. Queda pendiente de aprobación del equipo."
      );
    });

    test("elimina punto final del resumen para evitar puntos dobles", () => {
      const text = buildProposalText(
        "Carlos",
        "crear la clase Producto."
      );

      assert.equal(
        text,
        "Carlos, propongo: crear la clase Producto. Queda pendiente de aprobación del equipo."
      );
    });

    test("recorta espacios en blanco en nombre y resumen", () => {
      const text = buildProposalText(
        "  Beatriz  ",
        "   modificar el tipo de fecha a Date   "
      );

      assert.equal(
        text,
        "Beatriz, propongo: modificar el tipo de fecha a Date. Queda pendiente de aprobación del equipo."
      );
    });
  });

  describe("5. Compatibilidad de tipo kind en AnswerInRoomResult", () => {
    test("AnswerInRoomResult admite 'proposal' además de 'answer' y 'modification'", () => {
      const proposalResult: AnswerInRoomResult = {
        message: "Ana, propongo: crear clase. Queda pendiente de aprobación del equipo.",
        operations: [],
        kind: "proposal",
      };

      assert.equal(proposalResult.kind, "proposal");

      const answerResult: AnswerInRoomResult = {
        message: "Respuesta",
        operations: [],
        kind: "answer",
      };
      assert.equal(answerResult.kind, "answer");

      const modResult: AnswerInRoomResult = {
        message: "Modificado",
        operations: [],
        kind: "modification",
      };
      assert.equal(modResult.kind, "modification");
    });
  });
});
