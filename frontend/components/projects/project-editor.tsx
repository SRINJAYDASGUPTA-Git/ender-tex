"use client";

import {useCallback, useEffect, useState} from "react";
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

            const response = await axios.post(
                `/projects/${params.id}/compile`
            );

            if (!response.data.success) {
                toast.error("Compilation failed.");
                return;
            }

            setPdfVersion(Date.now());
            toast.success("Project compiled successfully.");
        } catch (error) {
            console.error(error);
            toast.error("Compilation failed.");
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
        <div className="flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-lg border">
            <ProjectToolbar project={project} />

            <div className="flex min-h-0 flex-1">
                <ProjectSidebar
                    project={project}
                    selectedPath={selectedPath}
                    onFileSelect={openFile}
                />

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

                <aside className="hidden w-[40%] border-l bg-muted/30 xl:block">
                    <PdfPreview
                        projectId={params.id}
                        version={pdfVersion}
                    />
                </aside>
            </div>
        </div>
    );
}