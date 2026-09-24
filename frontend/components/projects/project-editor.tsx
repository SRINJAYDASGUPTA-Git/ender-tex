"use client";

import {useCallback, useEffect, useRef, useState,} from "react";

import {FileText, PanelLeft, Terminal,} from "lucide-react";
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

    const openFile = useCallback(async (path: string) => {
        try {
            setSelectedPath(path);
            setFileLoading(true);
            setFileDirty(false);

            const response = await axios.get<FileResponse>(
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
        }
    };

    const syncTeXPdfToSource = async (
        page: number,
        x: number,
        y: number,
    ) => {
        try {
            const response = await axios.post(
                `/projects/${params.id}/synctex/pdf`,
                {
                    page,
                    x,
                    y,
                },
            );

            const result = response.data;

            await openFile(result.file);

            setSyncTeXSource({
                file: result.file,
                line: result.line,
                column: result.column > 0 ? result.column : 1,
            });
        } catch (error) {
            console.error(
                "SyncTeX PDF → source failed:",
                error,
            );
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

                // Open main file automatically
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
        if (!file.path || !fileDirty || saving) {
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


                if (
                    job.status === "succeeded"
                ) {
                    setPdfVersion(Date.now());
                    setCompileSuccess(true);

                    toast.success(
                        "Project compiled successfully."
                    );

                    break;
                }

                if (
                    job.status === "failed"
                ) {
                    setCompileLog(job.log);
                    setCompileSuccess(false);
                    console.error(
                        "LaTeX compilation failed:",
                        job.log
                    );

                    toast.error(
                        "Compilation failed. Check the compilation log."
                    );

                    break;
                }

                await new Promise((resolve) =>
                    setTimeout(resolve, 1000)
                );
            }
        } catch (error) {
            setCompileSuccess(false);
            console.error(error);

            toast.error(
                "Failed to start compilation."
            );
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

                        {/* Resize handle */}
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

                            <div className="min-h-0 flex-1 overflow-auto p-4">
                                {fileLoading ? (
                                    <div className="text-sm text-muted-foreground">
                                        Loading file...
                                    </div>
                                ) : (
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