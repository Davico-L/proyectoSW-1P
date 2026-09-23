import React, { useState } from "react";
import type { UmlClassData, UmlAttribute, UmlMethod } from "./types";
import "./UmlClassModal.scss";

interface UmlClassModalProps {
  initialData?: UmlClassData;
  onConfirm: (data: UmlClassData) => void;
  onCancel: () => void;
}

const ATTRIBUTE_TYPES: readonly UmlAttribute["type"][] = [
  "String",
  "Integer",
  "Long",
  "Boolean",
  "Double",
  "Date",
];

const METHOD_RETURN_TYPES: readonly UmlMethod["returnType"][] = [
  "String",
  "Integer",
  "Long",
  "Boolean",
  "Double",
  "Date",
  "void",
];

const VISIBILITIES: readonly UmlAttribute["visibility"][] = [
  "public",
  "private",
  "protected",
];

export const UmlClassModal: React.FC<UmlClassModalProps> = ({
  initialData,
  onConfirm,
  onCancel,
}) => {
  const [className, setClassName] = useState(initialData?.className ?? "");
  const [attributes, setAttributes] = useState<UmlAttribute[]>(
    initialData?.attributes ? [...initialData.attributes] : [],
  );
  const [methods, setMethods] = useState<UmlMethod[]>(
    initialData?.methods ? [...initialData.methods] : [],
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddAttribute = () => {
    setAttributes((prev) => [
      ...prev,
      { name: "", type: "String", visibility: "private" },
    ]);
  };

  const handleUpdateAttribute = (
    index: number,
    field: keyof UmlAttribute,
    value: string,
  ) => {
    setAttributes((prev) =>
      prev.map((attr, i) =>
        i === index ? { ...attr, [field]: value } : attr,
      ),
    );
  };

  const handleDeleteAttribute = (index: number) => {
    setAttributes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddMethod = () => {
    setMethods((prev) => [
      ...prev,
      { name: "", returnType: "void", visibility: "public" },
    ]);
  };

  const handleUpdateMethod = (
    index: number,
    field: keyof UmlMethod,
    value: string,
  ) => {
    setMethods((prev) =>
      prev.map((method, i) =>
        i === index ? { ...method, [field]: value } : method,
      ),
    );
  };

  const handleDeleteMethod = (index: number) => {
    setMethods((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    const trimmedClassName = className.trim();
    if (!trimmedClassName) {
      setErrorMessage("El nombre de la clase es obligatorio");
      return;
    }

    setErrorMessage(null);

    const data: UmlClassData = {
      type: "umlClass",
      className: trimmedClassName,
      attributes: attributes
        .filter((attr) => attr.name.trim() !== "")
        .map((attr) => ({ ...attr, name: attr.name.trim() })),
      methods: methods
        .filter((method) => method.name.trim() !== "")
        .map((method) => ({ ...method, name: method.name.trim() })),
    };

    onConfirm(data);
  };

  return (
    <div
      className="uml-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="uml-modal-content">
        <div className="uml-modal-header">
          <h2>{initialData ? "Editar Clase UML" : "Nueva Clase UML"}</h2>
          <button
            type="button"
            className="uml-modal-close-btn"
            onClick={onCancel}
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleConfirm} className="uml-modal-body">
          <div className="uml-form-group">
            <label htmlFor="uml-class-name-input">Nombre de la clase *</label>
            <input
              id="uml-class-name-input"
              type="text"
              placeholder="Ej. Usuario"
              value={className}
              onChange={(e) => {
                setClassName(e.target.value);
                if (errorMessage && e.target.value.trim()) {
                  setErrorMessage(null);
                }
              }}
              autoFocus
            />
            {errorMessage && (
              <span className="uml-error-text">{errorMessage}</span>
            )}
          </div>

          {/* Sección de Atributos */}
          <div className="uml-section">
            <div className="uml-section-header">
              <span>Atributos</span>
            </div>

            <div className="uml-rows-list">
              {attributes.length === 0 ? (
                <div className="uml-row-empty">No hay atributos definidos.</div>
              ) : (
                attributes.map((attr, index) => (
                  <div key={index} className="uml-item-row">
                    <input
                      type="text"
                      className="uml-input-name"
                      placeholder="nombre"
                      value={attr.name}
                      onChange={(e) =>
                        handleUpdateAttribute(index, "name", e.target.value)
                      }
                    />
                    <select
                      className="uml-select-type"
                      value={attr.type}
                      onChange={(e) =>
                        handleUpdateAttribute(
                          index,
                          "type",
                          e.target.value as UmlAttribute["type"],
                        )
                      }
                    >
                      {ATTRIBUTE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <select
                      className="uml-select-vis"
                      value={attr.visibility}
                      onChange={(e) =>
                        handleUpdateAttribute(
                          index,
                          "visibility",
                          e.target.value as UmlAttribute["visibility"],
                        )
                      }
                    >
                      {VISIBILITIES.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="uml-delete-btn"
                      onClick={() => handleDeleteAttribute(index)}
                      title="Eliminar atributo"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              className="uml-add-btn"
              onClick={handleAddAttribute}
            >
              + Agregar atributo
            </button>
          </div>

          {/* Sección de Métodos */}
          <div className="uml-section">
            <div className="uml-section-header">
              <span>Métodos</span>
            </div>

            <div className="uml-rows-list">
              {methods.length === 0 ? (
                <div className="uml-row-empty">No hay métodos definidos.</div>
              ) : (
                methods.map((method, index) => (
                  <div key={index} className="uml-item-row">
                    <input
                      type="text"
                      className="uml-input-name"
                      placeholder="nombreMetodo"
                      value={method.name}
                      onChange={(e) =>
                        handleUpdateMethod(index, "name", e.target.value)
                      }
                    />
                    <select
                      className="uml-select-type"
                      value={method.returnType}
                      onChange={(e) =>
                        handleUpdateMethod(
                          index,
                          "returnType",
                          e.target.value as UmlMethod["returnType"],
                        )
                      }
                    >
                      {METHOD_RETURN_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <select
                      className="uml-select-vis"
                      value={method.visibility}
                      onChange={(e) =>
                        handleUpdateMethod(
                          index,
                          "visibility",
                          e.target.value as UmlMethod["visibility"],
                        )
                      }
                    >
                      {VISIBILITIES.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="uml-delete-btn"
                      onClick={() => handleDeleteMethod(index)}
                      title="Eliminar método"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              className="uml-add-btn"
              onClick={handleAddMethod}
            >
              + Agregar método
            </button>
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
            onClick={() => handleConfirm()}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};
