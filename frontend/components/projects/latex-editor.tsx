"use client";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import Editor, {
    BeforeMount,
    Monaco,
    OnMount,
} from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import * as Y from "yjs";
import { registerLaTeXLanguage } from "monaco-latex";
import { Play, ArrowDown, ArrowUp, Loader2 } from "lucide-react";

import {
    connectCollaborativeEditor,
    CollaborationStatus,
} from "@/lib/collaboration";

import type { CollaborationSession } from "@/lib/collaboration";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
    Avatar,
    AvatarFallback,
    AvatarGroup,
} from "@/components/ui/avatar";

import { BsFloppy } from "react-icons/bs";
import { useUser } from "@/providers/UserContext";

interface LatexEditorProps {
    value: string;
    onChange: (value: string) => void;
    onSave: () => void;
    onCompile: () => void;
    fileName: string;
    projectId?: string;
    collaborative?: boolean;
    onCollaborativeContentChange?: (
        content: string,
        local: boolean
    ) => void;
    onSyncTeX?: (
        file: string,
        line: number,
        column: number,
    ) => void;
    syncTeXTarget?: {
        file: string;
        line: number;
        column: number;
    } | null;
    compiling?: boolean;
    dirty?: boolean;
    saving?: boolean;
    readOnly?: boolean;
    isSyncing?: boolean;
    onTriggerSyncToPdf?: () => void;
}

interface ActiveUser {
    clientId: number;
    id: string;
    name: string;
    color: string;
}

const configureLatex = (monaco: Monaco) => {
    registerLaTeXLanguage(monaco);
};

export function LatexEditor({
                                value,
                                onChange,
                                fileName,
                                onCompile,
                                onSave,
                                onSyncTeX,
                                projectId,
                                onCollaborativeContentChange,
                                syncTeXTarget,
                                compiling = false,
                                collaborative = false,
                                dirty = false,
                                saving = false,
                                readOnly = false,
                                isSyncing = false,
                                onTriggerSyncToPdf,
                            }: LatexEditorProps) {
    const { user } = useUser();

    const editorRef =
        useRef<editor.IStandaloneCodeEditor | null>(null);

    const collaborationSessionRef =
        useRef<CollaborationSession | null>(null);

    const pendingSyncTeXTargetRef =
        useRef<{
            file: string;
            line: number;
            column: number;
        } | null>(null);

    const collaborationReadyRef =
        useRef(false);

    const saveRef = useRef(onSave);
    const compileRef = useRef(onCompile);
    const syncTeXRef = useRef(onSyncTeX);
    const fileNameRef = useRef(fileName);
    const valueRef = useRef(value);
    const collaborativeChangeRef =
        useRef(onCollaborativeContentChange);

    const [
        editorInstance,
        setEditorInstance,
    ] = useState<editor.IStandaloneCodeEditor | null>(null);

    const [
        collaborationStatus,
        setCollaborationStatus,
    ] = useState<CollaborationStatus>("disconnected");

    const [activeUsers, setActiveUsers] =
        useState<ActiveUser[]>([]);

    const compilingRef = useRef(compiling);

    useEffect(() => {
        saveRef.current = onSave;
    }, [onSave]);

    useEffect(() => {
        compileRef.current = onCompile;
    }, [onCompile]);

    useEffect(() => {
        syncTeXRef.current = onSyncTeX;
    }, [onSyncTeX]);

    useEffect(() => {
        fileNameRef.current = fileName;
    }, [fileName]);

    useEffect(() => {
        compilingRef.current = compiling;
    }, [compiling]);

    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        collaborativeChangeRef.current =
            onCollaborativeContentChange;
    }, [onCollaborativeContentChange]);

    const normalizePath = (p: string) =>
        p.replace(/^\.\//, "").replace(/^\/+/, "");

    const applyPendingSyncTeXTarget =
        useCallback(() => {
            const target =
                pendingSyncTeXTargetRef.current;

            const instance =
                editorRef.current;

            if (!instance || !target) {
                return;
            }

            if (
                normalizePath(target.file) !==
                normalizePath(fileNameRef.current)
            ) {
                return;
            }

            const model =
                instance.getModel();

            if (!model) {
                return;
            }

            const lineNumber =
                Math.min(
                    Math.max(target.line, 1),
                    model.getLineCount(),
                );

            const column =
                Math.min(
                    Math.max(target.column, 1),
                    model.getLineMaxColumn(
                        lineNumber
                    ),
                );

            const position = {
                lineNumber,
                column,
            };

            instance.setPosition(
                position
            );

            instance.revealPositionInCenter(
                position,
                1
            );

            instance.focus();

            pendingSyncTeXTargetRef.current =
                null;
        }, []);

    useEffect(() => {
        if (!syncTeXTarget) {
            pendingSyncTeXTargetRef.current =
                null;

            return;
        }

        pendingSyncTeXTargetRef.current =
            syncTeXTarget;

        applyPendingSyncTeXTarget();
    }, [
        syncTeXTarget,
        fileName,
        editorInstance,
        applyPendingSyncTeXTarget,
    ]);

    useEffect(() => {
        if (
            !collaborative ||
            !projectId ||
            !fileName ||
            !editorInstance ||
            !user
        ) {
            collaborationReadyRef.current = true;
            applyPendingSyncTeXTarget();
            return;
        }

        let disposed = false;
        let cleanup: (() => void) | undefined;

        const connect = async () => {
            try {
                collaborationReadyRef.current = false;
                setCollaborationStatus("connecting");

                const session =
                    await connectCollaborativeEditor(
                        projectId,
                        fileName,
                        editorInstance,
                        setCollaborationStatus,
                        valueRef.current,
                        (content, local) => {
                            collaborativeChangeRef.current?.(
                                content,
                                local
                            );
                        },
                        {
                            id: user.id,
                            name: user.name,
                        },
                        () => {
                            collaborationReadyRef.current = true;
                            applyPendingSyncTeXTarget();
                        }
                    );

                if (disposed) {
                    session.destroy();
                    return;
                }

                collaborationSessionRef.current = session;
                collaborationReadyRef.current = true;
                applyPendingSyncTeXTarget();

                cleanup = () => {
                    session.destroy();
                };

                const model = editorInstance.getModel();
                const selection = editorInstance.getSelection();

                if (model && selection) {
                    const anchorOffset = model.getOffsetAt({
                        lineNumber:
                        selection.selectionStartLineNumber,
                        column:
                        selection.selectionStartColumn,
                    });

                    const headOffset = model.getOffsetAt({
                        lineNumber:
                        selection.positionLineNumber,
                        column:
                        selection.positionColumn,
                    });

                    session.awareness.setLocalStateField(
                        "selection",
                        {
                            anchor:
                                Y.createRelativePositionFromTypeIndex(
                                    session.text,
                                    anchorOffset
                                ),
                            head:
                                Y.createRelativePositionFromTypeIndex(
                                    session.text,
                                    headOffset
                                ),
                        }
                    );
                }

                const updatePresence = () => {
                    const states =
                        Array.from(
                            session.awareness
                                .getStates()
                                .entries()
                        ) as [
                            number,
                            any
                        ][];

                    const peers = states
                        .map(([clientId, state]) => {
                            const collaborator =
                                state?.user;

                            if (!collaborator) {
                                return null;
                            }

                            if (
                                collaborator.id ===
                                user.id
                            ) {
                                return null;
                            }

                            return {
                                clientId,
                                id: collaborator.id,
                                name:
                                    collaborator.name ??
                                    "User",
                                color:
                                    collaborator.color ??
                                    "rgb(59, 130, 246)",
                            };
                        })
                        .filter(
                            (
                                peer
                            ): peer is ActiveUser =>
                                peer !== null
                        );

                    const uniquePeers =
                        Array.from(
                            new Map(
                                peers.map((peer) => [
                                    peer.id,
                                    peer,
                                ])
                            ).values()
                        );

                    setActiveUsers(uniquePeers);
                };

                session.awareness.on(
                    "change",
                    updatePresence
                );

                updatePresence();

                const originalCleanup = cleanup;

                cleanup = () => {
                    session.awareness.off(
                        "change",
                        updatePresence
                    );

                    originalCleanup?.();

                    if (
                        collaborationSessionRef.current ===
                        session
                    ) {
                        collaborationSessionRef.current =
                            null;
                    }
                };
            } catch (error) {
                console.error(
                    "Collaboration connection failed:",
                    error
                );

                if (!disposed) {
                    collaborationReadyRef.current = true;
                    setCollaborationStatus(
                        "disconnected"
                    );
                }
            }
        };

        void connect();

        return () => {
            disposed = true;
            collaborationReadyRef.current = false;

            cleanup?.();
            cleanup = undefined;

            collaborationSessionRef.current = null;
            setCollaborationStatus(
                "disconnected"
            );
            setActiveUsers([]);
        };
    }, [
        collaborative,
        projectId,
        fileName,
        editorInstance,
        user,
        applyPendingSyncTeXTarget
    ]);

    const jumpToCollaborator = (
        clientId: number
    ) => {
        const session =
            collaborationSessionRef.current;

        const targetEditor =
            editorRef.current;

        if (!session || !targetEditor) {
            return;
        }

        const state =
            session.awareness
                .getStates()
                .get(clientId);

        if (!state?.selection) {
            return;
        }

        const {
            anchor,
            head,
        } = state.selection;

        const anchorPosition =
            Y.createAbsolutePositionFromRelativePosition(
                anchor,
                session.doc
            );

        const headPosition =
            Y.createAbsolutePositionFromRelativePosition(
                head,
                session.doc
            );

        if (
            !anchorPosition ||
            !headPosition
        ) {
            return;
        }

        if (
            anchorPosition.type !== session.text ||
            headPosition.type !== session.text
        ) {
            return;
        }

        const model =
            targetEditor.getModel();

        if (!model) {
            return;
        }

        const anchorMonacoPosition =
            model.getPositionAt(
                anchorPosition.index
            );

        const headMonacoPosition =
            model.getPositionAt(
                headPosition.index
            );

        targetEditor.setSelection({
            startLineNumber:
            anchorMonacoPosition.lineNumber,
            startColumn:
            anchorMonacoPosition.column,

            endLineNumber:
            headMonacoPosition.lineNumber,
            endColumn:
            headMonacoPosition.column,
        });

        targetEditor.revealPositionInCenter(
            headMonacoPosition,
            1
        );

        targetEditor.focus();
    };

    const handleBeforeMount: BeforeMount = (
        monaco
    ) => {
        configureLatex(monaco);
    };

    const handleMount: OnMount = (
        instance
    ) => {
        editorRef.current = instance;
        setEditorInstance(instance);

        const model = instance.getModel();

        if (model) {
            model.setEOL(0);
        }

        instance.onMouseDown((event) => {
            const browserEvent = event.event;

            if (browserEvent.detail !== 2) {
                return;
            }

            const position = event.target.position;

            if (!position) {
                return;
            }

            browserEvent.preventDefault();
            browserEvent.stopPropagation();

            syncTeXRef.current?.(
                fileNameRef.current,
                position.lineNumber,
                position.column,
            );
        });

        instance.onKeyDown((event) => {
            const { browserEvent } = event;
            const modifier =
                browserEvent.ctrlKey ||
                browserEvent.metaKey;

            if (!modifier) {
                return;
            }

            if (
                browserEvent.key.toLowerCase() ===
                "s"
            ) {
                browserEvent.preventDefault();
                browserEvent.stopPropagation();
                saveRef.current();
                return;
            }

            if (
                browserEvent.key === "Enter" || browserEvent.key === "Return"
            ) {
                browserEvent.preventDefault();
                browserEvent.stopPropagation();

                if (!compilingRef.current) {
                    compileRef.current();
                }
            }
        });

        instance.focus();
    };

    const collaborationLabel =
        collaborationStatus === "connected"
            ? "Connected"
            : collaborationStatus ===
            "connecting"
                ? "Connecting..."
                : "Offline";

    const getInitials = (
        name: string
    ) => {
        const parts =
            name.trim().split(/\s+/);

        if (parts.length === 1) {
            return parts[0]
                .substring(0, 2)
                .toUpperCase();
        }

        return (
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();
    };

    return (
        <div className="flex h-full w-full flex-col">
            <div className="mb-4 flex h-9 shrink-0 items-center justify-between border-b px-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        {fileName}
                    </span>

                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        LaTeX
                    </span>

                    {collaborative && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {collaborationLabel}
                        </span>
                    )}

                    {activeUsers.length > 0 && (
                        <AvatarGroup className="ml-1">
                            {activeUsers.map(
                                (collaborator) => (
                                    <button
                                        key={
                                            collaborator.clientId
                                        }
                                        type="button"
                                        title={`Jump to ${collaborator.name}`}
                                        aria-label={`Jump to ${collaborator.name}`}
                                        onClick={() =>
                                            jumpToCollaborator(
                                                collaborator.clientId
                                            )
                                        }
                                        className="cursor-pointer rounded-full outline-none transition-transform hover:z-10 hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <Avatar
                                            size="sm"
                                            className="ring-2 ring-background"
                                            style={{
                                                backgroundColor:
                                                collaborator.color,
                                            }}
                                        >
                                            <AvatarFallback
                                                className="font-semibold text-white"
                                                style={{
                                                    backgroundColor:
                                                    collaborator.color,
                                                }}
                                            >
                                                {getInitials(
                                                    collaborator.name
                                                )}
                                            </AvatarFallback>
                                        </Avatar>
                                    </button>
                                )
                            )}
                        </AvatarGroup>
                    )}

                    {dirty && (
                        <span
                            className="h-2 w-2 rounded-full bg-foreground"
                            title="Unsaved changes"
                        />
                    )}

                    {!dirty &&
                        !saving && (
                            <span className="text-[10px] text-muted-foreground">
                                Saved
                            </span>
                        )}

                    {saving && (
                        <span className="text-[10px] text-muted-foreground">
                            Saving...
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {/* Overleaf-Style Sync Navigation Buttons */}
                    <div className="flex items-center gap-1 border-x px-2 mx-1 text-zinc-400">
                        {isSyncing ? (
                            <Loader2 className="size-4 animate-spin text-indigo-400" />
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const pos = editorRef.current?.getPosition();
                                        if (pos) {
                                            onSyncTeX?.(fileNameRef.current, pos.lineNumber, pos.column);
                                        }
                                    }}
                                    title="Sync cursor position to PDF (Source → PDF)"
                                    className="p-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded transition-colors"
                                >
                                    <ArrowDown className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onTriggerSyncToPdf?.();
                                    }}
                                    title="Sync preview selection to Editor (PDF → Source)"
                                    className="p-1.5 hover:bg-zinc-800 hover:text-zinc-100 rounded transition-colors"
                                >
                                    <ArrowUp className="size-4" />
                                </button>
                            </>
                        )}
                    </div>

                    <Button
                        size="sm"
                        className="h-7 p-4"
                        onClick={onSave}
                        disabled={readOnly}
                        variant="outline"
                    >
                        <BsFloppy className="mr-1.5 h-3.5 w-3.5" />
                        Save
                        <Kbd
                            data-icon="inline-end"
                            className="translate-x-0.5"
                        >
                            Ctrl + S
                        </Kbd>
                    </Button>

                    <Button
                        size="sm"
                        className="h-7 p-4"
                        onClick={onCompile}
                        disabled={readOnly || compiling}
                        variant="outline"
                    >
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        {compiling ? "Compiling..." : "Compile"}
                        {!compiling && (
                            <Kbd
                                data-icon="inline-end"
                                className="translate-x-0.5"
                            >
                                Ctrl + ⏎
                            </Kbd>
                        )}
                    </Button>
                </div>
            </div>

            <div className="min-h-0 flex-1">
                <Editor
                    height="100%"
                    language="latex"
                    theme="vs-dark"
                    value={
                        collaborative
                            ? undefined
                            : value
                    }
                    beforeMount={handleBeforeMount}
                    onMount={handleMount}
                    onChange={(nextValue) => {
                        if (collaborative) {
                            return;
                        }
                        onChange(
                            nextValue ?? ""
                        );
                    }}
                    options={{
                        automaticLayout: true,
                        minimap: {
                            enabled: false,
                        },
                        fontSize: 14,
                        lineNumbers: "on",
                        wordWrap: "on",
                        padding: {
                            top: 12,
                            bottom: 12,
                        },
                        scrollBeyondLastLine: false,
                        tabSize: 4,
                        insertSpaces: true,
                        readOnly,
                        renderWhitespace:
                            "selection",
                        smoothScrolling: true,
                        cursorSmoothCaretAnimation:
                            "on",
                        contextmenu: true,
                    }}
                />
            </div>
        </div>
    );
}