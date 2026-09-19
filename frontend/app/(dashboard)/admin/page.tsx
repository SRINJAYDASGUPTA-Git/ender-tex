"use client";

import React, {useEffect, useState} from "react";
import {
    ChevronDown,
    ChevronRight,
    FolderKanban,
    Loader2,
    Mail,
    Plus,
    ShieldCheck,
    Trash2,
    UserPlus,
    Users,
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {useUser} from "@/providers/UserContext";

interface Project {
    id: string;
    name: string;
    mainFile: string;
    engine: string;
    bibliography: string;
    ownerId: string;
    createdAt: string;
    updatedAt: string;
}

interface ProjectMember {
    name: string;
    email: string;
    id: string;
    projectId: string;
    userId: string;
    permission: "EDITOR" | "VIEWER";
    createdAt: string;
}

interface ProjectInvitation {
    id: string;
    name: string;
    email: string;
    role: string;
    project_id: string;
    existing_user: boolean;
    expires_at: string;
    created_at: string;
}

const AdminPage = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const {user,  loading: userLoading} = useUser();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [expandedProject, setExpandedProject] = useState<string | null>(
        null
    );

    const [members, setMembers] = useState<Record<string, ProjectMember[]>>(
        {}
    );

    const [invitations, setInvitations] = useState<
        Record<string, ProjectInvitation[]>
    >({});

    const [loadingDetails, setLoadingDetails] = useState<
        Record<string, boolean>
    >({});

    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Invite dialog
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedProject, setSelectedProject] =
        useState<Project | null>(null);

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [inviteSuccess, setInviteSuccess] = useState(false);

    const loadProjects = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch("/api/projects", {
                method: "GET",
                credentials: "include",
                cache: "no-store",
            });

            if (!response.ok) {
                throw new Error("Failed to load projects");
            }

            const data = await response.json();

            setProjects(data);
        } catch (err) {
            console.error(err);
            setError("Unable to load projects.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjectDetails = async (projectId: string) => {
        try {
            setLoadingDetails((previous) => ({
                ...previous,
                [projectId]: true,
            }));

            const [membersResponse, invitationsResponse] =
                await Promise.all([
                    fetch(`/api/projects/${projectId}/members`, {
                        method: "GET",
                        credentials: "include",
                        cache: "no-store",
                    }),
                    fetch(`/api/projects/${projectId}/invitations`, {
                        method: "GET",
                        credentials: "include",
                        cache: "no-store",
                    }),
                ]);

            if (!membersResponse.ok) {
                throw new Error("Failed to load project members.");
            }

            if (!invitationsResponse.ok) {
                throw new Error("Failed to load project invitations.");
            }

            const [membersData, invitationsData] = await Promise.all([
                membersResponse.json(),
                invitationsResponse.json(),
            ]);

            setMembers((previous) => ({
                ...previous,
                [projectId]: membersData,
            }));

            setInvitations((previous) => ({
                ...previous,
                [projectId]: invitationsData,
            }));
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingDetails((previous) => ({
                ...previous,
                [projectId]: false,
            }));
        }
    };

    const toggleProject = async (projectId: string) => {
        if (expandedProject === projectId) {
            setExpandedProject(null);
            return;
        }

        setExpandedProject(projectId);

        await loadProjectDetails(projectId);
    };

    const openInviteDialog = (project: Project) => {
        setSelectedProject(project);
        setName("");
        setEmail("");
        setInviteError(null);
        setInviteSuccess(false);
        setDialogOpen(true);
    };

    const handleInvite = async () => {
        if (!selectedProject) return;

        if (!name.trim() || !email.trim()) {
            setInviteError("Name and email are required.");
            return;
        }

        try {
            setSubmitting(true);
            setInviteError(null);
            setInviteSuccess(false);

            const response = await fetch("/api/admin/invitations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim(),
                    project_id: selectedProject.id,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                    data?.error ||
                    "Failed to send invitation."
                );
            }

            setInviteSuccess(true);

            // Refresh invitations for the project.
            await loadProjectDetails(selectedProject.id);

            setTimeout(() => {
                setDialogOpen(false);
            }, 1000);
        } catch (err) {
            console.error(err);

            setInviteError(
                err instanceof Error
                    ? err.message
                    : "Failed to send invitation."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const updateMemberPermission = async (
        projectId: string,
        userId: string,
        permission: "EDITOR" | "VIEWER"
    ) => {
        const actionKey = `permission-${projectId}-${userId}`;

        try {
            setActionLoading(actionKey);

            const response = await fetch(
                `/api/projects/${projectId}/members/${userId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        "permission": permission,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                    data?.error ||
                    "Failed to update member permission."
                );
            }

            await loadProjectDetails(projectId);
        } catch (err) {
            console.error(err);
            alert(
                err instanceof Error
                    ? err.message
                    : "Failed to update member permission."
            );
        } finally {
            setActionLoading(null);
        }
    };

    const removeMember = async (projectId: string, userId: string) => {
        const confirmed = window.confirm(
            "Are you sure you want to remove this member from the project?"
        );

        if (!confirmed) return;

        const actionKey = `remove-${projectId}-${userId}`;

        try {
            setActionLoading(actionKey);

            const response = await fetch(
                `/api/projects/${projectId}/members/${userId}`,
                {
                    method: "DELETE",
                    credentials: "include",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                    data?.error ||
                    "Failed to remove member."
                );
            }

            await loadProjectDetails(projectId);
        } catch (err) {
            console.error(err);
            alert(
                err instanceof Error
                    ? err.message
                    : "Failed to remove member."
            );
        } finally {
            setActionLoading(null);
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const isInvitationExpired = (expiresAt: string) => {
        return new Date(expiresAt).getTime() < Date.now();
    };

    if (loading || userLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
                <p className="text-sm text-muted-foreground">{error}</p>

                <Button onClick={loadProjects} variant="outline">
                    Try again
                </Button>
            </div>
        );
    }

    if (!user){
        window.location.replace("/login");
    }
    if(user?.role !== "ADMIN"){
        window.location.replace("/");
    }
    return (
        <>
            <div className="space-y-8 p-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <ShieldCheck className="h-7 w-7" />

                    <div>
                        <h1 className="text-2xl font-semibold">
                            Admin Panel
                        </h1>

                        <p className="text-sm text-muted-foreground">
                            Manage project collaborators.
                        </p>
                    </div>
                </div>

                {/* Projects */}
                <section className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold">Projects</h2>

                        <p className="text-sm text-muted-foreground">
                            Manage members and invitations for your projects.
                        </p>
                    </div>

                    {projects.length === 0 ? (
                        <div className="rounded-lg border p-10 text-center">
                            <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground" />

                            <p className="mt-3 text-sm font-medium">
                                No projects found
                            </p>

                            <p className="mt-1 text-sm text-muted-foreground">
                                Create a project before adding collaborators.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {projects.map((project) => {
                                const isExpanded =
                                    expandedProject === project.id;

                                const projectMembers =
                                    members[project.id] ?? [];

                                const projectInvitations =
                                    invitations[project.id] ?? [];

                                const projectLoading =
                                    loadingDetails[project.id] ?? false;

                                return (
                                    <div
                                        key={project.id}
                                        className="overflow-hidden rounded-lg border"
                                    >
                                        {/* Project Header */}
                                        <div className="flex items-center justify-between gap-4 p-5">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleProject(project.id)
                                                }
                                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                                                ) : (
                                                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                                                )}

                                                <FolderKanban className="h-5 w-5 shrink-0" />

                                                <div className="min-w-0">
                                                    <h3 className="truncate font-medium">
                                                        {project.name}
                                                    </h3>

                                                    <p className="mt-1 truncate text-xs text-muted-foreground">
                                                        {project.id}
                                                    </p>
                                                </div>
                                            </button>

                                            <Button
                                                size="sm"
                                                onClick={() =>
                                                    openInviteDialog(project)
                                                }
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add member
                                            </Button>
                                        </div>

                                        {/* Expanded Project Details */}
                                        {isExpanded && (
                                            <div className="border-t bg-muted/20 p-5">
                                                {projectLoading ? (
                                                    <div className="flex items-center justify-center py-10">
                                                        <Loader2 className="h-5 w-5 animate-spin" />
                                                    </div>
                                                ) : (
                                                    <div className="space-y-8">
                                                        {/* Current Members */}
                                                        <section className="space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <Users className="h-4 w-4" />

                                                                    <h4 className="font-medium">
                                                                        Current
                                                                        members
                                                                    </h4>

                                                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                                                                        {
                                                                            projectMembers.length
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {projectMembers.length ===
                                                            0 ? (
                                                                <div className="rounded-md border border-dashed p-6 text-center">
                                                                    <Users className="mx-auto h-6 w-6 text-muted-foreground" />

                                                                    <p className="mt-2 text-sm text-muted-foreground">
                                                                        No
                                                                        members
                                                                        found.
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <div className="divide-y rounded-md border bg-background">
                                                                    {projectMembers.map(
                                                                        (
                                                                            member
                                                                        ) => {
                                                                            const permissionActionKey = `permission-${project.id}-${member.userId}`;
                                                                            const removeActionKey = `remove-${project.id}-${member.userId}`;

                                                                            return (
                                                                                <div
                                                                                    key={
                                                                                        member.id
                                                                                    }
                                                                                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                                                                                >
                                                                                    <div className="min-w-0">
                                                                                        <p className="truncate text-sm font-medium">
                                                                                            {
                                                                                                member.name
                                                                                            }
                                                                                        </p>

                                                                                        <p className="mt-1 text-xs text-blue-500">
                                                                                            {
                                                                                                member.email
                                                                                            }
                                                                                        </p>

                                                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                                                            Joined{" "}
                                                                                            {formatDate(
                                                                                                member.createdAt
                                                                                            )}
                                                                                        </p>
                                                                                    </div>

                                                                                    <div className="flex items-center gap-2">
                                                                                        <select
                                                                                            value={
                                                                                                member.permission
                                                                                            }
                                                                                            disabled={
                                                                                                actionLoading ===
                                                                                                permissionActionKey
                                                                                            }
                                                                                            onChange={(
                                                                                                event
                                                                                            ) =>
                                                                                                updateMemberPermission(
                                                                                                    project.id,
                                                                                                    member.userId,
                                                                                                    event
                                                                                                        .target
                                                                                                        .value as
                                                                                                        | "EDITOR"
                                                                                                        | "VIEWER"
                                                                                                )
                                                                                            }
                                                                                            className="h-9 rounded-md border bg-background px-3 text-sm"
                                                                                        >
                                                                                            <option value="EDITOR">
                                                                                                Editor
                                                                                            </option>

                                                                                            <option value="VIEWER">
                                                                                                Viewer
                                                                                            </option>
                                                                                        </select>

                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="icon"
                                                                                            title="Remove member"
                                                                                            disabled={
                                                                                                actionLoading ===
                                                                                                removeActionKey
                                                                                            }
                                                                                            onClick={() =>
                                                                                                removeMember(
                                                                                                    project.id,
                                                                                                    member.userId
                                                                                                )
                                                                                            }
                                                                                        >
                                                                                            {actionLoading ===
                                                                                            removeActionKey ? (
                                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                                            ) : (
                                                                                                <Trash2 className="h-4 w-4" />
                                                                                            )}
                                                                                        </Button>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        }
                                                                    )}
                                                                </div>
                                                            )}
                                                        </section>

                                                        {/* Invitations */}
                                                        <section className="space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <Mail className="h-4 w-4" />

                                                                    <h4 className="font-medium">
                                                                        Invitations
                                                                    </h4>

                                                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                                                                        {
                                                                            projectInvitations.length
                                                                        }
                                                                    </span>
                                                                </div>

                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        openInviteDialog(
                                                                            project
                                                                        )
                                                                    }
                                                                >
                                                                    <UserPlus className="mr-2 h-4 w-4" />
                                                                    Invite
                                                                </Button>
                                                            </div>

                                                            {projectInvitations.length ===
                                                            0 ? (
                                                                <div className="rounded-md border border-dashed p-6 text-center">
                                                                    <Mail className="mx-auto h-6 w-6 text-muted-foreground" />

                                                                    <p className="mt-2 text-sm text-muted-foreground">
                                                                        No
                                                                        pending
                                                                        invitations.
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <div className="divide-y rounded-md border bg-background">
                                                                    {projectInvitations.map(
                                                                        (
                                                                            invitation
                                                                        ) => {
                                                                            const expired =
                                                                                isInvitationExpired(
                                                                                    invitation.expires_at
                                                                                );

                                                                            return (
                                                                                <div
                                                                                    key={
                                                                                        invitation.id
                                                                                    }
                                                                                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                                                                                >
                                                                                    <div className="min-w-0">
                                                                                        <p className="truncate text-sm font-medium">
                                                                                            {
                                                                                                invitation.name
                                                                                            }
                                                                                        </p>

                                                                                        <p className="truncate text-sm text-muted-foreground">
                                                                                            {
                                                                                                invitation.email
                                                                                            }
                                                                                        </p>
                                                                                    </div>

                                                                                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                                                                                        <span className="rounded-full border px-2 py-1 text-xs">
                                                                                            {
                                                                                                invitation.role
                                                                                            }
                                                                                        </span>

                                                                                        {invitation.existing_user && (
                                                                                            <span className="rounded-full border px-2 py-1 text-xs">
                                                                                                Existing
                                                                                                user
                                                                                            </span>
                                                                                        )}

                                                                                        <span
                                                                                            className={`text-xs ${
                                                                                                expired
                                                                                                    ? "text-destructive"
                                                                                                    : "text-muted-foreground"
                                                                                            }`}
                                                                                        >
                                                                                            {expired
                                                                                                ? "Expired"
                                                                                                : `Expires ${formatDate(
                                                                                                    invitation.expires_at
                                                                                                )}`}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        }
                                                                    )}
                                                                </div>
                                                            )}
                                                        </section>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            {/* Invite Dialog */}
            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    if (!submitting) {
                        setDialogOpen(open);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add member</DialogTitle>

                        <DialogDescription>
                            Invite a collaborator to{" "}
                            <span className="font-medium">
                                {selectedProject?.name}
                            </span>
                            .
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="member-name">Name</Label>

                            <Input
                                id="member-name"
                                placeholder="John Doe"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={submitting}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="member-email">Email</Label>

                            <Input
                                id="member-email"
                                type="email"
                                placeholder="john@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={submitting}
                            />
                        </div>

                        {inviteError && (
                            <p className="text-sm text-destructive">
                                {inviteError}
                            </p>
                        )}

                        {inviteSuccess && (
                            <p className="text-sm text-green-600">
                                Invitation sent successfully.
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>

                        <Button
                            onClick={handleInvite}
                            disabled={submitting}
                        >
                            {submitting && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}

                            Send invitation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default AdminPage;