import {
  Excalidraw,
  LiveCollaborationTrigger,
  TTDDialogTrigger,
  CaptureUpdateAction,
  reconcileElements,
  useEditorInterface,
  ExcalidrawAPIProvider,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import {
  CommandPalette,
  DEFAULT_CATEGORIES,
} from "@excalidraw/excalidraw/components/CommandPalette/CommandPalette";
import { ErrorDialog } from "@excalidraw/excalidraw/components/ErrorDialog";
import { OverwriteConfirmDialog } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirm";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { ShareableLinkDialog } from "@excalidraw/excalidraw/components/ShareableLinkDialog";
import Trans from "@excalidraw/excalidraw/components/Trans";
import {
  APP_NAME,
  EVENT,
  VERSION_TIMEOUT,
  debounce,
  getVersion,
  getFrame,
  preventUnload,
  resolvablePromise,
  isRunningInIframe,
  isDevEnv,
} from "@excalidraw/common";
import polyfill from "@excalidraw/excalidraw/polyfill";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  GithubIcon,
  XBrandIcon,
  DiscordIcon,
  ExcalLogo,
  usersIcon,
  exportToPlus,
  share,
  youtubeIcon,
} from "@excalidraw/excalidraw/components/icons";
import { isElementLink, isBoundToContainer } from "@excalidraw/element";
import {
  bumpElementVersions,
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import { newElementWith } from "@excalidraw/element";
import { isInitializedImageElement } from "@excalidraw/element";
import clsx from "clsx";
import {
  parseLibraryTokensFromUrl,
  useHandleLibrary,
} from "@excalidraw/excalidraw/data/library";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";
import type {
  ExcalidrawElement,
  FileId,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  BinaryFiles,
  ExcalidrawInitialDataState,
  UIAppState,
  ExcalidrawProps,
  PointerDownState,
} from "@excalidraw/excalidraw/types";
import type { ResolutionType } from "@excalidraw/common/utility-types";
import type { ResolvablePromise } from "@excalidraw/common/utils";

import CustomStats from "./CustomStats";
import {
  Provider,
  useAtom,
  useAtomValue,
  useAtomWithInitialValue,
  appJotaiStore,
} from "./app-jotai";
import {
  FIREBASE_STORAGE_PREFIXES,
  isExcalidrawPlusSignedUser,
  STORAGE_KEYS,
} from "./app_constants";
import Collab, {
  collabAPIAtom,
  isCollaboratingAtom,
  isOfflineAtom,
  userToFollowAtom,
} from "./collab/Collab";
import { AppFooter } from "./components/AppFooter";
import { AppMainMenu } from "./components/AppMainMenu";
import { AppWelcomeScreen } from "./components/AppWelcomeScreen";
import {
  ExportToExcalidrawPlus,
  exportToExcalidrawPlus,
} from "./components/ExportToExcalidrawPlus";
import { TopErrorBoundary } from "./components/TopErrorBoundary";

import {
  exportToBackend,
  getCollaborationLinkData,
  importFromBackend,
  isCollaborationLink,
} from "./data";

import { updateStaleImageStatuses } from "./data/FileManager";
import { FileStatusStore } from "./data/fileStatusStore";
import { importFromLocalStorage } from "./data/localStorage";
import {
  getActiveDiagramId,
  setActiveDiagramId,
  loadDiagramFromBackend,
  ACTIVE_DIAGRAM_KEY,
  ACTIVE_SESSION_KEY,
  ACTIVE_USERNAME_KEY,
  BACKEND_URL,
} from "./data/backendSync";
import { LoginScreen } from "./components/LoginScreen";
import {
  joinDiagramRoom,
  leaveDiagramRoom,
  emitDiagramUpdate,
  onRemoteUpdate,
  onDiagramState,
} from "./data/realtimeSync";
import { UmlClassModal } from "../src/uml/UmlClassModal";
import { UmlRelationModal } from "../src/uml/UmlRelationModal";
import { createUmlClassElement } from "../src/uml/createUmlClassElement";
import { updateUmlClassElement } from "../src/uml/updateUmlClassElement";
import { createUmlRelationElement } from "../src/uml/createUmlRelationElement";
import { updateUmlRelationElement } from "../src/uml/updateUmlRelationElement";
import type {
  UmlClassData,
  UmlRelationData,
  RelationType,
} from "../src/uml/types";
import { IconButton } from "@excalidraw/excalidraw/components/IconButton";

import { loadFilesFromFirebase } from "./data/firebase";
import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
  LocalData,
  localStorageQuotaExceededAtom,
} from "./data/LocalData";
import { ShareDialog, shareDialogStateAtom } from "./share/ShareDialog";
import CollabError, { collabErrorIndicatorAtom } from "./collab/CollabError";
import { useHandleAppTheme } from "./useHandleAppTheme";
import { useAppLangCode } from "./app-language/language-state";
import DebugCanvas, {
  debugRenderer,
  isVisualDebuggerEnabled,
  loadSavedDebugState,
} from "./components/DebugCanvas";
import { useSimulatedCollaborators } from "./debugCollaborators";
import { AIComponents } from "./components/AI";
import { ExcalidrawPlusIframeExport } from "./ExcalidrawPlusIframeExport";

import "./index.scss";

import { ExcalidrawPlusPromoBanner } from "./components/ExcalidrawPlusPromoBanner";
import { AppSidebar } from "./components/AppSidebar";

import type { CollabAPI } from "./collab/Collab";

polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

declare global {
  interface BeforeInstallPromptEventChoiceResult {
    outcome: "accepted" | "dismissed";
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<BeforeInstallPromptEventChoiceResult>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let pwaEvent: BeforeInstallPromptEvent | null = null;

// Adding a listener outside of the component as it may (?) need to be
// subscribed early to catch the event.
//
// Also note that it will fire only if certain heuristics are met (user has
// used the app for some time, etc.)
window.addEventListener(
  "beforeinstallprompt",
  (event: BeforeInstallPromptEvent) => {
    // prevent Chrome <= 67 from automatically showing the prompt
    event.preventDefault();
    // cache for later use
    pwaEvent = event;
  },
);

let isSelfEmbedding = false;

if (window.self !== window.top) {
  try {
    const parentUrl = new URL(document.referrer);
    const currentUrl = new URL(window.location.href);
    if (parentUrl.origin === currentUrl.origin) {
      isSelfEmbedding = true;
    }
  } catch (error) {
    // ignore
  }
}

const shareableLinkConfirmDialog = {
  title: t("overwriteConfirm.modal.shareableLink.title"),
  description: (
    <Trans
      i18nKey="overwriteConfirm.modal.shareableLink.description"
      bold={(text) => <strong>{text}</strong>}
      br={() => <br />}
    />
  ),
  actionLabel: t("overwriteConfirm.modal.shareableLink.button"),
  color: "danger",
} as const;

const initializeScene = async (opts: {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI;
}): Promise<
  { scene: ExcalidrawInitialDataState | null } & (
    | { isExternalScene: true; id: string; key: string }
    | { isExternalScene: false; id?: null; key?: null }
  )
> => {
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");
  const jsonBackendMatch = window.location.hash.match(
    /^#json=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/,
  );
  const externalUrlMatch = window.location.hash.match(/^#url=(.*)$/);

  const localDataState = importFromLocalStorage();
  const activeDiagramId = getActiveDiagramId();
  if (activeDiagramId) {
    joinDiagramRoom(activeDiagramId);
  }
  const backendDiagram = activeDiagramId
    ? await loadDiagramFromBackend(activeDiagramId)
    : null;
  const initialDataState = backendDiagram?.data || localDataState;

  let scene: Omit<
    RestoredDataState,
    // we're not storing files in the scene database/localStorage, and instead
    // fetch them async from a different store
    "files"
  > & {
    scrollToContent?: boolean;
  } = {
    elements: restoreElements(initialDataState?.elements, null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    }),
    appState: restoreAppState(initialDataState?.appState, null),
  };

  let roomLinkData = getCollaborationLinkData(window.location.href);
  const isExternalScene = !!(id || jsonBackendMatch || roomLinkData);
  if (isExternalScene) {
    if (
      // don't prompt if scene is empty
      !scene.elements.length ||
      // don't prompt for collab scenes because we don't override local storage
      roomLinkData ||
      // otherwise, prompt whether user wants to override current scene
      (await openConfirmModal(shareableLinkConfirmDialog))
    ) {
      if (jsonBackendMatch) {
        const imported = await importFromBackend(
          jsonBackendMatch[1],
          jsonBackendMatch[2],
        );

        scene = {
          elements: bumpElementVersions(
            restoreElements(imported.elements, null, {
              repairBindings: true,
              deleteInvisibleElements: true,
            }),
            localDataState?.elements,
          ),
          appState: restoreAppState(
            imported.appState,
            // local appState when importing from backend to ensure we restore
            // localStorage user settings which we do not persist on server.
            localDataState?.appState,
          ),
        };
      }
      scene.scrollToContent = true;
      if (!roomLinkData) {
        window.history.replaceState({}, APP_NAME, window.location.origin);
      }
    } else {
      // https://github.com/excalidraw/excalidraw/issues/1919
      if (document.hidden) {
        return new Promise((resolve, reject) => {
          window.addEventListener(
            "focus",
            () => initializeScene(opts).then(resolve).catch(reject),
            {
              once: true,
            },
          );
        });
      }

      roomLinkData = null;
      window.history.replaceState({}, APP_NAME, window.location.origin);
    }
  } else if (externalUrlMatch) {
    window.history.replaceState({}, APP_NAME, window.location.origin);

    const url = externalUrlMatch[1];
    try {
      const request = await fetch(window.decodeURIComponent(url));
      const data = await loadFromBlob(await request.blob(), null, null);
      if (
        !scene.elements.length ||
        (await openConfirmModal(shareableLinkConfirmDialog))
      ) {
        return { scene: data, isExternalScene };
      }
    } catch (error: any) {
      return {
        scene: {
          appState: {
            errorMessage: t("alerts.invalidSceneUrl"),
          },
        },
        isExternalScene,
      };
    }
  }

  if (roomLinkData && opts.collabAPI) {
    const { excalidrawAPI } = opts;

    const scene = await opts.collabAPI.startCollaboration(roomLinkData);

    return {
      // when collaborating, the state may have already been updated at this
      // point (we may have received updates from other clients), so reconcile
      // elements and appState with existing state
      scene: {
        ...scene,
        appState: {
          ...restoreAppState(
            {
              ...scene?.appState,
              theme: localDataState?.appState?.theme || scene?.appState?.theme,
            },
            excalidrawAPI.getAppState(),
          ),
          // necessary if we're invoking from a hashchange handler which doesn't
          // go through App.initializeScene() that resets this flag
          isLoading: false,
        },
        elements: reconcileElements(
          scene?.elements || [],
          excalidrawAPI.getSceneElementsIncludingDeleted() as RemoteExcalidrawElement[],
          excalidrawAPI.getAppState(),
        ),
      },
      isExternalScene: true,
      id: roomLinkData.roomId,
      key: roomLinkData.roomKey,
    };
  } else if (scene) {
    return isExternalScene && jsonBackendMatch
      ? {
          scene,
          isExternalScene,
          id: jsonBackendMatch[1],
          key: jsonBackendMatch[2],
        }
      : { scene, isExternalScene: false };
  }
  return { scene: null, isExternalScene: false };
};

const debouncedEmitDiagramUpdate = debounce(
  (diagramId: string, elements: readonly ExcalidrawElement[]) => {
    emitDiagramUpdate(diagramId, { elements });
  },
  70,
);

const ExcalidrawWrapper = ({ onLogout }: { onLogout: () => void }) => {
  const excalidrawAPI = useExcalidrawAPI();

  const [activeUsername] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_USERNAME_KEY) || "";
    } catch {
      return "";
    }
  });

  const [errorMessage, setErrorMessage] = useState("");
  const isCollabDisabled = isRunningInIframe();

  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();

  const [langCode] = useAppLangCode();

  const editorInterface = useEditorInterface();

  // initial state
  // ---------------------------------------------------------------------------

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }

  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const isApplyingRemoteChange = useRef(false);
  const [isUmlModalOpen, setIsUmlModalOpen] = useState(false);
  const [editingUmlElement, setEditingUmlElement] =
    useState<ExcalidrawElement | null>(null);
  const umlClassCountRef = useRef(0);

  const handleUmlModalConfirm = (data: UmlClassData) => {
    if (!excalidrawAPI) {
      return;
    }

    if (editingUmlElement) {
      // Modo edición: buscar texto vinculado del contenedor usando boundElements
      const allElements = excalidrawAPI.getSceneElements();
      const boundTextBinding = editingUmlElement.boundElements?.find(
        (b) => b.type === "text",
      );
      const textElement = boundTextBinding
        ? allElements.find((el) => el.id === boundTextBinding.id)
        : null;

      updateUmlClassElement(
        editingUmlElement,
        textElement,
        data,
        excalidrawAPI,
      );

      setEditingUmlElement(null);
      setIsUmlModalOpen(false);
      return;
    }

    // Modo creación (Fase 1)
    const appState = excalidrawAPI.getAppState();
    const offset = umlClassCountRef.current * 15;
    umlClassCountRef.current += 1;

    const centerX =
      (appState.width / 2 - (appState.offsetLeft || 0)) / appState.zoom.value -
      appState.scrollX +
      offset;
    const centerY =
      (appState.height / 2 - (appState.offsetTop || 0)) / appState.zoom.value -
      appState.scrollY +
      offset;
    const { container, text } = createUmlClassElement(data, {
      x: centerX,
      y: centerY,
    });

    excalidrawAPI.updateScene({
      elements: [...excalidrawAPI.getSceneElements(), container, text],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    setIsUmlModalOpen(false);
  };

  const [isUmlRelationModalOpen, setIsUmlRelationModalOpen] = useState(false);
  const [editingUmlRelationElement, setEditingUmlRelationElement] =
    useState<ExcalidrawElement | null>(null);

  const handleUmlRelationModalConfirm = (
    multiplicitySource: string,
    multiplicityTarget: string,
  ) => {
    if (!excalidrawAPI || !editingUmlRelationElement) {
      return;
    }

    const allElements = excalidrawAPI.getSceneElements();
    const boundTextBinding = editingUmlRelationElement.boundElements?.find(
      (b) => b.type === "text",
    );
    const existingLabelText = boundTextBinding
      ? allElements.find((el) => el.id === boundTextBinding.id) || null
      : null;

    updateUmlRelationElement(
      editingUmlRelationElement,
      existingLabelText,
      multiplicitySource,
      multiplicityTarget,
      excalidrawAPI,
    );

    setEditingUmlRelationElement(null);
    setIsUmlRelationModalOpen(false);
  };
  const [pendingRelationType, setPendingRelationType] =
    useState<RelationType | null>(null);
  const [relationSource, setRelationSource] =
    useState<ExcalidrawElement | null>(null);

  const pendingRelationTypeRef = useRef<RelationType | null>(null);
  const relationSourceRef = useRef<ExcalidrawElement | null>(null);

  const updateRelationState = (
    type: RelationType | null,
    source: ExcalidrawElement | null,
  ) => {
    pendingRelationTypeRef.current = type;
    relationSourceRef.current = source;
    setPendingRelationType(type);
    setRelationSource(source);
  };

  const cancelRelation = (message?: string) => {
    updateRelationState(null, null);
    if (excalidrawAPI) {
      excalidrawAPI.setActiveTool({ type: "selection" });
      if (message) {
        excalidrawAPI.setToast({ message, duration: 3000, closable: true });
      } else {
        excalidrawAPI.setToast(null);
      }
    }
  };

  const handleStartRelation = (type: RelationType) => {
    if (!excalidrawAPI) {
      return;
    }
    if (pendingRelationTypeRef.current === type && !relationSourceRef.current) {
      cancelRelation("Relación cancelada");
      return;
    }

    updateRelationState(type, null);
    excalidrawAPI.setActiveTool({ type: "custom", customType: "umlRelation" });

    const labelMap: Record<RelationType, string> = {
      association: "Asociación",
      inheritance: "Herencia",
      composition: "Composición",
      aggregation: "Agregación",
      manyToMany: "Muchos a Muchos",
    };
    excalidrawAPI.setToast({
      message: `${labelMap[type]}: Haz clic en la clase de origen`,
      closable: true,
    });
  };

  const handlePointerDown = (
    activeTool: AppState["activeTool"],
    pointerDownState: PointerDownState,
  ) => {
    const currentRelationType = pendingRelationTypeRef.current;
    if (!currentRelationType || !excalidrawAPI) {
      return;
    }

    const { x, y } = pointerDownState.origin;
    const elements = excalidrawAPI.getSceneElements();

    let hitUmlClass: ExcalidrawElement | null = null;

    // Buscar de arriba hacia abajo (orden z inverso)
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (el.isDeleted) {
        continue;
      }

      if (
        x >= el.x &&
        x <= el.x + el.width &&
        y >= el.y &&
        y <= el.y + el.height
      ) {
        let target: ExcalidrawElement = el;
        if (isBoundToContainer(el)) {
          const container = elements.find((e) => e.id === el.containerId);
          if (container) {
            target = container;
          }
        }

        if (target.customData?.type === "umlClass") {
          hitUmlClass = target;
          break;
        } else {
          // Se clickeó un elemento que no es UML
          break;
        }
      }
    }

    // Si no se hizo clic sobre una clase UML (clic en lienzo vacío o elemento no UML)
    if (!hitUmlClass) {
      cancelRelation(
        "Selección inválida: se esperaba una clase UML. Creación de relación cancelada.",
      );
      return;
    }

    const currentSource = relationSourceRef.current;

    // Primer clic: seleccionar clase de origen
    if (!currentSource) {
      const sourceData = hitUmlClass.customData as UmlClassData | undefined;
      const sourceName = sourceData?.className || "Clase origen";
      updateRelationState(currentRelationType, hitUmlClass);
      excalidrawAPI.setToast({
        message: `Origen: ${sourceName}. Ahora haz clic en la clase de destino`,
        closable: true,
      });
      return;
    }

    // Segundo clic:
    // Si se hace clic en la misma clase
    if (currentSource.id === hitUmlClass.id) {
      cancelRelation(
        "Cancelado: la clase de origen y destino no pueden ser la misma.",
      );
      return;
    }

    // Destino válido: crear relación
    createUmlRelationElement(
      currentSource,
      hitUmlClass,
      currentRelationType,
      excalidrawAPI,
    );

    const sourceData = currentSource.customData as UmlClassData | undefined;
    const targetData = hitUmlClass.customData as UmlClassData | undefined;
    const sourceName = sourceData?.className || "Origen";
    const targetName = targetData?.className || "Destino";

    cancelRelation(`Relación creada entre ${sourceName} y ${targetName}.`);
  };

  const handleElementDoubleClick = (element: ExcalidrawElement) => {
    if (pendingRelationTypeRef.current) {
      return true;
    }
    if (element.customData?.type === "umlClass") {
      setEditingUmlElement(element);
      setIsUmlModalOpen(true);
      return true;
    }
    if (element.customData?.type === "umlRelation") {
      setEditingUmlRelationElement(element);
      setIsUmlRelationModalOpen(true);
      return true;
    }
  };

  const [currentDiagramId, setCurrentDiagramId] = useState<string | null>(() =>
    getActiveDiagramId(),
  );
  const [isGeneratingBackend, setIsGeneratingBackend] = useState(false);

  useEffect(() => {
    const updateId = () => {
      const id = getActiveDiagramId();
      setCurrentDiagramId((prev) => (prev !== id ? id : prev));
    };

    const handleIdChange = (e: Event) => {
      const customEvent = e as CustomEvent<string | null>;
      setCurrentDiagramId(customEvent.detail ?? getActiveDiagramId());
    };

    window.addEventListener("activeDiagramIdChanged", handleIdChange);
    const interval = setInterval(updateId, 1000);

    return () => {
      window.removeEventListener("activeDiagramIdChanged", handleIdChange);
      clearInterval(interval);
    };
  }, []);

  const handleGenerateBackend = async () => {
    const diagramId = currentDiagramId || getActiveDiagramId();
    if (!diagramId || isGeneratingBackend) {
      return;
    }

    setIsGeneratingBackend(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/diagrams/${diagramId}/generate-backend`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = "generated-backend.zip";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);

        if (excalidrawAPI) {
          excalidrawAPI.setToast({
            message: "¡Backend generado y descargado con éxito!",
            duration: 4000,
            closable: true,
          });
        }
      } else if (response.status === 400) {
        let errorMsg =
          "El diagrama debe tener al menos una clase válida para generar el backend";
        try {
          const data = await response.json();
          if (data?.error) {
            errorMsg = data.error;
          }
        } catch {
          // fallback al mensaje por defecto
        }

        if (excalidrawAPI) {
          excalidrawAPI.setToast({
            message: errorMsg,
            duration: 6000,
            closable: true,
          });
        } else {
          alert(errorMsg);
        }
      } else {
        const fallbackMsg = "No se pudo generar el backend, intenta de nuevo";
        if (excalidrawAPI) {
          excalidrawAPI.setToast({
            message: fallbackMsg,
            duration: 6000,
            closable: true,
          });
        } else {
          alert(fallbackMsg);
        }
      }
    } catch (error) {
      console.error("[generateBackend] Error al generar el backend:", error);
      const fallbackMsg = "No se pudo generar el backend, intenta de nuevo";
      if (excalidrawAPI) {
        excalidrawAPI.setToast({
          message: fallbackMsg,
          duration: 6000,
          closable: true,
        });
      } else {
        alert(fallbackMsg);
      }
    } finally {
      setIsGeneratingBackend(false);
    }
  };

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    const applyRemoteChange = (elements: readonly ExcalidrawElement[]) => {
      if (!elements) {
        return;
      }

      isApplyingRemoteChange.current = true;
      try {
        excalidrawAPI.updateScene({
          elements,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      } catch (err) {
        console.error(
          "[realtimeSync] Error al aplicar actualización remota:",
          err,
        );
      } finally {
        setTimeout(() => {
          isApplyingRemoteChange.current = false;
        }, 0);
      }
    };

    const unsubscribeDiagramState = onDiagramState(applyRemoteChange);
    const unsubscribeRemoteUpdate = onRemoteUpdate(applyRemoteChange);

    return () => {
      unsubscribeDiagramState();
      unsubscribeRemoteUpdate();
    };
  }, [excalidrawAPI]);

  useEffect(() => {
    trackEvent("load", "frame", getFrame());
    // Delayed so that the app has a time to load the latest SW
    setTimeout(() => {
      trackEvent("load", "version", getVersion());
    }, VERSION_TIMEOUT);
  }, []);

  const [, setShareDialogState] = useAtom(shareDialogStateAtom);
  const [collabAPI] = useAtom(collabAPIAtom);
  const [isCollaborating] = useAtomWithInitialValue(isCollaboratingAtom, () => {
    return isCollaborationLink(window.location.href);
  });
  const collabError = useAtomValue(collabErrorIndicatorAtom);
  const userToFollow = useAtomValue(userToFollowAtom);

  const viewportStatusFrame = useMemo(
    () =>
      userToFollow
        ? {
            border: "var(--color-primary-hover)",
            label: {
              label: (
                <>
                  Following{" "}
                  <span
                    style={{
                      display: "block",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 100,
                    }}
                    title={userToFollow.username}
                  >
                    {userToFollow.username}
                  </span>
                </>
              ),
              onClose: () => collabAPI?.setUserToFollow(null),
            },
          }
        : null,
    [userToFollow, collabAPI],
  );

  useHandleLibrary({
    excalidrawAPI,
    adapter: LibraryIndexedDBAdapter,
    // TODO maybe remove this in several months (shipped: 24-03-11)
    migrationAdapter: LibraryLocalStorageMigrationAdapter,
  });

  const [, forceRefresh] = useState(false);

  useEffect(() => {
    if (isDevEnv()) {
      const debugState = loadSavedDebugState();

      if (debugState.enabled && !window.visualDebug) {
        window.visualDebug = {
          data: [],
        };
      } else {
        delete window.visualDebug;
      }
      forceRefresh((prev) => !prev);
    }
  }, [excalidrawAPI]);

  // ?collaborators=<N> — populate the canvas with N static fake
  // collaborators for exercising avatar/UserList UI without a real
  // collab room
  useSimulatedCollaborators(excalidrawAPI);

  // ---------------------------------------------------------------------------
  // Hoisted loadImages
  // ---------------------------------------------------------------------------
  const loadImages = useCallback(
    (data: ResolutionType<typeof initializeScene>, isInitialLoad = false) => {
      if (!data.scene || !excalidrawAPI) {
        return;
      }

      if (collabAPI?.isCollaborating()) {
        if (data.scene.elements) {
          collabAPI
            .fetchImageFilesFromFirebase({
              elements: data.scene.elements,
              forceFetchFiles: true,
            })
            .then(({ loadedFiles, erroredFiles }) => {
              excalidrawAPI.addFiles(loadedFiles);
              updateStaleImageStatuses({
                excalidrawAPI,
                erroredFiles,
                elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
              });
            });
        }
      } else {
        const fileIds =
          data.scene.elements?.reduce((acc, element) => {
            if (isInitializedImageElement(element)) {
              return acc.concat(element.fileId);
            }
            return acc;
          }, [] as FileId[]) || [];

        if (data.isExternalScene) {
          if (fileIds.length) {
            // Direct Firebase call (not through FileManager), so track manually
            FileStatusStore.updateStatuses(
              fileIds.map((id) => [id, "loading"]),
            );
          }
          loadFilesFromFirebase(
            `${FIREBASE_STORAGE_PREFIXES.shareLinkFiles}/${data.id}`,
            data.key,
            fileIds,
          ).then(({ loadedFiles, erroredFiles }) => {
            excalidrawAPI.addFiles(loadedFiles);
            updateStaleImageStatuses({
              excalidrawAPI,
              erroredFiles,
              elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
            });
            FileStatusStore.updateStatuses([
              ...loadedFiles.map((f) => [f.id, "loaded"] as [FileId, "loaded"]),
              ...[...erroredFiles.keys()].map(
                (id) => [id, "error"] as [FileId, "error"],
              ),
            ]);
          });
        } else if (isInitialLoad) {
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(async ({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
          // on fresh load, clear unused files from IDB (from previous
          // session)
          LocalData.fileStorage.clearObsoleteFiles({
            currentFileIds: fileIds,
          });
        }
      }
    },
    [collabAPI, excalidrawAPI],
  );

  useEffect(() => {
    if (!excalidrawAPI || (!isCollabDisabled && !collabAPI)) {
      return;
    }

    initializeScene({ collabAPI, excalidrawAPI }).then(async (data) => {
      loadImages(data, /* isInitialLoad */ true);
      initialStatePromiseRef.current.promise.resolve(data.scene);
    });

    const onHashChange = async (event: HashChangeEvent) => {
      event.preventDefault();
      const libraryUrlTokens = parseLibraryTokensFromUrl();
      if (!libraryUrlTokens) {
        if (
          collabAPI?.isCollaborating() &&
          !isCollaborationLink(window.location.href)
        ) {
          collabAPI.stopCollaboration(false);
        }
        excalidrawAPI.updateScene({ appState: { isLoading: true } });

        initializeScene({ collabAPI, excalidrawAPI }).then((data) => {
          loadImages(data);
          if (data.scene) {
            excalidrawAPI.updateScene({
              elements: restoreElements(data.scene.elements, null, {
                repairBindings: true,
              }),
              appState: restoreAppState(data.scene.appState, null),
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
          }
        });
      }
    };

    const onUnload = () => {
      LocalData.flushSave();
    };

    const visibilityChange = (event: FocusEvent | Event) => {
      if (event.type === EVENT.BLUR || document.hidden) {
        LocalData.flushSave();
      }
    };

    window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
    window.addEventListener(EVENT.UNLOAD, onUnload, false);
    window.addEventListener(EVENT.BLUR, visibilityChange, false);
    document.addEventListener(EVENT.VISIBILITY_CHANGE, visibilityChange, false);
    return () => {
      window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
      window.removeEventListener(EVENT.UNLOAD, onUnload, false);
      window.removeEventListener(EVENT.BLUR, visibilityChange, false);
      document.removeEventListener(
        EVENT.VISIBILITY_CHANGE,
        visibilityChange,
        false,
      );
    };
  }, [isCollabDisabled, collabAPI, excalidrawAPI, loadImages]);

  useEffect(() => {
    const unloadHandler = (event: BeforeUnloadEvent) => {
      LocalData.flushSave();

      if (
        excalidrawAPI &&
        LocalData.fileStorage.shouldPreventUnload(
          excalidrawAPI.getSceneElements(),
        )
      ) {
        if (import.meta.env.VITE_APP_DISABLE_PREVENT_UNLOAD !== "true") {
          preventUnload(event);
        } else {
          console.warn(
            "preventing unload disabled (VITE_APP_DISABLE_PREVENT_UNLOAD)",
          );
        }
      }
    };
    window.addEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    return () => {
      window.removeEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    };
  }, [excalidrawAPI]);

  const onChange = (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    if (
      pendingRelationTypeRef.current &&
      appState.activeTool.type !== "custom" &&
      appState.activeTool.type !== "selection"
    ) {
      pendingRelationTypeRef.current = null;
      relationSourceRef.current = null;
      setPendingRelationType(null);
      setRelationSource(null);
    }

    if (isApplyingRemoteChange.current) {
      return;
    }

    if (collabAPI?.isCollaborating()) {
      collabAPI.syncElements(elements);
    }

    const activeDiagramId = getActiveDiagramId();
    if (activeDiagramId !== currentDiagramId) {
      setCurrentDiagramId(activeDiagramId);
    }
    if (activeDiagramId) {
      debouncedEmitDiagramUpdate(activeDiagramId, elements);
    }

    // this check is redundant, but since this is a hot path, it's best
    // not to evaludate the nested expression every time
    if (!LocalData.isSavePaused()) {
      LocalData.save(elements, appState, files, () => {
        if (excalidrawAPI) {
          let didChange = false;

          const elements = excalidrawAPI
            .getSceneElementsIncludingDeleted()
            .map((element) => {
              if (
                LocalData.fileStorage.shouldUpdateImageElementStatus(element)
              ) {
                const newElement = newElementWith(element, { status: "saved" });
                if (newElement !== element) {
                  didChange = true;
                }
                return newElement;
              }
              return element;
            });

          if (didChange) {
            excalidrawAPI.updateScene({
              elements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
        }
      });
    }

    // Render the debug scene if the debug canvas is available
    if (debugCanvasRef.current && excalidrawAPI) {
      debugRenderer(
        debugCanvasRef.current,
        appState,
        elements,
        window.devicePixelRatio,
      );
    }
  };

  const [latestShareableLink, setLatestShareableLink] = useState<string | null>(
    null,
  );

  const onExportToBackend = async (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles,
  ) => {
    if (exportedElements.length === 0) {
      throw new Error(t("alerts.cannotExportEmptyCanvas"));
    }
    try {
      const { url, errorMessage } = await exportToBackend(
        exportedElements,
        {
          ...appState,
          viewBackgroundColor: appState.exportBackground
            ? appState.viewBackgroundColor
            : getDefaultAppState().viewBackgroundColor,
        },
        files,
      );

      if (errorMessage) {
        throw new Error(errorMessage);
      }

      if (url) {
        setLatestShareableLink(url);
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        const { width, height } = appState;
        console.error(error, {
          width,
          height,
          devicePixelRatio: window.devicePixelRatio,
        });
        throw new Error(error.message);
      }
    }
  };

  const renderCustomStats = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
  ) => {
    return (
      <CustomStats
        setToast={(message) => excalidrawAPI!.setToast({ message })}
        appState={appState}
        elements={elements}
      />
    );
  };

  const isOffline = useAtomValue(isOfflineAtom);

  const localStorageQuotaExceeded = useAtomValue(localStorageQuotaExceededAtom);

  const onCollabDialogOpen = useCallback(
    () => setShareDialogState({ isOpen: true, type: "collaborationOnly" }),
    [setShareDialogState],
  );

  // ---------------------------------------------------------------------------
  // onExport — intercepts file save to wait for pending image loads
  // ---------------------------------------------------------------------------
  const onExport: Required<ExcalidrawProps>["onExport"] = useCallback(
    async function* () {
      let snapshot = FileStatusStore.getSnapshot();
      const { pending, total } = FileStatusStore.getPendingCount(
        snapshot.value,
      );
      if (pending === 0) {
        return;
      }

      // Yield initial progress
      yield {
        type: "progress",
        progress: (total - pending) / total,
        message: `Loading images (${total - pending}/${total})...`,
      };

      // Wait for all pending images to finish
      while (true) {
        snapshot = await FileStatusStore.pull(snapshot.version);
        const { pending: nowPending, total: nowTotal } =
          FileStatusStore.getPendingCount(snapshot.value);

        yield {
          type: "progress",
          progress: (nowTotal - nowPending) / nowTotal,
          message: `Loading images (${nowTotal - nowPending}/${nowTotal})...`,
        };

        if (nowPending === 0) {
          await new Promise((r) => setTimeout(r, 500));
          yield {
            type: "progress",
            message: `Preparing export...`,
          };
          return;
        }
      }
    },
    [],
  );

  // const onExport = () => {
  //   return new Promise((r) => setTimeout(r, 2500));
  //   // console.log("onExport");
  // };

  // browsers generally prevent infinite self-embedding, there are
  // cases where it still happens, and while we disallow self-embedding
  // by not whitelisting our own origin, this serves as an additional guard
  if (isSelfEmbedding) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          height: "100%",
        }}
      >
        <h1>I'm not a pretzel!</h1>
      </div>
    );
  }

  const ExcalidrawPlusCommand = {
    label: "Excalidraw+",
    category: DEFAULT_CATEGORIES.links,
    predicate: true,
    icon: <div style={{ width: 14 }}>{ExcalLogo}</div>,
    keywords: ["plus", "cloud", "server"],
    perform: () => {
      window.open(
        `${
          import.meta.env.VITE_APP_PLUS_LP
        }/plus?utm_source=excalidraw&utm_medium=app&utm_content=command_palette`,
        "_blank",
      );
    },
  };
  const ExcalidrawPlusAppCommand = {
    label: "Sign up",
    category: DEFAULT_CATEGORIES.links,
    predicate: true,
    icon: <div style={{ width: 14 }}>{ExcalLogo}</div>,
    keywords: [
      "excalidraw",
      "plus",
      "cloud",
      "server",
      "signin",
      "login",
      "signup",
    ],
    perform: () => {
      window.open(
        `${
          import.meta.env.VITE_APP_PLUS_APP
        }?utm_source=excalidraw&utm_medium=app&utm_content=command_palette`,
        "_blank",
      );
    },
  };

  return (
    <div
      style={{ height: "100%" }}
      className={clsx("excalidraw-app", {
        "is-collaborating": isCollaborating,
      })}
    >
      <Excalidraw
        viewportStatusFrame={viewportStatusFrame}
        userToFollow={userToFollow}
        onChange={onChange}
        onExport={onExport}
        onOpenUmlClassModal={() => {
          cancelRelation();
          setEditingUmlElement(null);
          setEditingUmlRelationElement(null);
          setIsUmlRelationModalOpen(false);
          setIsUmlModalOpen(true);
        }}
        onElementDoubleClick={handleElementDoubleClick}
        onPointerDown={handlePointerDown}
        initialData={initialStatePromiseRef.current.promise}
        isCollaborating={isCollaborating}
        onPointerUpdate={collabAPI?.onPointerUpdate}
        UIOptions={{
          canvasActions: {
            toggleTheme: true,
            export: {
              onExportToBackend,
              renderCustomUI: excalidrawAPI
                ? (elements, appState, files) => {
                    return (
                      <ExportToExcalidrawPlus
                        elements={elements}
                        appState={appState}
                        files={files}
                        name={excalidrawAPI.getName()}
                        onError={(error) => {
                          excalidrawAPI?.updateScene({
                            appState: {
                              errorMessage: error.message,
                            },
                          });
                        }}
                        onSuccess={() => {
                          excalidrawAPI.updateScene({
                            appState: { openDialog: null },
                          });
                        }}
                      />
                    );
                  }
                : undefined,
            },
          },
        }}
        langCode={langCode}
        renderCustomStats={renderCustomStats}
        detectScroll={false}
        handleKeyboardGlobally={true}
        autoFocus={true}
        theme={editorTheme}
        onThemeChange={setAppTheme}
        renderTopRightUI={(isMobile) => {
          return (
            <div
              className="excalidraw-ui-top-right"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <IconButton
                type="button"
                title="Nueva clase UML"
                aria-label="Nueva clase UML"
                data-testid="toolbar-new-uml-class"
                onClick={() => {
                  cancelRelation();
                  setEditingUmlElement(null);
                  setIsUmlModalOpen(true);
                }}
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="3" y1="15" x2="21" y2="15" />
                  </svg>
                }
              />
              <IconButton
                type="button"
                title="Relación UML: Asociación"
                aria-label="Relación UML: Asociación"
                data-testid="toolbar-relation-association"
                style={
                  pendingRelationType === "association"
                    ? { backgroundColor: "var(--color-primary-light, #e0dfff)" }
                    : undefined
                }
                onClick={() => handleStartRelation("association")}
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                }
              />
              <IconButton
                type="button"
                title="Relación UML: Herencia"
                aria-label="Relación UML: Herencia"
                data-testid="toolbar-relation-inheritance"
                style={
                  pendingRelationType === "inheritance"
                    ? { backgroundColor: "var(--color-primary-light, #e0dfff)" }
                    : undefined
                }
                onClick={() => handleStartRelation("inheritance")}
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="14" y2="12" />
                    <polygon points="14 7 21 12 14 17" fill="none" />
                  </svg>
                }
              />
              <IconButton
                type="button"
                title="Relación UML: Composición"
                aria-label="Relación UML: Composición"
                data-testid="toolbar-relation-composition"
                style={
                  pendingRelationType === "composition"
                    ? { backgroundColor: "var(--color-primary-light, #e0dfff)" }
                    : undefined
                }
                onClick={() => handleStartRelation("composition")}
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon
                      points="3 12 8 7 13 12 8 17"
                      fill="currentColor"
                    />
                    <line x1="13" y1="12" x2="21" y2="12" />
                  </svg>
                }
              />
              <IconButton
                type="button"
                title="Relación UML: Agregación"
                aria-label="Relación UML: Agregación"
                data-testid="toolbar-relation-aggregation"
                style={
                  pendingRelationType === "aggregation"
                    ? { backgroundColor: "var(--color-primary-light, #e0dfff)" }
                    : undefined
                }
                onClick={() => handleStartRelation("aggregation")}
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="3 12 8 7 13 12 8 17" fill="none" />
                    <line x1="13" y1="12" x2="21" y2="12" />
                  </svg>
                }
              />
              <button
                type="button"
                className="generate-backend-button"
                data-testid="toolbar-generate-backend"
                disabled={!currentDiagramId || isGeneratingBackend}
                onClick={handleGenerateBackend}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  backgroundColor:
                    !currentDiagramId || isGeneratingBackend
                      ? "var(--color-surface-lowest, #f1f3f5)"
                      : "var(--color-primary, #6965db)",
                  color:
                    !currentDiagramId || isGeneratingBackend
                      ? "var(--color-text-secondary, #9ca3af)"
                      : "#ffffff",
                  border: "1px solid transparent",
                  cursor:
                    !currentDiagramId || isGeneratingBackend
                      ? "not-allowed"
                      : "pointer",
                  transition: "all 0.15s ease",
                  opacity: !currentDiagramId || isGeneratingBackend ? 0.6 : 1,
                  boxShadow:
                    !currentDiagramId || isGeneratingBackend
                      ? "none"
                      : "0 1px 2px rgba(0, 0, 0, 0.08)",
                }}
                title={
                  !currentDiagramId
                    ? "Guarda el diagrama primero para generar el backend"
                    : isGeneratingBackend
                    ? "Generando proyecto Spring Boot..."
                    : "Generar y descargar backend Spring Boot (CU5)"
                }
              >
                {isGeneratingBackend ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      animation: "spin 1s linear infinite",
                    }}
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                )}
                <span>
                  {isGeneratingBackend ? "Generando..." : "Generar Backend"}
                </span>
              </button>
              {pendingRelationType && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    backgroundColor: "var(--color-primary-light, #eff6ff)",
                    border: "1px solid var(--color-primary, #3b82f6)",
                    color: "var(--color-primary-darker, #1e40af)",
                  }}
                >
                  <span>
                    {relationSource
                      ? "Seleccione la clase de destino"
                      : "Seleccione la clase de origen"}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      cancelRelation("Creación de relación cancelada.")
                    }
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "0 2px",
                      fontWeight: "bold",
                      color: "inherit",
                    }}
                    title="Cancelar relación"
                  >
                    ✕
                  </button>
                </div>
              )}
              {activeUsername && (
                <div
                  className="session-user-badge"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    fontSize: "13px",
                    fontWeight: 500,
                    borderRadius: "8px",
                    backgroundColor: "var(--color-surface-low, #f1f3f5)",
                    color: "var(--color-on-surface, #212529)",
                    border: "1px solid var(--color-surface-lowest, #e2e8f0)",
                  }}
                  title={`Sesión activa: ${activeUsername}`}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "#10b981",
                      display: "inline-block",
                    }}
                  />
                  <span>{activeUsername}</span>
                </div>
              )}

              <button
                type="button"
                onClick={onLogout}
                className="session-logout-button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  fontSize: "13px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  backgroundColor: "#fee2e2",
                  color: "#b91c1c",
                  border: "1px solid #fca5a5",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                title="Cerrar sesión actual y volver al inicio"
              >
                <svg
                  width="14"
                  height="14"
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
                <span>Cerrar sesión</span>
              </button>

              {!isMobile && collabAPI && !isCollabDisabled && (
                <>
                  {excalidrawAPI?.getEditorInterface().formFactor ===
                    "desktop" && (
                    <ExcalidrawPlusPromoBanner
                      isSignedIn={isExcalidrawPlusSignedUser}
                    />
                  )}

                  {collabError.message && (
                    <CollabError collabError={collabError} />
                  )}
                  <LiveCollaborationTrigger
                    isCollaborating={isCollaborating}
                    onSelect={() =>
                      setShareDialogState({ isOpen: true, type: "share" })
                    }
                    editorInterface={editorInterface}
                  />
                </>
              )}
            </div>
          );
        }}
        onLinkOpen={(element, event) => {
          if (element.link && isElementLink(element.link)) {
            event.preventDefault();
            excalidrawAPI?.setViewport({
              target: element.link,
              fit: "scale-down",
              animation: true,
            });
          }
        }}
      >
        <AppMainMenu
          onCollabDialogOpen={onCollabDialogOpen}
          isCollaborating={isCollaborating}
          isCollabEnabled={!isCollabDisabled}
          theme={appTheme}
          refresh={() => forceRefresh((prev) => !prev)}
          onLogout={onLogout}
        />
        <AppWelcomeScreen
          onCollabDialogOpen={onCollabDialogOpen}
          isCollabEnabled={!isCollabDisabled}
        />
        <OverwriteConfirmDialog>
          <OverwriteConfirmDialog.Actions.ExportToImage />
          <OverwriteConfirmDialog.Actions.SaveToDisk />
          {excalidrawAPI && (
            <OverwriteConfirmDialog.Action
              title={t("overwriteConfirm.action.excalidrawPlus.title")}
              actionLabel={t("overwriteConfirm.action.excalidrawPlus.button")}
              onClick={() => {
                exportToExcalidrawPlus(
                  excalidrawAPI.getSceneElements(),
                  excalidrawAPI.getAppState(),
                  excalidrawAPI.getFiles(),
                  excalidrawAPI.getName(),
                );
              }}
            >
              {t("overwriteConfirm.action.excalidrawPlus.description")}
            </OverwriteConfirmDialog.Action>
          )}
        </OverwriteConfirmDialog>
        <AppFooter onChange={() => excalidrawAPI?.refresh()} />
        {excalidrawAPI && <AIComponents excalidrawAPI={excalidrawAPI} />}

        <TTDDialogTrigger />
        {isCollaborating && isOffline && (
          <div className="alertalert--warning">
            {t("alerts.collabOfflineWarning")}
          </div>
        )}
        {localStorageQuotaExceeded && (
          <div className="alert alert--danger">
            {t("alerts.localStorageQuotaExceeded")}
          </div>
        )}
        {latestShareableLink && (
          <ShareableLinkDialog
            link={latestShareableLink}
            onCloseRequest={() => setLatestShareableLink(null)}
            setErrorMessage={setErrorMessage}
          />
        )}
        {excalidrawAPI && !isCollabDisabled && (
          <Collab excalidrawAPI={excalidrawAPI} />
        )}

        <ShareDialog
          collabAPI={collabAPI}
          onExportToBackend={async () => {
            if (excalidrawAPI) {
              try {
                await onExportToBackend(
                  excalidrawAPI.getSceneElements(),
                  excalidrawAPI.getAppState(),
                  excalidrawAPI.getFiles(),
                );
              } catch (error: any) {
                setErrorMessage(error.message);
              }
            }
          }}
        />

        <AppSidebar />

        {errorMessage && (
          <ErrorDialog onClose={() => setErrorMessage("")}>
            {errorMessage}
          </ErrorDialog>
        )}

        <CommandPalette
          customCommandPaletteItems={[
            {
              label: t("labels.liveCollaboration"),
              category: DEFAULT_CATEGORIES.app,
              keywords: [
                "team",
                "multiplayer",
                "share",
                "public",
                "session",
                "invite",
              ],
              icon: usersIcon,
              perform: () => {
                setShareDialogState({
                  isOpen: true,
                  type: "collaborationOnly",
                });
              },
            },
            {
              label: t("roomDialog.button_stopSession"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !!collabAPI?.isCollaborating(),
              keywords: [
                "stop",
                "session",
                "end",
                "leave",
                "close",
                "exit",
                "collaboration",
              ],
              perform: () => {
                if (collabAPI) {
                  collabAPI.stopCollaboration();
                  if (!collabAPI.isCollaborating()) {
                    setShareDialogState({ isOpen: false });
                  }
                }
              },
            },
            {
              label: t("labels.share"),
              category: DEFAULT_CATEGORIES.app,
              predicate: true,
              icon: share,
              keywords: [
                "link",
                "shareable",
                "readonly",
                "export",
                "publish",
                "snapshot",
                "url",
                "collaborate",
                "invite",
              ],
              perform: async () => {
                setShareDialogState({ isOpen: true, type: "share" });
              },
            },
            {
              label: "GitHub",
              icon: GithubIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: [
                "issues",
                "bugs",
                "requests",
                "report",
                "features",
                "social",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://github.com/excalidraw/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.followUs"),
              icon: XBrandIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["twitter", "contact", "social", "community"],
              perform: () => {
                window.open(
                  "https://x.com/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.discordChat"),
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              icon: DiscordIcon,
              keywords: [
                "chat",
                "talk",
                "contact",
                "bugs",
                "requests",
                "report",
                "feedback",
                "suggestions",
                "social",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://discord.gg/UexuTaE",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: "YouTube",
              icon: youtubeIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["features", "tutorials", "howto", "help", "community"],
              perform: () => {
                window.open(
                  "https://youtube.com/@excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            ...(isExcalidrawPlusSignedUser
              ? [
                  {
                    ...ExcalidrawPlusAppCommand,
                    label: "Sign in / Go to Excalidraw+",
                  },
                ]
              : [ExcalidrawPlusCommand, ExcalidrawPlusAppCommand]),

            {
              label: t("overwriteConfirm.action.excalidrawPlus.button"),
              category: DEFAULT_CATEGORIES.export,
              icon: exportToPlus,
              predicate: true,
              keywords: ["plus", "export", "save", "backup"],
              perform: () => {
                if (excalidrawAPI) {
                  exportToExcalidrawPlus(
                    excalidrawAPI.getSceneElements(),
                    excalidrawAPI.getAppState(),
                    excalidrawAPI.getFiles(),
                    excalidrawAPI.getName(),
                  );
                }
              },
            },
            {
              label: t("labels.installPWA"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !!pwaEvent,
              perform: () => {
                if (pwaEvent) {
                  pwaEvent.prompt();
                  pwaEvent.userChoice.then(() => {
                    // event cannot be reused, but we'll hopefully
                    // grab new one as the event should be fired again
                    pwaEvent = null;
                  });
                }
              },
            },
          ]}
        />
        {isVisualDebuggerEnabled() && excalidrawAPI && (
          <DebugCanvas
            appState={excalidrawAPI.getAppState()}
            scale={window.devicePixelRatio}
            ref={debugCanvasRef}
          />
        )}
      </Excalidraw>

      {isUmlModalOpen && (
        <UmlClassModal
          initialData={
            editingUmlElement?.customData?.type === "umlClass"
              ? (editingUmlElement.customData as UmlClassData)
              : undefined
          }
          onConfirm={handleUmlModalConfirm}
          onCancel={() => {
            setIsUmlModalOpen(false);
            setEditingUmlElement(null);
          }}
        />
      )}

      {isUmlRelationModalOpen && (
        <UmlRelationModal
          initialData={
            editingUmlRelationElement?.customData?.type === "umlRelation"
              ? {
                  multiplicitySource: (
                    editingUmlRelationElement.customData as UmlRelationData
                  )?.multiplicitySource,
                  multiplicityTarget: (
                    editingUmlRelationElement.customData as UmlRelationData
                  )?.multiplicityTarget,
                }
              : undefined
          }
          onConfirm={handleUmlRelationModalConfirm}
          onCancel={() => {
            setIsUmlRelationModalOpen(false);
            setEditingUmlRelationElement(null);
          }}
        />
      )}
    </div>
  );
};

const ExcalidrawApp = () => {
  const [sessionId, setSessionId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_SESSION_KEY);
    } catch {
      return null;
    }
  });

  const isCloudExportWindow =
    window.location.pathname === "/excalidraw-plus-export";
  if (isCloudExportWindow) {
    return <ExcalidrawPlusIframeExport />;
  }

  const handleLoginSuccess = (newSessionId: string, _username: string) => {
    setSessionId(newSessionId);
  };

  const handleLogout = () => {
    try {
      debouncedEmitDiagramUpdate.cancel();

      // Abandonar la sala activa de Socket.IO
      leaveDiagramRoom();

      // Limpiar claves de sesión de usuario
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      localStorage.removeItem(ACTIVE_USERNAME_KEY);

      // 1. Eliminar clave active_diagram_id de localStorage
      localStorage.removeItem(ACTIVE_DIAGRAM_KEY);

      // 2. Limpiar parámetro ?diagramId= (e ?id= por compatibilidad) de la URL mediante setActiveDiagramId y replaceState
      setActiveDiagramId(null);
      const url = new URL(window.location.href);
      if (url.searchParams.has("diagramId") || url.searchParams.has("id")) {
        url.searchParams.delete("diagramId");
        url.searchParams.delete("id");
        window.history.replaceState({}, "", url.toString());
      }

      // 3. Limpiar claves de caché local de Excalidraw para evitar trazos residuales
      localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS); // "excalidraw"
      localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE); // "excalidraw-state"
    } catch (err) {
      console.warn("[App] Error al limpiar almacenamiento en logout:", err);
    }
    setSessionId(null);
  };

  if (!sessionId) {
    return (
      <TopErrorBoundary>
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </TopErrorBoundary>
    );
  }

  return (
    <TopErrorBoundary>
      <Provider store={appJotaiStore}>
        <ExcalidrawAPIProvider>
          <ExcalidrawWrapper onLogout={handleLogout} />
        </ExcalidrawAPIProvider>
      </Provider>
    </TopErrorBoundary>
  );
};

export default ExcalidrawApp;
