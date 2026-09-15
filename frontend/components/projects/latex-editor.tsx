"use client";

import {useEffect, useRef} from "react";
import Editor, {BeforeMount, Monaco, OnMount} from "@monaco-editor/react";
import type {editor} from "monaco-editor";
import {registerLaTeXLanguage} from "monaco-latex"
import {Play} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Kbd} from "@/components/ui/kbd";
import {BsFloppy} from "react-icons/bs";

interface LatexEditorProps {
    value: string;
    onChange: (value: string) => void;
    onSave: () => void;
    onCompile: () => void;
    fileName: string;
    dirty?: boolean;
    saving?: boolean;
    readOnly?: boolean;
}

const configureLatex = (monaco: Monaco) => {
    registerLaTeXLanguage(monaco)
};

export function LatexEditor({
                                value,
                                onChange,
                                fileName,
                                onCompile,
                                onSave,
                                dirty = false,
                                saving = false,
                                readOnly = false,
                            }: LatexEditorProps) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

    const handleBeforeMount: BeforeMount = (monaco) => {
        configureLatex(monaco);
    };
    const saveRef = useRef(onSave);
    const compileRef = useRef(onCompile);

    useEffect(() => {
        saveRef.current = onSave;
    }, [onSave]);

    useEffect(() => {
        compileRef.current = onCompile;
    }, [onCompile]);

    const handleMount: OnMount = (editorInstance) => {
        editorRef.current = editorInstance;

        editorInstance.onKeyDown((event) => {
            const { browserEvent } = event;

            const modifier =
                browserEvent.ctrlKey ||
                browserEvent.metaKey;

            if (!modifier) {
                return;
            }

            if (browserEvent.key.toLowerCase() === "s") {
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

        editorInstance.focus();
    };

    return (
        <div className="flex h-full w-full flex-col">
            <div className="flex h-9 shrink-0 items-center justify-between border-b px-2 mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        {fileName}
                    </span>

                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        LaTeX
                    </span>

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
                        <BsFloppy className="mr-1.5 h-3.5 w-3.5"/>
                        Save {" "}
                        <Kbd data-icon="inline-end" className="translate-x-0.5">
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
                        <Play className="mr-1.5 h-3.5 w-3.5"/>
                        Compile {" "}
                        <Kbd data-icon="inline-end" className="translate-x-0.5">
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
                    value={value}
                    beforeMount={handleBeforeMount}
                    onMount={handleMount}
                    onChange={(nextValue) =>
                        onChange(nextValue ?? "")
                    }
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