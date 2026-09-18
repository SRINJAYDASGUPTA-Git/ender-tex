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
    const editorRef =
        useRef<editor.IStandaloneCodeEditor | null>(null);

    const saveRef = useRef(onSave);
    const compileRef = useRef(onCompile);
    const valueRef = useRef(value);
    const collaborativeChangeRef =
        useRef(onCollaborativeContentChange);

    const [editorInstance, setEditorInstance] =
        useState<editor.IStandaloneCodeEditor | null>(null);

    const [
        collaborationStatus,
        setCollaborationStatus,
    ] = useState<CollaborationStatus>("disconnected");

    /*
     * Keep the latest callbacks available to Monaco's
     * keyboard handlers without recreating the handlers.
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
     * Establish collaboration only after Monaco has mounted.
     *
     * connectCollaborativeEditor is responsible for loading
     * the browser-only collaboration packages.
     */
    useEffect(() => {
        if (
            !collaborative ||
            !projectId ||
            !fileName ||
            !editorInstance
        ) {
            return;
        }

        let disposed = false;
        let cleanup:
            | (() => void)
            | undefined;

        const connect = async () => {
            try {
                setCollaborationStatus(
                    "connecting",
                );

                const session =
                    await connectCollaborativeEditor(
                        projectId,
                        fileName,
                        editorInstance,
                        setCollaborationStatus,

                        /*
                         * Important:
                         * use the current value but DO NOT put
                         * `value` into this effect's dependency list.
                         *
                         * Otherwise every keystroke would recreate
                         * the collaboration session.
                         */
                        valueRef.current,

                        (content, local) => {
                            collaborativeChangeRef
                                .current
                                ?.(
                                    content,
                                    local,
                                );
                        },
                    );

                if (disposed) {
                    session.destroy();
                    return;
                }

                cleanup =
                    session.destroy;
            } catch (error) {
                console.error(
                    "Collaboration connection failed:",
                    error,
                );

                if (!disposed) {
                    setCollaborationStatus(
                        "disconnected",
                    );
                }
            }
        };

        void connect();

        return () => {
            disposed = true;

            cleanup?.();
            cleanup = undefined;

            setCollaborationStatus(
                "disconnected",
            );
        };
    }, [
        collaborative,
        projectId,
        fileName,
        editorInstance,
    ]);

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

                    {dirty && (
                        <span
                            className="h-2 w-2 rounded-full bg-foreground"
                            title="Unsaved changes"
                        />
                    )}

                    {!dirty && !saving && (
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