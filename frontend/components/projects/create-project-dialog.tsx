"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import axios from "@/utils/axiosInstance";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { Project } from "@/types";

export function CreateProjectDialog() {
    const router = useRouter();

    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const [name, setName] = useState("");
    const [mainFile, setMainFile] = useState("main.tex");
    const [engine, setEngine] = useState("pdflatex");
    const [bibliography, setBibliography] = useState<string>("biber");

    const resetForm = () => {
        setName("");
        setMainFile("main.tex");
        setEngine("pdflatex");
        setBibliography("biber");
    };

    const createProject = async () => {
        if (!name.trim()) {
            toast.error("Project name is required.");
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post<Project>("/projects", {
                name: name.trim(),
                mainFile: mainFile.trim() || "main.tex",
                engine,
                bibliography,
            });

            toast.success("Project created.");

            setOpen(false);
            resetForm();

            router.push(`/projects/${response.data.id}`);
        } catch (error: any) {
            console.error(error);

            const message =
                error?.response?.data?.message ??
                "Failed to create project.";

            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!loading) {
                    setOpen(value);
                }
            }}
        >
            <DialogTrigger render={<Button />}>
                <Plus className="mr-2 h-4 w-4" />
                New Project
            </DialogTrigger>

            <DialogContent className="sm:max-w-125">
                <DialogHeader>
                    <DialogTitle>Create project</DialogTitle>

                    <DialogDescription>
                        Create a new LaTeX project.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="project-name">
                            Project name
                        </Label>

                        <Input
                            id="project-name"
                            placeholder="My Research Paper"
                            value={name}
                            onChange={(event) =>
                                setName(event.target.value)
                            }
                            disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="main-file">
                            Main file
                        </Label>

                        <Input
                            id="main-file"
                            placeholder="main.tex"
                            value={mainFile}
                            onChange={(event) =>
                                setMainFile(event.target.value)
                            }
                            disabled={loading}
                        />

                        <p className="text-xs text-muted-foreground">
                            The primary .tex file compiled by the project.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>LaTeX engine</Label>

                        <Select
                            value={engine}
                            onValueChange={(value) => {
                                if (value !== null) {
                                    setEngine(value);
                                }
                            }}
                            disabled={loading}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value="pdflatex">
                                    PDFLaTeX
                                </SelectItem>

                                <SelectItem value="latex">
                                    LaTeX
                                </SelectItem>

                                <SelectItem value="xelatex">
                                    XeLaTeX
                                </SelectItem>

                                <SelectItem value="lualatex">
                                    LuaLaTeX
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Bibliography backend</Label>

                        <Select
                            value={engine}
                            onValueChange={(value) => {
                                if (value !== null) {
                                    setBibliography(value);
                                }
                            }}
                            disabled={loading}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value="biber">
                                    Biber
                                </SelectItem>

                                <SelectItem value="bibtex">
                                    BibTeX
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={createProject}
                        disabled={loading}
                    >
                        {loading ? "Creating..." : "Create project"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}