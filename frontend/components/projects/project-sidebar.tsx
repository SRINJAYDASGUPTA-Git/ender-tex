"use client";

import React, {
    useEffect,
    useRef,
    useState,
} from "react";

import {
    FilePlus,
    FolderPlus,
    FolderUp,
    RefreshCw,
    Upload,
    PanelLeftClose,
} from "lucide-react";

import {toast} from "sonner";

import axios from "@/utils/axiosInstance";
import {Project, ProjectFileResponse} from "@/types";

import {Button} from "@/components/ui/button";
import {FileTree} from "./file-tree";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";

interface ProjectSidebarProps {
    project: Project;
    selectedPath: string | null;
    onFileSelect: (path: string) => void;
    onCollapse?: () => void;
}

type ActionType =
    | "create"
    | "rename"
    | "delete"
    | null;

type EntryType =
    | "file"
    | "directory"
    | null;

type UploadableFile = File & {
    webkitRelativePath?: string;
};

export function ProjectSidebar({
                                   project,
                                   selectedPath,
                                   onFileSelect,
                                   onCollapse,
                               }: ProjectSidebarProps) {
    const [files, setFiles] =
        useState<ProjectFileResponse>();

    const [loading, setLoading] =
        useState(true);

    const [actionType, setActionType] =
        useState<ActionType>(null);

    const [entryType, setEntryType] =
        useState<EntryType>(null);

    const [entryPath, setEntryPath] =
        useState("");

    const [entryName, setEntryName] =
        useState("");

    const [creating, setCreating] =
        useState(false);

    const [uploading, setUploading] =
        useState(false);

    const fileInputRef =
        useRef<HTMLInputElement>(null);

    const folderInputRef =
        useRef<HTMLInputElement>(null);

    const loadFiles = async () => {
        try {
            setLoading(true);

            const response =
                await axios.get<ProjectFileResponse>(
                    `/projects/${project.id}/files`
                );

            setFiles(response.data);
        } catch (error) {
            console.error(error);
            toast.error(
                "Failed to load project files."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();
    }, [project.id]);

    /*
     * Upload files.
     *
     * For normal file uploads:
     *     paths = file.name
     *
     * For folder uploads:
     *     paths = file.webkitRelativePath
     */
    const uploadFiles = async (
        selectedFiles: File[],
        preserveRelativePaths: boolean
    ) => {
        if (
            selectedFiles.length === 0 ||
            uploading
        ) {
            return;
        }

        try {
            setUploading(true);

            const formData = new FormData();

            for (const file of selectedFiles) {
                const uploadFile =
                    file as UploadableFile;

                const relativePath =
                    preserveRelativePaths
                        ? (
                            uploadFile.webkitRelativePath ||
                            uploadFile.name
                        )
                        : uploadFile.name;

                formData.append(
                    "files",
                    file
                );

                formData.append(
                    "paths",
                    relativePath
                );
            }

            await axios.post(
                `/projects/${project.id}/upload`,
                formData
            );

            toast.success(
                selectedFiles.length === 1
                    ? "File uploaded."
                    : `${selectedFiles.length} files uploaded.`
            );

            await loadFiles();
        } catch (error: any) {
            console.error(error);

            toast.error(
                error?.response?.data?.message ??
                "Failed to upload files."
            );
        } finally {
            setUploading(false);

            /*
             * Reset both inputs so selecting the same
             * file/folder again triggers onChange.
             */
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            if (folderInputRef.current) {
                folderInputRef.current.value = "";
            }
        }
    };

    const handleFileUpload = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const selectedFiles =
            Array.from(
                event.target.files ?? []
            );

        await uploadFiles(
            selectedFiles,
            false
        );
    };

    const handleFolderUpload = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const selectedFiles =
            Array.from(
                event.target.files ?? []
            );

        await uploadFiles(
            selectedFiles,
            true
        );
    };

    const handleCreate = (
        type: "file" | "directory",
        parentPath: string
    ) => {
        setActionType("create");
        setEntryType(type);
        setEntryPath(parentPath);
        setEntryName("");
    };

    const handleRename = (
        type: "file" | "directory",
        path: string
    ) => {
        if (
            type === "file" &&
            path === project.mainFile
        ) {
            alert(
                "The main file cannot be deleted."
            );
            return;
        }

        setActionType("rename");
        setEntryType(type);
        setEntryPath(path);

        const name =
            path.split("/").pop() ?? "";

        setEntryName(name);
    };

    const handleDelete = (
        type: "file" | "directory",
        path: string
    ) => {
        // Never allow deleting the project's main file.
        if (
            type === "file" &&
            path === project.mainFile
        ) {
            alert(
                "The main file cannot be deleted."
            );
            return;
        }

        // Prevent deleting non-empty directories.
        if (type === "directory") {
            const hasChildren =
                files?.files.some(
                    (file) =>
                        file.path !== path &&
                        file.path.startsWith(
                            `${path}/`
                        )
                );

            if (hasChildren) {
                alert(
                    "Folder is not empty."
                );
                return;
            }
        }

        setActionType("delete");
        setEntryType(type);
        setEntryPath(path);
        setEntryName("");
    };

    const createEntry = async () => {
        if (
            actionType !== "create" ||
            !entryType ||
            !entryName.trim()
        ) {
            return;
        }

        try {
            setCreating(true);

            const name =
                entryName.trim();

            const fullPath = entryPath
                ? `${entryPath}/${name}`
                : name;

            const endpoint =
                entryType === "file"
                    ? `/projects/${project.id}/files/${fullPath}`
                    : `/projects/${project.id}/folders/${fullPath}`;

            await axios.post(
                endpoint,
                entryType === "file"
                    ? {content: ""}
                    : undefined
            );

            toast.success(
                entryType === "file"
                    ? "File created."
                    : "Folder created."
            );

            setActionType(null);
            setEntryType(null);
            setEntryPath("");
            setEntryName("");

            await loadFiles();

            if (entryType === "file") {
                onFileSelect(fullPath);
            }
        } catch (error: any) {
            console.error(error);

            toast.error(
                error?.response?.data?.message ??
                "Failed to create entry."
            );
        } finally {
            setCreating(false);
        }
    };

    const renameEntry = async () => {
        if (
            actionType !== "rename" ||
            !entryType ||
            !entryPath ||
            !entryName.trim()
        ) {
            return;
        }

        try {
            setCreating(true);

            const newName =
                entryName.trim();

            const parentPath =
                entryPath.includes("/")
                    ? entryPath.substring(
                        0,
                        entryPath.lastIndexOf("/")
                    )
                    : "";

            const newPath = parentPath
                ? `${parentPath}/${newName}`
                : newName;

            const endpoint =
                entryType === "file"
                    ? `/projects/${project.id}/files/${entryPath}`
                    : `/projects/${project.id}/folders/${entryPath}`;

            await axios.patch(
                endpoint,
                {
                    newPath,
                }
            );

            toast.success(
                entryType === "file"
                    ? "File renamed."
                    : "Folder renamed."
            );

            const oldPath =
                entryPath;

            setActionType(null);
            setEntryType(null);
            setEntryPath("");
            setEntryName("");

            await loadFiles();

            if (
                selectedPath === oldPath
            ) {
                onFileSelect(newPath);
            }
        } catch (error: any) {
            console.error(error);

            toast.error(
                error?.response?.data?.message ??
                "Failed to rename entry."
            );
        } finally {
            setCreating(false);
        }
    };

    const deleteEntry = async () => {
        if (
            actionType !== "delete" ||
            !entryType ||
            !entryPath
        ) {
            return;
        }

        try {
            setCreating(true);

            const deletedPath =
                entryPath;

            const endpoint =
                entryType === "file"
                    ? `/projects/${project.id}/files/${entryPath}`
                    : `/projects/${project.id}/folders/${entryPath}`;

            await axios.delete(endpoint);

            toast.success(
                entryType === "file"
                    ? "File deleted."
                    : "Folder deleted."
            );

            setActionType(null);
            setEntryType(null);
            setEntryPath("");
            setEntryName("");

            await loadFiles();

            if (
                selectedPath === deletedPath
            ) {
                onFileSelect("");
            }
        } catch (error: any) {
            console.error(error);

            toast.error(
                error?.response?.data?.message ??
                "Failed to delete entry."
            );
        } finally {
            setCreating(false);
        }
    };

    return (
        <aside className="relative flex h-full w-full flex-col border-r">

            {/* Hidden upload inputs */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
            />

            <input
                ref={folderInputRef}
                type="file"
                multiple
                // @ts-expect-error webkitdirectory is supported by browsers
                webkitdirectory=""
                className="hidden"
                onChange={handleFolderUpload}
            />

            <div className="flex h-10 items-center justify-between border-b px-3">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Files
                </span>

                <div className="flex items-center gap-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Collapse sidebar"
                        onClick={onCollapse}
                    >
                        <PanelLeftClose className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="New file"
                        onClick={() =>
                            handleCreate(
                                "file",
                                ""
                            )
                        }
                        disabled={uploading}
                    >
                        <FilePlus className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="New folder"
                        onClick={() =>
                            handleCreate(
                                "directory",
                                ""
                            )
                        }
                        disabled={uploading}
                    >
                        <FolderPlus className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Upload files"
                        onClick={() =>
                            fileInputRef.current?.click()
                        }
                        disabled={uploading}
                    >
                        <Upload className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Upload folder"
                        onClick={() =>
                            folderInputRef.current?.click()
                        }
                        disabled={uploading}
                    >
                        <FolderUp className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Refresh"
                        onClick={loadFiles}
                        disabled={uploading}
                    >
                        <RefreshCw
                            className={`h-3.5 w-3.5 ${
                                loading
                                    ? "animate-spin"
                                    : ""
                            }`}
                        />
                    </Button>

                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {loading &&
                files?.files.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                        Loading files...
                    </div>
                ) : files?.files.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                        No files
                    </div>
                ) : (
                    <FileTree
                        entries={
                            files?.files || []
                        }
                        selectedPath={
                            selectedPath
                        }
                        onFileSelect={
                            onFileSelect
                        }
                        onCreate={
                            handleCreate
                        }
                        onDelete={
                            handleDelete
                        }
                        onRename={
                            handleRename
                        }
                    />
                )}
            </div>

            <Dialog
                open={
                    actionType !== null
                }
                onOpenChange={(open) => {
                    if (
                        !open &&
                        !creating
                    ) {
                        setActionType(null);
                        setEntryType(null);
                        setEntryPath("");
                        setEntryName("");
                    }
                }}
            >
                <DialogContent className="sm:max-w-106.25">

                    {/* CREATE / RENAME */}
                    {(actionType === "create" ||
                        actionType === "rename") && (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {actionType ===
                                    "create"
                                        ? entryType ===
                                        "file"
                                            ? "Create file"
                                            : "Create folder"
                                        : entryType ===
                                        "file"
                                            ? "Rename file"
                                            : "Rename folder"}
                                </DialogTitle>

                                <DialogDescription>
                                    {actionType ===
                                    "create"
                                        ? entryType ===
                                        "file"
                                            ? "Create a new file in the project."
                                            : "Create a new folder in the project."
                                        : "Enter a new name for this entry."}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-2 py-4">
                                <Label htmlFor="entry-name">
                                    Name
                                </Label>

                                <Input
                                    id="entry-name"
                                    autoFocus
                                    value={entryName}
                                    onChange={(
                                        event
                                    ) =>
                                        setEntryName(
                                            event.target.value
                                        )
                                    }
                                    placeholder={
                                        entryType ===
                                        "file"
                                            ? "section.tex"
                                            : "sections"
                                    }
                                    disabled={
                                        creating
                                    }
                                    onKeyDown={(
                                        event
                                    ) => {
                                        if (
                                            event.key ===
                                            "Enter"
                                        ) {
                                            event.preventDefault();

                                            if (
                                                actionType ===
                                                "create"
                                            ) {
                                                createEntry();
                                            } else {
                                                renameEntry();
                                            }
                                        }
                                    }}
                                />
                            </div>

                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setActionType(null);
                                        setEntryType(null);
                                        setEntryPath("");
                                        setEntryName("");
                                    }}
                                    disabled={
                                        creating
                                    }
                                >
                                    Cancel
                                </Button>

                                <Button
                                    onClick={
                                        actionType ===
                                        "create"
                                            ? createEntry
                                            : renameEntry
                                    }
                                    disabled={
                                        !entryName.trim() ||
                                        creating
                                    }
                                >
                                    {creating
                                        ? actionType ===
                                        "create"
                                            ? "Creating..."
                                            : "Renaming..."
                                        : actionType ===
                                        "create"
                                            ? "Create"
                                            : "Rename"}
                                </Button>
                            </DialogFooter>
                        </>
                    )}

                    {/* DELETE */}
                    {actionType === "delete" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    Delete{" "}
                                    {entryType ===
                                    "file"
                                        ? "file"
                                        : "folder"}
                                    ?
                                </DialogTitle>

                                <DialogDescription>
                                    Are you sure you want to delete{" "}
                                    <span className="font-medium text-foreground">
                                        {
                                            entryPath
                                                .split("/")
                                                .pop()
                                        }
                                    </span>
                                    ?
                                    {entryType ===
                                        "directory" && (
                                            <>
                                                {" "}
                                                The folder must be empty.
                                            </>
                                        )}
                                    {" "}
                                    This action cannot be undone.
                                </DialogDescription>
                            </DialogHeader>

                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setActionType(null);
                                        setEntryType(null);
                                        setEntryPath("");
                                    }}
                                    disabled={
                                        creating
                                    }
                                >
                                    Cancel
                                </Button>

                                <Button
                                    variant="destructive"
                                    onClick={
                                        deleteEntry
                                    }
                                    disabled={
                                        creating
                                    }
                                >
                                    {creating
                                        ? "Deleting..."
                                        : "Delete"}
                                </Button>
                            </DialogFooter>
                        </>
                    )}

                </DialogContent>
            </Dialog>
        </aside>
    );
}