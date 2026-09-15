"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";

import axios from "@/utils/axiosInstance";
import { Project } from "@/types";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {CreateProjectDialog} from "@/components/projects/create-project-dialog";

export default function ProjectsPage() {
    const router = useRouter();

    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadProjects = async () => {
            try {
                const response = await axios.get<Project[]>("/projects");
                setProjects(response.data);
            } catch (error) {
                console.error(error);
                toast.error("Failed to load projects.");
            } finally {
                setLoading(false);
            }
        };

        loadProjects();
    }, []);

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">
                        Projects
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Your LaTeX projects
                    </p>
                </div>

                <CreateProjectDialog />
            </div>

            {loading ? (
                <div className="text-sm text-muted-foreground">
                    Loading projects...
                </div>
            ) : projects.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <FileText className="mb-4 h-10 w-10 text-muted-foreground" />

                        <h2 className="text-lg font-medium">
                            No projects yet
                        </h2>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Create your first LaTeX project to get started.
                        </p>

                        <Button className="mt-6">
                            <Plus className="mr-2 h-4 w-4" />
                            New Project
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project) => (
                        <Card
                            key={project.id}
                            className="cursor-pointer transition-colors hover:bg-muted/50"
                            onClick={() =>
                                router.push(`/projects/${project.id}`)
                            }
                        >
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    {project.name}
                                </CardTitle>
                            </CardHeader>

                            <CardContent>
                                <div className="space-y-1 text-sm text-muted-foreground">
                                    <p>
                                        Main file:{" "}
                                        <span className="text-foreground">
                                            {project.mainFile}
                                        </span>
                                    </p>

                                    <p>
                                        Engine:{" "}
                                        <span className="text-foreground">
                                            {project.engine}
                                        </span>
                                    </p>

                                    <p>
                                        Bibliography:{" "}
                                        <span className="text-foreground">
                                            {project.bibliography}
                                        </span>
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}