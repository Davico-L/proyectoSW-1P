import { eyeIcon } from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { LanguageList } from "../app-language/LanguageList";

import { saveDebugState } from "./DebugCanvas";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  refresh: () => void;
  onLogout?: () => void;
  onOpenDiagrams?: () => void;
  onGenerateBackend?: () => void;
  onGenerateMobile?: () => void;
  onExportXmi?: () => void;
  onImportXmi?: () => void;
  isGeneratingBackend?: boolean;
  isGeneratingMobile?: boolean;
  isExportingXmi?: boolean;
  isImportingXmi?: boolean;
  hasActiveDiagram?: boolean;
}> = React.memo((props) => {
  return (
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      {props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      {props.onOpenDiagrams && (
        <>
          <MainMenu.Separator />
          <MainMenu.Item
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            }
            onSelect={props.onOpenDiagrams}
          >
            Mis diagramas
          </MainMenu.Item>
        </>
      )}
      <MainMenu.Separator />
      {props.onGenerateBackend && (
        <MainMenu.Item
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
          }
          disabled={!props.hasActiveDiagram || props.isGeneratingBackend}
          onSelect={
            !props.hasActiveDiagram || props.isGeneratingBackend
              ? undefined
              : props.onGenerateBackend
          }
        >
          {props.isGeneratingBackend ? "Generando..." : "Generar Backend"}
        </MainMenu.Item>
      )}
      {props.onGenerateMobile && (
        <MainMenu.Item
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          }
          disabled={!props.hasActiveDiagram || props.isGeneratingMobile}
          onSelect={
            !props.hasActiveDiagram || props.isGeneratingMobile
              ? undefined
              : props.onGenerateMobile
          }
        >
          {props.isGeneratingMobile ? "Generando..." : "Generar app móvil"}
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      {props.onExportXmi && (
        <MainMenu.Item
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 12 15 15" />
            </svg>
          }
          disabled={!props.hasActiveDiagram || props.isExportingXmi}
          onSelect={
            !props.hasActiveDiagram || props.isExportingXmi
              ? undefined
              : props.onExportXmi
          }
        >
          {props.isExportingXmi ? "Exportando..." : "Exportar a XMI"}
        </MainMenu.Item>
      )}
      {props.onImportXmi && (
        <MainMenu.Item
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="12" x2="12" y2="18" />
              <polyline points="9 15 12 18 15 15" />
            </svg>
          }
          disabled={!props.hasActiveDiagram || props.isImportingXmi}
          onSelect={
            !props.hasActiveDiagram || props.isImportingXmi
              ? undefined
              : props.onImportXmi
          }
        >
          {props.isImportingXmi ? "Importando..." : "Importar desde XMI"}
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      {isDevEnv() && (
        <MainMenu.Item
          icon={eyeIcon}
          onSelect={() => {
            if (window.visualDebug) {
              delete window.visualDebug;
              saveDebugState({ enabled: false });
            } else {
              window.visualDebug = { data: [] };
              saveDebugState({ enabled: true });
            }
            props?.refresh();
          }}
        >
          Visual Debug
        </MainMenu.Item>
      )}
      <MainMenu.DefaultItems.Preferences />
      <MainMenu.DefaultItems.ToggleTheme allowSystemTheme theme={props.theme} />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
      {props.onLogout && (
        <>
          <MainMenu.Separator />
          <MainMenu.Item
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            }
            onSelect={props.onLogout}
          >
            Cerrar sesión
          </MainMenu.Item>
        </>
      )}
    </MainMenu>
  );
});
