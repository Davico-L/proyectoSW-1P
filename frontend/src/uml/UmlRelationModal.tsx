import React, { useState } from "react";
import type { Multiplicity } from "./types";
import "./UmlClassModal.scss";

interface UmlRelationModalProps {
  initialData?: {
    multiplicitySource?: string;
    multiplicityTarget?: string;
  };
  onConfirm: (multiplicitySource: string, multiplicityTarget: string) => void;
  onCancel: () => void;
}

const MULTIPLICITY_OPTIONS: readonly Multiplicity[] = [
  "1",
  "0..1",
  "0..*",
  "1..*",
  "*",
];

export const UmlRelationModal: React.FC<UmlRelationModalProps> = ({
  initialData,
  onConfirm,
  onCancel,
}) => {
  const [multiplicitySource, setMultiplicitySource] = useState<string>(
    initialData?.multiplicitySource || "1",
  );
  const [multiplicityTarget, setMultiplicityTarget] = useState<string>(
    initialData?.multiplicityTarget || "1",
  );

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    onConfirm(multiplicitySource, multiplicityTarget);
  };

  return (
    <div className="uml-modal-overlay" onClick={onCancel}>
      <div
        className="uml-modal-content"
        style={{ maxWidth: "420px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="uml-modal-header">
          <h2>Editar multiplicidades</h2>
          <button
            type="button"
            className="uml-modal-close-btn"
            onClick={onCancel}
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="uml-modal-body">
          <div className="uml-form-group">
            <label htmlFor="uml-multiplicity-source">Multiplicidad origen</label>
            <select
              id="uml-multiplicity-source"
              value={multiplicitySource}
              onChange={(e) => setMultiplicitySource(e.target.value)}
            >
              {MULTIPLICITY_OPTIONS.map((opt) => (
                <option key={`source-${opt}`} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="uml-form-group">
            <label htmlFor="uml-multiplicity-target">Multiplicidad destino</label>
            <select
              id="uml-multiplicity-target"
              value={multiplicityTarget}
              onChange={(e) => setMultiplicityTarget(e.target.value)}
            >
              {MULTIPLICITY_OPTIONS.map((opt) => (
                <option key={`target-${opt}`} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </form>

        <div className="uml-modal-footer">
          <button
            type="button"
            className="uml-cancel-btn"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="uml-confirm-btn"
            onClick={() => handleSubmit()}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};
