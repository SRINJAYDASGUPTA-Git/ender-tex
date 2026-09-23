"use client";

import {Download, Settings, FileDown} from "lucide-react";

import {Project} from "@/types";
import {Button} from "@/components/ui/button";

interface ProjectToolbarProps {
    project: Project;
}

export function ProjectToolbar({
                                   project,
                               }: ProjectToolbarProps) {
    const exportProject = () => {
        window.location.href =
            `/api/projects/${project.id}/export?includePdf=true`;
    };

    const downloadPdf = () => {
        window.location.href =
            `/api/projects/${project.id}/pdf/download`;
    };

    return (
        <header className="flex h-12 shrink-0 items-center justify-between border-b px-3">
            <div className="flex items-center gap-3">
                <div className="font-medium">
                    {project.name}
                </div>

                <span className="text-xs text-muted-foreground">
                    {project.mainFile}
                </span>
            </div>

            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    title="Download PDF"
                    onClick={downloadPdf}
                >
                    <FileDown className="h-4 w-4" />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    title="Export project"
                    onClick={exportProject}
                >
                    <Download className="h-4 w-4" />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    title="Project settings"
                >
                    <Settings className="h-4 w-4" />
                </Button>

            </div>
        </header>
    );
}