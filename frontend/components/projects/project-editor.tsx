"use client";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import {
    PanelLeft,
    PanelLeftClose,
} from "lucide-react";
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

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

export function ProjectEditor() {
    const params = useParams<{ id: string }>();

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [file, setFile] = useState<FileResponse>({
        path: "",
        content: "",
    });
    const [fileLoading, setFileLoading] = useState(false);

    const [fileDirty, setFileDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pdfVersion, setPdfVersion] = useState(0);
    const [compiling, setCompiling] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(256);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
        const storedWidth = localStorage.getItem(
            "endertex-sidebar-width"
        );

        const storedCollapsed = localStorage.getItem(
            "endertex-sidebar-collapsed"
        );

        if (storedWidth) {
            const width = Number(storedWidth);

            if (
                Number.isFinite(width) &&
                width >= 200 &&
                width <= 500
            ) {
                setSidebarWidth(width);
            }
        }

        if (storedCollapsed !== null) {
            setSidebarCollapsed(
                storedCollapsed === "true"
            );
        }
    }, []);

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

                if (
                    job.status === "succeeded"
                ) {
                    setPdfVersion(Date.now());

                    toast.success(
                        "Project compiled successfully."
                    );

                    break;
                }

                if (
                    job.status === "failed"
                ) {
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
            className="flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-lg border"
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

                <aside className="hidden w-[38%] min-w-105 border-l bg-muted/30 xl:block">
                    <PdfPreview
                        projectId={params.id}
                        version={pdfVersion}
                    />
                </aside>
            </div>
        </div>
    );
}