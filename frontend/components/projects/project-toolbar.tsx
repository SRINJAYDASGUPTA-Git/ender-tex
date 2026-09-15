"use client";

import { Play, Settings } from "lucide-react";

import { Project } from "@/types";
import { Button } from "@/components/ui/button";

interface ProjectToolbarProps {
    project: Project;
}

export function ProjectToolbar({
                                   project,
                               }: ProjectToolbarProps) {
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
                    title="Project settings"
                >
                    <Settings className="h-4 w-4" />
                </Button>

                <Button size="sm">
                    <Play className="mr-2 h-4 w-4" />
                    Compile
                </Button>
            </div>
        </header>
    );
}