"use client";

import {CheckCircle2, Circle, ListTodo, Plus, Sparkles, Target,} from "lucide-react";

import {useEffect, useMemo, useState} from "react";
import {useRouter} from "next/navigation";

import {useUser} from "@/providers/UserContext";
import axios from "@/utils/axiosInstance";

import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle,} from "@/components/ui/card";
import {Progress} from "@/components/ui/progress";

import {TodoResponse} from "@/types";
import {toast} from "@/components/ui/toast";

export default function Home() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  const [todos, setTodos] = useState<TodoResponse[]>([]);
  const [todosLoading, setTodosLoading] = useState(true);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/login");
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    if (!user) {
      toast.add({
        type: "error",
        description: "Not logged in",
        priority: "high",
      });
    }

    const fetchTodos = async () => {
      try {
        const response =
            await axios.get<TodoResponse[]>("/todos");

        setTodos(response.data);
      } catch (error) {
        console.error("Failed to fetch todos:", error);
      } finally {
        setTodosLoading(false);
      }
    };

    fetchTodos();
  }, [user]);

  const stats = useMemo(() => {
    const total = todos.length;

    const completed = todos.filter(
        (todo) => todo.done
    ).length;

    const active = todos.filter(
        (todo) => !todo.done
    ).length;

    return {
      total,
      completed,
      active,
    };
  }, [todos]);

  const progress =
      stats.total > 0
          ? Math.round(
              (stats.completed / stats.total) * 100
          )
          : 0;

  const activeTodos = useMemo(() => {
    return todos
        .filter((todo) => !todo.done)
        .slice(0, 5);
  }, [todos]);

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

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 text-primary" />

              <span>Good to see you</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              Hey, {user.name.split(" ")[0]} 👋
            </h1>

            <p className="mt-1 text-muted-foreground">
              Let&apos;s get some things done today.
            </p>
          </div>

          <Button
              onClick={() => router.push("/todos")}
              className="gap-2"
          >
            <Plus className="size-4" />
            New Task
          </Button>
        </div>

        {/* Progress */}
        <Card className="overflow-hidden" data-testid={'dashboard-progress-card'}>
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="size-5 text-primary" />

                  <span className="font-medium">
                  Task progress
                </span>
                </div>

                <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">
                  {progress}%
                </span>

                  <span className="text-sm text-muted-foreground">
                  completed
                </span>
                </div>

                <p className="text-sm text-muted-foreground">
                  {stats.completed} of {stats.total} tasks completed
                </p>
              </div>

              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>

                  <span>
                  {stats.completed}/{stats.total}
                </span>
                </div>

                <Progress value={progress} />
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <ListTodo className="size-5 text-primary" />
              </div>

              <div>
                <p className="text-2xl font-bold">
                  {stats.total}
                </p>

                <p className="text-sm text-muted-foreground">
                  Total Tasks
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/10">
                <CheckCircle2 className="size-5 text-green-500" />
              </div>

              <div>
                <p className="text-2xl font-bold">
                  {stats.completed}
                </p>

                <p className="text-sm text-muted-foreground">
                  Completed
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Circle className="size-5 text-blue-500" />
              </div>

              <div>
                <p className="text-2xl font-bold">
                  {stats.active}
                </p>

                <p className="text-sm text-muted-foreground">
                  Active
                </p>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Active Tasks */}
        <div className="grid gap-6 lg:grid-cols-3">

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Active Tasks</CardTitle>

                <p className="mt-1 text-sm text-muted-foreground">
                  Things still waiting to get done.
                </p>
              </div>

              <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/todos")}
              >
                View all
              </Button>
            </CardHeader>

            <CardContent>
              {todosLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
              ) : activeTodos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                      <CheckCircle2 className="size-6 text-primary" />
                    </div>

                    <div>
                      <p className="font-medium">
                        You&apos;re all caught up!
                      </p>

                      <p className="text-sm text-muted-foreground">
                        No active tasks right now.
                      </p>
                    </div>
                  </div>
              ) : (
                  <div className="space-y-3">
                    {activeTodos.map((todo) => (
                        <div
                            key={todo.id}
                            className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                        >
                          <Circle className="size-5 shrink-0 text-muted-foreground" />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {todo.title}
                            </p>

                            {todo.body && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {todo.body}
                                </p>
                            )}
                          </div>
                        </div>
                    ))}
                  </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>

              <p className="text-sm text-muted-foreground">
                Jump right into it.
              </p>
            </CardHeader>

            <CardContent className="space-y-3">
              <Button
                  className="w-full justify-start gap-3"
                  onClick={() => router.push("/todos")}
              >
                <Plus className="size-4" />
                Create a task
              </Button>

              <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => router.push("/todos?view=active")}
              >
                <Circle className="size-4" />
                View active tasks
              </Button>

              <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => router.push("/todos?view=completed")}
              >
                <CheckCircle2 className="size-4" />
                View completed tasks
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
  );
}