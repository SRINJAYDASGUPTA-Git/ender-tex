// ================================
// Authentication DTOs
// ================================

export interface AuthenticationRequest {
    email: string;
    password: string;
}

export interface AuthenticationResponse {
    user: UserResponse;
    message?: string;
}


// ================================
// Invitation DTOs
// ================================

export interface InvitationCreateRequest {
    email: string;
    role?: string;
}

export interface InvitationCreateResponse {
    id: string;
    email: string;
    role: UserRole;
    expiresAt: string;
    token: string;
    message?: string;
}

export interface InvitationAcceptRequest {
    token: string;
    password: string;
}

export interface InvitationAcceptResponse {
    user: UserResponse;
    message?: string;
}


// ================================
// User DTOs
// ================================

export type UserRole = "ADMIN" | "COLLABORATOR";

export interface UserResponse {
    id: string;
    email: string;
    role: UserRole;
    createdAt: string;
    updatedAt: string;
    message?: string;
}


// ================================
// Session / Current User DTOs
// ================================

export interface CurrentUserResponse {
    user: UserResponse;
    message?: string;
}

export type LatexEngine =
    | "pdflatex"
    | "latex"
    | "xelatex"
    | "lualatex";

export type BibliographyBackend =
    | "biber"
    | "bibtex";

export interface Project {
    id: string;
    ownerId: string;
    name: string;
    mainFile: string;
    engine: LatexEngine;
    bibliography: BibliographyBackend;
    createdAt: string;
    updatedAt: string;
}

export type ProjectFileType = "file" | "directory";

export interface ProjectFile {
    path: string;
    name: string;
    type: ProjectFileType;
}
export type ProjectFileResponse = {
    files: ProjectFile[];
}

export type FileResponse = {
    path: string;
    content: string;
}