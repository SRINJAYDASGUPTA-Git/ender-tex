"use client";

import {
  ArrowRight,
  Clock3,
  FileCode2,
  FileText,
  FolderOpen,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useUser } from "@/providers/UserContext";
import axios from "@/utils/axiosInstance";
import { Project } from "@/types";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { toast } from "sonner";

export default function Home() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    if (!userLoading && user) {
      const loadProjects = async () => {
        try {
          const response = await axios.get<Project[]>("/projects");
          setProjects(response.data);
        } catch (error) {
          console.error(error);
          toast.error("Failed to load your projects.");
        } finally {
          setProjectsLoading(false);
        }
      };

      loadProjects();
    }
  }, [user, userLoading]);

  const recentProjects = useMemo(() => {
    return Array.isArray(projects) ? projects.slice(0, 6) : [];
  }, [projects]);

  if (userLoading || !user) {
    return (
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />

            <p className="text-sm text-muted-foreground">
              Loading your workspace...
            </p>
          </div>
        </div>
    );
  }

  return (
      <div className="mx-auto w-full max-w-7xl space-y-8 p-6 lg:p-8">

        {/* ───────────────── Header ───────────────── */}

        <section className="relative overflow-hidden rounded-2xl border bg-card">
          <div className="absolute inset-0 bg-linear-to-br from-primary/8 via-transparent to-transparent" />

          <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="size-4 text-primary" />
                <span>Your workspace</span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Welcome back, {user.name}
              </h1>

              <p className="mt-2 max-w-xl text-muted-foreground">
                Write, compile, and collaborate on your LaTeX
                projects from one place.
              </p>
            </div>

            <CreateProjectDialog />
          </div>
        </section>

        {/* ───────────────── Stats ───────────────── */}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="size-5 text-primary" />
              </div>

              <div>
                <p className="text-2xl font-semibold">
                  {projectsLoading ? "—" : projects.length}
                </p>

                <p className="text-sm text-muted-foreground">
                  {projects.length === 1 ? "Project" : "Projects"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                <FileCode2 className="size-5 text-blue-500" />
              </div>

              <div>
                <p className="text-2xl font-semibold">
                  {projectsLoading ? "—" : projects.length}
                </p>

                <p className="text-sm text-muted-foreground">
                  LaTeX workspaces
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Users className="size-5 text-emerald-500" />
              </div>

              <div>
                <p className="text-2xl font-semibold">
                  —
                </p>

                <p className="text-sm text-muted-foreground">
                  Collaborators
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10">
                <Clock3 className="size-5 text-orange-500" />
              </div>

              <div>
                <p className="text-2xl font-semibold">
                  —
                </p>

                <p className="text-sm text-muted-foreground">
                  Recent activity
                </p>
              </div>
            </CardContent>
          </Card>

        </section>

        {/* ───────────────── Projects ───────────────── */}

        <section className="space-y-4">

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Your projects
              </h2>

              <p className="text-sm text-muted-foreground">
                Pick up where you left off.
              </p>
            </div>

            {projects.length > 0 && (
                <Button
                    variant="ghost"
                    className="gap-2"
                    onClick={() => router.push("/projects")}
                >
                  View all
                  <ArrowRight className="size-4" />
                </Button>
            )}
          </div>

          {projectsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((item) => (
                    <Card key={item}>
                      <CardContent className="space-y-4 p-6">
                        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      </CardContent>
                    </Card>
                ))}
              </div>
          ) : projects.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                    <FileText className="size-7 text-primary" />
                  </div>

                  <h3 className="text-lg font-semibold">
                    Your workspace is empty
                  </h3>

                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Create your first LaTeX project and start
                    writing, compiling, and collaborating.
                  </p>

                  <div className="mt-6">
                    <CreateProjectDialog />
                  </div>
                </CardContent>
              </Card>
          ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentProjects.map((project) => (
                    <Card
                        key={project.id}
                        className="group cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
                        onClick={() =>
                            router.push(`/projects/${project.id}`)
                        }
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-3 text-base">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <FileText className="size-4 text-primary" />
                          </div>

                          <span className="truncate">
                                            {project.name}
                                        </span>

                          <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </CardTitle>
                      </CardHeader>

                      <CardContent>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <FileCode2 className="size-3.5" />

                            <span className="truncate">
                                                {project.mainFile}
                                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                                                {project.engine}
                                            </span>

                            <span className="text-xs">
                                                {project.bibliography}
                                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                ))}
              </div>
          )}

        </section>

        {/* ───────────────── Quick Actions ───────────────── */}

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Quick actions
            </h2>

            <p className="text-sm text-muted-foreground">
              Common things you might want to do.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            <button
                type="button"
                onClick={() => router.push("/projects")}
                className="group rounded-xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <FolderOpen className="size-5 text-primary" />
              </div>

              <h3 className="font-medium">
                Browse projects
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Open and manage all your LaTeX projects.
              </p>

              <div className="mt-4 flex items-center gap-1 text-sm text-primary">
                Open projects
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>

            <div className="rounded-xl border border-dashed bg-muted/20 p-5">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted">
                <Users className="size-5 text-muted-foreground" />
              </div>

              <h3 className="font-medium">
                Collaborate
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Work together with collaborators inside your
                projects.
              </p>

              <p className="mt-4 text-xs text-muted-foreground">
                Available inside projects
              </p>
            </div>

            <div className="rounded-xl border border-dashed bg-muted/20 p-5">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-muted">
                <Plus className="size-5 text-muted-foreground" />
              </div>

              <h3 className="font-medium">
                Start something new
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Create a fresh project and begin writing.
              </p>

              <div className="mt-4">
                <CreateProjectDialog />
              </div>
            </div>

          </div>
        </section>

      </div>
  );
}