// ================================
// Authentication DTOs
// ================================

export interface AuthenticationRequest {
    email: string;
    password: string;
    name: string;
    imageUrl: string;
    message?: string;
}

export interface AuthenticationResponse {
    access_token: string;
    refresh_token: string;
    message?: string;
}


// ================================
// To do DTOs
// ================================

export interface TodoRequest {
    title: string;
    body: string;
    message?: string;
}

export interface TodoResponse {
    createdAt: string;
    completedAt: string;
    done: boolean;
    title: string;
    body: string;
    ownerId: string;
    id: string;
    message?: string;
}


// ================================
// User DTOs
// ================================

export interface UserResponse {
    id: string;
    name: string;
    email: string;
    imageUrl: string;
    accountLocked: boolean;
    enabled: boolean;
    roles: string[];
    todos: TodoResponse[];
    message?: string;
}

export interface UserUpdateRequest {
    name: string;
    imageUrl: string;
    message?: string;
}