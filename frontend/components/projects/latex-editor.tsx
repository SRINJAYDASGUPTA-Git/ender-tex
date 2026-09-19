"use client";

import { useEffect, useRef, useState } from "react";
import Editor, {
    BeforeMount,
    Monaco,
    OnMount,
} from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import * as Y from "yjs";
import { registerLaTeXLanguage } from "monaco-latex";
import { Play } from "lucide-react";

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
    dirty?: boolean;
    saving?: boolean;
    readOnly?: boolean;
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
                                projectId,
                                onCollaborativeContentChange,
                                collaborative = false,
                                dirty = false,
                                saving = false,
                                readOnly = false,
                            }: LatexEditorProps) {
    const { user } = useUser();

    const editorRef =
        useRef<editor.IStandaloneCodeEditor | null>(null);

    const collaborationSessionRef =
        useRef<CollaborationSession | null>(null);

    const saveRef = useRef(onSave);
    const compileRef = useRef(onCompile);
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

    /*
     * Keep callback refs current.
     */
    useEffect(() => {
        saveRef.current = onSave;
    }, [onSave]);

    useEffect(() => {
        compileRef.current = onCompile;
    }, [onCompile]);

    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        collaborativeChangeRef.current =
            onCollaborativeContentChange;
    }, [onCollaborativeContentChange]);

    /*
     * Connect to Yjs collaboration.
     */
    useEffect(() => {
        if (
            !collaborative ||
            !projectId ||
            !fileName ||
            !editorInstance ||
            !user
        ) {
            return;
        }

        let disposed = false;

        let cleanup: (() => void) | undefined;

        const connect = async () => {
            try {
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
                        }
                    );

                if (disposed) {
                    session.destroy();
                    return;
                }

                /*
                 * Keep the session in a ref.
                 *
                 * We don't want the entire component to rerender
                 * every time the session object changes.
                 */
                collaborationSessionRef.current = session;

                cleanup = () => {
                    session.destroy();
                };

                /*
                 * Publish our initial Monaco selection.
                 *
                 * y-monaco normally updates awareness when the
                 * selection changes. This additionally makes our
                 * current position available immediately after
                 * connecting.
                 */
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

                /*
                 * Build the active collaborator list from
                 * Yjs awareness.
                 */
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

                    /*
                     * A single user may have multiple tabs open.
                     * Show one avatar per user.
                     */
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

                /*
                 * Remove the awareness listener when this
                 * particular session is destroyed.
                 */
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
                    setCollaborationStatus(
                        "disconnected"
                    );
                }
            }
        };

        void connect();

        return () => {
            disposed = true;

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
    ]);

    /*
     * Jump the Monaco editor to another collaborator.
     */
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

        /*
         * Make sure the relative positions belong
         * to our collaborative text.
         */
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

        /*
         * Convert Yjs character offsets to Monaco
         * positions.
         */
        const anchorMonacoPosition =
            model.getPositionAt(
                anchorPosition.index
            );

        const headMonacoPosition =
            model.getPositionAt(
                headPosition.index
            );

        /*
         * Reproduce their selection.
         */
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

        /*
         * Move our viewport to their cursor.
         */
        targetEditor.revealPositionInCenter(
            headMonacoPosition,
            1
        );

        /*
         * Give Monaco focus after jumping.
         */
        targetEditor.focus();
    };

    const handleBeforeMount: BeforeMount = (
        monaco
    ) => {
        configureLatex(monaco);
    };

    /*
     * Monaco mount.
     */
    const handleMount: OnMount = (
        instance
    ) => {
        editorRef.current = instance;
        setEditorInstance(instance);

        /*
         * Use LF consistently across machines.
         */
        const model = instance.getModel();

        if (model) {
            model.setEOL(0);
        }

        /*
         * Keyboard shortcuts.
         */
        instance.onKeyDown((event) => {
            const { browserEvent } = event;

            const modifier =
                browserEvent.ctrlKey ||
                browserEvent.metaKey;

            if (!modifier) {
                return;
            }

            /*
             * Ctrl/Cmd + S
             */
            if (
                browserEvent.key.toLowerCase() ===
                "s"
            ) {
                browserEvent.preventDefault();
                browserEvent.stopPropagation();

                saveRef.current();

                return;
            }

            /*
             * Ctrl/Cmd + Enter
             */
            if (
                browserEvent.key === "Enter"
            ) {
                browserEvent.preventDefault();
                browserEvent.stopPropagation();

                compileRef.current();
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

    /*
     * Generate initials for collaborator avatars.
     */
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

                    {/*
                     * Collaborator avatars.
                     */}
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
                        disabled={readOnly}
                        variant="outline"
                    >
                        <Play className="mr-1.5 h-3.5 w-3.5" />

                        Compile

                        <Kbd
                            data-icon="inline-end"
                            className="translate-x-0.5"
                        >
                            Ctrl + ⏎
                        </Kbd>
                    </Button>
                </div>
            </div>

            <div className="min-h-0 flex-1">
                <Editor
                    height="100%"
                    language="latex"
                    theme="vs-dark"

                    /*
                     * Yjs owns Monaco in collaborative mode.
                     */
                    value={
                        collaborative
                            ? undefined
                            : value
                    }

                    beforeMount={handleBeforeMount}
                    onMount={handleMount}

                    /*
                     * React owns the editor in normal mode.
                     *
                     * Yjs/MonacoBinding owns it in collaborative
                     * mode.
                     */
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