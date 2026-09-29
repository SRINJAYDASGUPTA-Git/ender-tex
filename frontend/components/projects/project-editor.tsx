"use client";

import {useCallback, useEffect, useRef, useState, useMemo} from "react";

import {FileText, PanelLeft, Terminal, Image as ImageIcon, FileWarning} from "lucide-react";
import {pdfjs} from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import {useParams} from "next/navigation";
import {toast} from "sonner";

import axios from "@/utils/axiosInstance";
import {FileResponse, Project} from "@/types";

import {ProjectSidebar} from "./project-sidebar";
import {ProjectToolbar} from "./project-toolbar";
import {LatexEditor} from "@/components/projects/latex-editor";
import {PdfPreview} from "@/components/projects/pdf-preview";
import {Button} from "@/components/ui/button";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {CompileLogPanel} from "@/components/projects/compile-log-panel";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

export function ProjectEditor() {
    const params = useParams<{ id: string }>();

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [syncTeXSource, setSyncTeXSource] = useState<{
        file: string;
        line: number;
        column: number;
    } | null>(null);

    const [syncTeXPdf, setSyncTeXPdf] = useState<{
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>(null);

    const [isSyncingSource, setIsSyncingSource] = useState(false);
    const [isSyncingReverse, setIsSyncingReverse] = useState(false);

    const [file, setFile] = useState<FileResponse>({
        path: "",
        content: "",
    });
    const [fileLoading, setFileLoading] = useState(false);

    const [fileDirty, setFileDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pdfVersion, setPdfVersion] = useState(0);
    const [compiling, setCompiling] = useState(false);
    const [compileLog, setCompileLog] = useState("");
    const [compileSuccess, setCompileSuccess] = useState(false);
    const [resizingSidebar, setResizingSidebar] = useState(false);
    const editorContainerRef = useRef<HTMLDivElement>(null);

    // Helper to determine file extension type
    const fileExtension = useMemo(() => {
        if (!selectedPath) return "";
        return selectedPath.split(".").pop()?.toLowerCase() || "";
    }, [selectedPath]);

    const isPdfFile = fileExtension === "pdf";
    const isImageFile = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(fileExtension);

    // Document Statistics Calculation
    const documentStats = useMemo(() => {
        const text = file.content || "";
        const chars = text.length;
        const lines = text ? text.split("\n").length : 0;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        return { words, chars, lines };
    }, [file.content]);

    const openFile = useCallback(async (path: string) => {
        try {
            setSyncTeXSource(null);
            setSelectedPath(path);
            setFileLoading(true);
            setFileDirty(false);

            const ext = path.split(".").pop()?.toLowerCase() || "";
            if (ext === "pdf" || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
                // Don't fetch text content for binary files like PDFs or images into editor state
                setFile({ path, content: "" });
                setFileLoading(false);
                return;
            }

            const response =
                await axios.get<FileResponse>(
                    `/projects/${params.id}/files/${path}`
                );

            setFile(response.data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to open file.");
            setFile({
                path: "",
                content: "",
            });
            setFileDirty(false);
        } finally {
            setFileLoading(false);
        }
    }, [params.id]);

    const getInitialSidebarWidth = () => {
        if (typeof window === "undefined") {
            return 256;
        }

        const storedWidth = localStorage.getItem(
            "endertex-sidebar-width"
        );

        if (!storedWidth) {
            return 256;
        }

        const width = Number(storedWidth);

        if (
            Number.isFinite(width) &&
            width >= 200 &&
            width <= 500
        ) {
            return width;
        }

        return 256;
    };

    const getInitialSidebarCollapsed = () => {
        if (typeof window === "undefined") {
            return false;
        }

        return (
            localStorage.getItem(
                "endertex-sidebar-collapsed"
            ) === "true"
        );
    };

    const [sidebarWidth, setSidebarWidth] = useState(
        getInitialSidebarWidth
    );

    const syncTeXSourceToPdf = async (
        file: string,
        line: number,
        column: number = 1,
    ) => {
        try {
            setIsSyncingSource(true);
            const response = await axios.post(
                `/projects/${params.id}/synctex/source`,
                {
                    file,
                    line,
                    column,
                },
            );

            setSyncTeXPdf(response.data);
        } catch (error) {
            console.error("SyncTeX source → PDF failed:", error);
            toast.error("Could not locate PDF region for this source line.");
        } finally {
            setIsSyncingSource(false);
        }
    };

    const syncTeXPdfToSource = async (
        page: number,
        x: number,
        y: number,
    ) => {
        try {
            setIsSyncingReverse(true);
            const response = await axios.post(
                `/projects/${params.id}/synctex/pdf`,
                {
                    page,
                    x,
                    y,
                },
            );

            const result = response.data;

            if (result.file !== file.path) {
                await openFile(result.file);
            }

            setSyncTeXSource({
                file: result.file,
                line: result.line,
                column:
                    result.column > 0
                        ? result.column
                        : 1,
            });
        } catch (error) {
            console.error(
                "SyncTeX PDF → source failed:",
                error,
            );
            toast.error("Could not locate source line for this PDF region.");
        } finally {
            setIsSyncingReverse(false);
        }
    };

    const [sidebarCollapsed, setSidebarCollapsed] =
        useState(getInitialSidebarCollapsed);

    useEffect(() => {
        const loadProject = async () => {
            try {
                const response = await axios.get<Project>(
                    `/projects/${params.id}`
                );

                const projectData = response.data;
                setProject(projectData);
                await openFile(projectData.mainFile);
            } catch (error) {
                console.error(error);
                toast.error("Failed to load project.");
            } finally {
                setLoading(false);
            }
        };

        loadProject();
    }, [params.id, openFile]);

    useEffect(() => {
        localStorage.setItem(
            "endertex-sidebar-width",
            String(sidebarWidth)
        );
    }, [sidebarWidth]);

    useEffect(() => {
        localStorage.setItem(
            "endertex-sidebar-collapsed",
            String(sidebarCollapsed)
        );
    }, [sidebarCollapsed]);

    useEffect(() => {
        if (!resizingSidebar) {
            return;
        }

        const handleMouseMove = (
            event: MouseEvent
        ) => {
            const container =
                editorContainerRef.current;

            if (!container) {
                return;
            }

            const rect =
                container.getBoundingClientRect();

            const width =
                event.clientX - rect.left;

            setSidebarWidth(
                Math.min(
                    500,
                    Math.max(200, width)
                )
            );
        };

        const handleMouseUp = () => {
            setResizingSidebar(false);
        };

        document.addEventListener(
            "mousemove",
            handleMouseMove
        );

        document.addEventListener(
            "mouseup",
            handleMouseUp
        );

        document.body.style.cursor =
            "col-resize";

        document.body.style.userSelect =
            "none";

        return () => {
            document.removeEventListener(
                "mousemove",
                handleMouseMove
            );

            document.removeEventListener(
                "mouseup",
                handleMouseUp
            );

            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
    }, [resizingSidebar]);

    const saveFile = async () => {
        if (!file.path || !fileDirty || saving || isPdfFile || isImageFile) {
            return;
        }

        try {
            setSaving(true);
            await axios.put(
                `/projects/${params.id}/files/${file.path}`,
                {
                    content: file.content,
                }
            );

            setFileDirty(false);
            toast.success("File saved.");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save file.");
        } finally {
            setSaving(false);
        }
    };

    const compileProject = async () => {
        if (compiling) {
            return;
        }

        try {
            setCompiling(true);
            setCompileSuccess(false);
            setCompileLog("");

            const response = await axios.post<{
                jobId: string;
                projectId: string;
                status: "queued" | "running";
            }>(
                `/projects/${params.id}/compile`
            );

            const {jobId} = response.data;

            while (true) {
                const statusResponse = await axios.get<{
                    jobId: string;
                    projectId: string;
                    status:
                        | "queued"
                        | "running"
                        | "succeeded"
                        | "failed";
                    success: boolean;
                    log: string;
                    pdfAvailable: boolean;
                    startedAt?: string;
                    finishedAt?: string;
                }>(
                    `/projects/${params.id}/compile/${jobId}`
                );

                const job = statusResponse.data;

                if (job.log) {
                    setCompileLog(job.log);
                }

                if (job.status === "succeeded") {
                    setPdfVersion(Date.now());
                    setCompileSuccess(true);
                    toast.success("Project compiled successfully.");
                    break;
                }

                if (job.status === "failed") {
                    setCompileLog(job.log);
                    setCompileSuccess(false);
                    toast.error("Compilation failed. Check the compilation log.");
                    break;
                }

                await new Promise((resolve) =>
                    setTimeout(resolve, 1000)
                );
            }
        } catch (error) {
            setCompileSuccess(false);
            console.error(error);
            toast.error("Failed to start compilation.");
        } finally {
            setCompiling(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">
                    Loading project...
                </p>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">
                    Project not found.
                </p>
            </div>
        );
    }

    return (
        <div
            data-project-editor
            className="flex h-[90vh] flex-col overflow-hidden rounded-lg border"
        >
            <ProjectToolbar project={project} />

            <div
                ref={editorContainerRef}
                className="flex min-h-0 flex-1"
            >
                {!sidebarCollapsed && (
                    <div
                        className="relative h-full shrink-0"
                        style={{
                            width: sidebarWidth,
                        }}
                    >
                        <ProjectSidebar
                            project={project}
                            selectedPath={selectedPath}
                            onFileSelect={openFile}
                            onCollapse={() =>
                                setSidebarCollapsed(true)
                            }
                        />

                        <div
                            className="absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/50"
                            onMouseDown={(event) => {
                                event.preventDefault();
                                setResizingSidebar(true);
                            }}
                        />
                    </div>
                )}
                {sidebarCollapsed &&(
                    <div className="flex h-full w-9 shrink-0 items-start justify-center border-r pt-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Show files"
                            onClick={() =>
                                setSidebarCollapsed(false)
                            }
                        >
                            <PanelLeft className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                <main className="min-w-0 flex-1 overflow-hidden">
                    {selectedPath ? (
                        <div className="flex h-full flex-col">
                            <div className="flex h-9 shrink-0 items-center border-b px-3 text-xs text-muted-foreground">
                                {selectedPath}
                            </div>

                            <div className="min-h-0 flex-1 overflow-auto p-4 flex flex-col">
                                {fileLoading ? (
                                    <div className="text-sm text-muted-foreground">
                                        Loading file...
                                    </div>
                                ) : isPdfFile ? (
                                    /* Prevent PDF text editing */
                                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                                        <FileWarning className="size-10 text-amber-500" />
                                        <div>
                                            <p className="text-sm font-medium">PDF Document Selected</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Compiled PDF files are displayed in the live PDF Preview panel on the right.
                                            </p>
                                        </div>
                                    </div>
                                ) : isImageFile ? (
                                    /* Display images natively instead of raw text */
                                    <div className="flex h-full flex-col items-center justify-center gap-4 bg-muted/20 p-6 rounded-md">
                                        <div className="relative max-h-[70vh] max-w-full overflow-hidden rounded border bg-background shadow-sm">
                                            <img
                                                src={`/api/projects/${params.id}/files/${selectedPath}`}
                                                alt={selectedPath}
                                                className="h-auto max-h-[70vh] w-auto object-contain"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <ImageIcon className="size-4" />
                                            <span>Asset Preview: {selectedPath}</span>
                                        </div>
                                    </div>
                                ) : (
                                    /* Normal Text / LaTeX Editor */
                                    <div className="flex h-full flex-col min-h-0">
                                        <div className="flex-1 min-h-0">
                                            <LatexEditor
                                                projectId={params.id}
                                                collaborative
                                                value={file.content}
                                                fileName={file.path}
                                                compiling={compiling}
                                                onCompile={compileProject}
                                                onSave={saveFile}
                                                dirty={fileDirty}
                                                saving={saving}
                                                isSyncing={isSyncingSource}
                                                onSyncTeX={syncTeXSourceToPdf}
                                                syncTeXTarget={syncTeXSource}
                                                onChange={(value: string) => {
                                                    setFile((currentFile) => ({
                                                        ...currentFile,
                                                        content: value,
                                                    }));
                                                    setFileDirty(true);
                                                }}
                                                onCollaborativeContentChange={(
                                                    content,
                                                    local,
                                                ) => {
                                                    setFile((currentFile) => ({
                                                        ...currentFile,
                                                        content,
                                                    }));
                                                    if (local) {
                                                        setFileDirty(true);
                                                    }
                                                }}
                                            />
                                        </div>

                                        {/* Document Statistics Status Bar */}
                                        <div className="h-7 shrink-0 border-t bg-muted/40 px-3 flex items-center justify-between text-[11px] text-muted-foreground select-none">
                                            <div className="flex items-center gap-4">
                                                <span>Words: <strong className="text-foreground">{documentStats.words}</strong></span>
                                                <span>Characters: <strong className="text-foreground">{documentStats.chars}</strong></span>
                                                <span>Lines: <strong className="text-foreground">{documentStats.lines}</strong></span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="uppercase text-[10px] tracking-wider font-semibold">{fileExtension}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            Select a file to begin editing.
                        </div>
                    )}
                </main>

                <aside className="hidden w-[38%] min-w-105 border-l bg-muted/30 xl:flex xl:flex-col">
                    <Tabs
                        defaultValue="pdf"
                        className="flex h-full min-h-0"
                    >
                        <TabsList
                            variant="line"
                            className="h-9 w-full shrink-0 rounded-none border-b px-2"
                        >
                            <TabsTrigger
                                value="pdf"
                                className="px-3 text-xs"
                            >
                                <FileText className="size-3.5" />
                                PDF
                            </TabsTrigger>

                            <TabsTrigger
                                value="logs"
                                className="px-3 text-xs"
                            >
                                <Terminal className="size-3.5" />
                                Logs
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent
                            value="pdf"
                            className="min-h-0 flex-1"
                        >
                            <PdfPreview
                                projectId={params.id}
                                version={pdfVersion}
                                syncTeXTarget={syncTeXPdf}
                                onSyncTeX={syncTeXPdfToSource}
                                isSyncing={isSyncingReverse}
                            />
                        </TabsContent>

                        <TabsContent
                            value="logs"
                            className="min-h-0 flex-1"
                        >
                            <CompileLogPanel
                                log={compileLog}
                                compiling={compiling}
                                success={compileSuccess}
                            />
                        </TabsContent>
                    </Tabs>
                </aside>
            </div>
        </div>
    );
}