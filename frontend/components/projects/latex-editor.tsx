"use client";

import {useEffect, useRef, useState} from "react";
import Editor, {
    BeforeMount,
    Monaco,
    OnMount,
} from "@monaco-editor/react";
import type {editor} from "monaco-editor";
import {registerLaTeXLanguage} from "monaco-latex";
import {Play} from "lucide-react";

import {
    connectCollaborativeEditor,
    CollaborationStatus,
} from "@/lib/collaboration";

import {Button} from "@/components/ui/button";
import {Kbd} from "@/components/ui/kbd";
import {BsFloppy} from "react-icons/bs";
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
    const { user } = useUser(); // <-- Get current user
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const saveRef = useRef(onSave);
    const compileRef = useRef(onCompile);
    const valueRef = useRef(value);
    const collaborativeChangeRef = useRef(onCollaborativeContentChange);

    const [editorInstance, setEditorInstance] = useState<editor.IStandaloneCodeEditor | null>(null);
    const [collaborationStatus, setCollaborationStatus] = useState<CollaborationStatus>("disconnected");

    // <-- NEW: State to track other active users
    const [activeUsers, setActiveUsers] = useState<{ id: string; name: string; color: string }[]>([]);

    useEffect(() => { saveRef.current = onSave; }, [onSave]);
    useEffect(() => { compileRef.current = onCompile; }, [onCompile]);
    useEffect(() => { valueRef.current = value; }, [value]);
    useEffect(() => { collaborativeChangeRef.current = onCollaborativeContentChange; }, [onCollaborativeContentChange]);

    useEffect(() => {
        if (!collaborative || !projectId || !fileName || !editorInstance || !user) return;

        let disposed = false;
        let cleanup: (() => void) | undefined;
        let sessionAwareness: any = null;

        const connect = async () => {
            try {
                setCollaborationStatus("connecting");
                const session = await connectCollaborativeEditor(
                    projectId,
                    fileName,
                    editorInstance,
                    setCollaborationStatus,
                    valueRef.current,
                    (content, local) => {
                        collaborativeChangeRef.current?.(content, local);
                    },
                    { id: user.id, name: user.name } // <-- Pass current user
                );

                if (disposed) {
                    session.destroy();
                    return;
                }

                cleanup = session.destroy;
                sessionAwareness = session.awareness;

                // --- NEW: Listen to presence changes ---
                const updatePresence = () => {
                    const states = Array.from(session.awareness.getStates().values()) as any[];
                    // Extract users, filter out ourselves
                    const peers = states
                        .map((state) => state.user)
                        .filter((u) => u && u.id !== user.id);

                    // Deduplicate in case a user has multiple tabs open
                    const uniquePeers = Array.from(new Map(peers.map((p) => [p.id, p])).values()) as any;
                    setActiveUsers(uniquePeers);
                };

                session.awareness.on("change", updatePresence);
                updatePresence(); // Initial check
                // ---------------------------------------

            } catch (error) {
                console.error("Collaboration connection failed:", error);
                if (!disposed) setCollaborationStatus("disconnected");
            }
        };

        void connect();

        return () => {
            disposed = true;
            cleanup?.();
            cleanup = undefined;
            setCollaborationStatus("disconnected");
            setActiveUsers([]);
        };
    }, [collaborative, projectId, fileName, editorInstance, user]);
    const handleBeforeMount: BeforeMount = (monaco) => {
        configureLatex(monaco);
    };

    /*
     * Monaco keyboard shortcuts.
     */
    const handleMount: OnMount = (instance) => {
        editorRef.current = instance;
        setEditorInstance(instance);

        /*
         * Use LF consistently across machines.
         */
        const model = instance.getModel();

        if (model) {
            model.setEOL(
                0, // EndOfLineSequence.LF
            );
        }

        instance.onKeyDown((event) => {
            const {browserEvent} = event;

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

            if (browserEvent.key === "Enter") {
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
            : collaborationStatus === "connecting"
                ? "Connecting..."
                : "Offline";

    return (
        <div className="flex h-full w-full flex-col">
            <div className="mb-4 flex h-9 shrink-0 items-center justify-between border-b px-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{fileName}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        LaTeX
                    </span>
                    {collaborative && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {collaborationLabel}
                        </span>
                    )}

                    {/* --- NEW: Active User Avatars --- */}
                    {activeUsers.length > 0 && (
                        <div className="flex -space-x-1 ml-2">
                            {activeUsers.map((u) => (
                                <div
                                    key={u.id}
                                    title={u.name}
                                    className="flex size-5 items-center justify-center rounded-full border border-background text-[9px] font-bold text-white shadow-sm ring-1 ring-border"
                                    style={{ backgroundColor: u.color }}
                                >
                                    {u.name.substring(0, 2).toUpperCase()}
                                </div>
                            ))}
                        </div>
                    )}
                    {/* -------------------------------- */}

                    {dirty && <span className="h-2 w-2 rounded-full bg-foreground" title="Unsaved changes" />}
                    {!dirty && !saving && <span className="text-[10px] text-muted-foreground">Saved</span>}
                    {saving && <span className="text-[10px] text-muted-foreground">Saving...</span>}
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
                        Save{" "}
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
                        Compile{" "}
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
                     * In collaborative mode Yjs owns the Monaco
                     * model through MonacoBinding.
                     *
                     * In normal mode React owns the value.
                     */
                    value={
                        collaborative
                            ? undefined
                            : value
                    }

                    beforeMount={handleBeforeMount}
                    onMount={handleMount}

                    /*
                     * IMPORTANT:
                     *
                     * Do not send Monaco changes into React while
                     * collaboration is active.
                     *
                     * MonacoBinding handles:
                     *
                     * Monaco ↔ Y.Text
                     *
                     * The old onChange → setState path would cause
                     * React and Yjs to compete over the editor model,
                     * which can cause cursor jumps.
                     */
                    onChange={(nextValue) => {
                        if (collaborative) {
                            return;
                        }

                        onChange(nextValue ?? "");
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

                        renderWhitespace: "selection",

                        smoothScrolling: true,

                        cursorSmoothCaretAnimation: "on",

                        contextmenu: true,
                    }}
                />
            </div>
        </div>
    );
}