"use client";

import React from "react";

import {
    ChevronDown,
    ChevronRight,
    File,
    FileCode,
    Folder,
    FolderOpen,
} from "lucide-react";

import { ProjectFile } from "@/types";

import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface FileTreeProps {
    entries: ProjectFile[];
    selectedPath: string | null;
    onFileSelect: (path: string) => void;
    onCreate: (
        type: "file" | "directory",
        parentPath: string
    ) => void;
    onRename: (
        type: "file" | "directory",
        path: string
    ) => void;
    onDelete: (
        type: "file" | "directory",
        path: string
    ) => void;
}

interface TreeNode {
    name: string;
    path: string;
    type: "file" | "directory";
    children: TreeNode[];
}

interface TreeItemProps {
    node: TreeNode;
    depth: number;
    selectedPath: string | null;
    onFileSelect: (path: string) => void;
    onCreate: (
        type: "file" | "directory",
        parentPath: string
    ) => void;
    onRename: (
        type: "file" | "directory",
        path: string
    ) => void;
    onDelete: (
        type: "file" | "directory",
        path: string
    ) => void;
}

function buildTree(entries: ProjectFile[]): TreeNode[] {
    const root: TreeNode[] = [];

    const sortedEntries = [...entries].sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === "directory" ? -1 : 1;
        }

        return a.path.localeCompare(b.path);
    });

    for (const entry of sortedEntries) {
        const parts = entry.path.split("/");

        let currentLevel = root;
        let currentPath = "";

        parts.forEach((part, index) => {
            currentPath = currentPath
                ? `${currentPath}/${part}`
                : part;

            const isLast = index === parts.length - 1;

            let node = currentLevel.find(
                (item) => item.name === part
            );

            if (!node) {
                node = {
                    name: part,
                    path: currentPath,
                    type: isLast ? entry.type : "directory",
                    children: [],
                };

                currentLevel.push(node);
            }

            currentLevel = node.children;
        });
    }

    return root;
}

function TreeItem({
                      node,
                      depth,
                      selectedPath,
                      onFileSelect,
                      onCreate,
                      onRename,
                      onDelete,
                  }: TreeItemProps) {
    const [expanded, setExpanded] = React.useState(true);

    const isSelected =
        node.type === "file" &&
        node.path === selectedPath;

    const item = (
        <div
            className={`flex w-full items-center rounded-md ${
                isSelected ? "bg-muted" : ""
            }`}
            style={{
                paddingLeft: `${8 + depth * 14}px`,
            }}
        >
            {node.type === "directory" ? (
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="flex min-w-0 flex-1 items-center gap-1 rounded-md py-1 text-left text-sm hover:bg-muted"
                >
                    {expanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}

                    {expanded ? (
                        <FolderOpen className="h-4 w-4 shrink-0" />
                    ) : (
                        <Folder className="h-4 w-4 shrink-0" />
                    )}

                    <span className="truncate">
                        {node.name}
                    </span>
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => onFileSelect(node.path)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left text-sm hover:bg-muted"
                >
                    {node.name
                        .toLowerCase()
                        .endsWith(".tex") ? (
                        <FileCode className="h-4 w-4 shrink-0" />
                    ) : (
                        <File className="h-4 w-4 shrink-0" />
                    )}

                    <span className="truncate">
                        {node.name}
                    </span>
                </button>
            )}
        </div>
    );

    return (
        <div>
            <ContextMenu>
                <ContextMenuTrigger render={item} />
                <ContextMenuContent className="w-48">
                    {node.type === "directory" && (
                        <>
                            <ContextMenuItem
                                onClick={() =>
                                    onCreate(
                                        "file",
                                        node.path
                                    )
                                }
                            >
                                New File
                            </ContextMenuItem>

                            <ContextMenuItem
                                onClick={() =>
                                    onCreate(
                                        "directory",
                                        node.path
                                    )
                                }
                            >
                                New Folder
                            </ContextMenuItem>

                            <ContextMenuSeparator />
                        </>
                    )}

                    <ContextMenuItem
                        onClick={() =>
                            onRename(
                                node.type,
                                node.path
                            )
                        }
                    >
                        Rename
                    </ContextMenuItem>

                    <ContextMenuItem
                        variant="destructive"
                        onClick={() =>
                            onDelete(
                                node.type,
                                node.path
                            )
                        }
                    >
                        Delete
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>

            {node.type === "directory" &&
                expanded &&
                node.children.map((child) => (
                    <TreeItem
                        key={child.path}
                        node={child}
                        depth={depth + 1}
                        selectedPath={selectedPath}
                        onFileSelect={onFileSelect}
                        onCreate={onCreate}
                        onRename={onRename}
                        onDelete={onDelete}
                    />
                ))}
        </div>
    );
}

export function FileTree({
                             entries,
                             selectedPath,
                             onFileSelect,
                             onCreate,
                             onRename,
                             onDelete,
                         }: FileTreeProps) {
    const tree = buildTree(entries);

    return (
        <div className="space-y-0.5">
            {tree.map((node) => (
                <TreeItem
                    key={node.path}
                    node={node}
                    depth={0}
                    selectedPath={selectedPath}
                    onFileSelect={onFileSelect}
                    onCreate={onCreate}
                    onRename={onRename}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}