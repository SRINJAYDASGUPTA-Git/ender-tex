"use client";

import {
    Camera,
    CheckCircle2,
    Loader2,
    Mail,
    Save,
    User,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import axios from "@/utils/axiosInstance";
import { useUser } from "@/providers/UserContext";
import {
    UserUpdateRequest,
    UserResponse,
} from "@/types";

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import {
    Field,
    FieldLabel,
} from "@/components/ui/field";

export default function SettingsPage() {
    const {
        user,
        loading: userLoading,
        setUser,
    } = useUser();

    const router = useRouter();

    const fileInputRef =
        useRef<HTMLInputElement>(null);

    const [name, setName] = useState("");
    const [imageUrl, setImageUrl] = useState("");

    const [uploadingImage, setUploadingImage] =
        useState(false);

    const [saving, setSaving] =
        useState(false);

    const [success, setSuccess] =
        useState("");

    const [error, setError] =
        useState("");

    useEffect(() => {
        if (!userLoading && !user) {
            router.push("/login");
        }
    }, [user, userLoading, router]);

    useEffect(() => {
        if (user) {
            setName(user.name);
            setImageUrl(user.imageUrl);
        }
    }, [user]);

    const getInitials = (name: string) => {
        return (
            name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase() || "U"
        );
    };

    const handleImageSelect = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        setUploadingImage(true);
        setError("");
        setSuccess("");

        try {
            const formData = new FormData();

            formData.append("image", file);

            const response =
                await axios.post<{ url: string }>(
                    "/upload/avatar",
                    formData
                );

            setImageUrl(response.data.url);
        } catch (error: any) {
            setError(
                error.response?.data?.message ||
                "Failed to upload profile image."
            );
        } finally {
            setUploadingImage(false);

            // Allows selecting the same file again.
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleSave = async (
        event: React.FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();

        setSaving(true);
        setError("");
        setSuccess("");

        try {
            const request: UserUpdateRequest = {
                name: name.trim(),
                imageUrl,
            };

            const response =
                await axios.put<UserResponse>(
                    "/users/me",
                    request
                );

            setUser(response.data);

            setSuccess(
                "Your profile has been updated."
            );
        } catch (error: any) {
            setError(
                error.response?.data?.message ||
                "Failed to update your profile."
            );
        } finally {
            setSaving(false);
        }
    };

    if (userLoading || !user) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="size-7 animate-spin text-primary" />

                    <p className="text-sm text-muted-foreground">
                        Loading settings...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            data-testid="settings-page"
            className="mx-auto w-full max-w-3xl space-y-8 p-6 lg:p-8"
        >
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    Settings
                </h1>

                <p className="mt-1 text-muted-foreground">
                    Manage your EnderDoes profile.
                </p>
            </div>

            {/* Profile */}
            <Card data-testid="settings-profile-card">
                <CardHeader>
                    <CardTitle>
                        Profile
                    </CardTitle>

                    <CardDescription>
                        Update your name and profile
                        picture.
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form
                        data-testid="settings-form"
                        onSubmit={handleSave}
                        className="space-y-8"
                    >
                        {/* Avatar */}
                        <div className="flex flex-col items-center gap-4 sm:flex-row">
                            <div className="relative">
                                <Avatar
                                    data-testid="settings-avatar"
                                    className="size-24 rounded-2xl"
                                >
                                    <AvatarImage
                                        src={imageUrl}
                                        alt={name}
                                    />

                                    <AvatarFallback className="rounded-2xl text-xl">
                                        {getInitials(name)}
                                    </AvatarFallback>
                                </Avatar>

                                <button
                                    type="button"
                                    data-testid="settings-avatar-button"
                                    onClick={() =>
                                        fileInputRef.current?.click()
                                    }
                                    disabled={
                                        uploadingImage
                                    }
                                    className="absolute -bottom-2 -right-2 flex size-9 items-center justify-center rounded-full border bg-background shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                                    aria-label="Change profile picture"
                                >
                                    {uploadingImage ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Camera className="size-4" />
                                    )}
                                </button>

                                <input
                                    data-testid="settings-image-input"
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={
                                        handleImageSelect
                                    }
                                />
                            </div>

                            <div className="text-center sm:text-left">
                                <p className="font-medium">
                                    Profile picture
                                </p>

                                <p className="text-sm text-muted-foreground">
                                    Choose an image to
                                    represent you.
                                </p>

                                <Button
                                    type="button"
                                    data-testid="settings-change-picture"
                                    variant="outline"
                                    size="sm"
                                    className="mt-3"
                                    disabled={
                                        uploadingImage
                                    }
                                    onClick={() =>
                                        fileInputRef.current?.click()
                                    }
                                >
                                    {uploadingImage
                                        ? "Uploading..."
                                        : "Change picture"}
                                </Button>
                            </div>
                        </div>

                        {/* Name */}
                        <Field>
                            <FieldLabel htmlFor="name">
                                Name
                            </FieldLabel>

                            <div className="relative">
                                <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                                <Input
                                    id="name"
                                    data-testid="settings-name"
                                    value={name}
                                    onChange={(event) =>
                                        setName(
                                            event.target.value
                                        )
                                    }
                                    className="pl-9"
                                    required
                                />
                            </div>
                        </Field>

                        {/* Email */}
                        <Field>
                            <FieldLabel htmlFor="email">
                                Email
                            </FieldLabel>

                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                                <Input
                                    id="email"
                                    data-testid="settings-email"
                                    value={user.email}
                                    className="bg-muted pl-9"
                                    disabled
                                    readOnly
                                />
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Your email address
                                cannot be changed here.
                            </p>
                        </Field>

                        {/* Feedback */}
                        {error && (
                            <div
                                data-testid="settings-error"
                                className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                            >
                                {error}
                            </div>
                        )}

                        {success && (
                            <div
                                data-testid="settings-success"
                                className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-600"
                            >
                                <CheckCircle2 className="size-4" />

                                {success}
                            </div>
                        )}

                        {/* Save */}
                        <div className="flex justify-end border-t pt-6">
                            <Button
                                data-testid="settings-save"
                                type="submit"
                                disabled={
                                    saving ||
                                    uploadingImage ||
                                    !name.trim()
                                }
                                className="gap-2"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />

                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="size-4" />

                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Account information */}
            <Card data-testid="settings-account-card">
                <CardHeader>
                    <CardTitle>
                        Account
                    </CardTitle>

                    <CardDescription>
                        Information about your
                        EnderDoes account.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Account status */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                            <p className="text-sm font-medium">
                                Account status
                            </p>

                            <p className="text-xs text-muted-foreground">
                                Whether your account is
                                currently active.
                            </p>
                        </div>

                        <span
                            data-testid="settings-account-status"
                            className={
                                user.enabled
                                    ? "rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600"
                                    : "rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive"
                            }
                        >
                            {user.enabled
                                ? "Enabled"
                                : "Disabled"}
                        </span>
                    </div>

                    {/* Account locked */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                            <p className="text-sm font-medium">
                                Account locked
                            </p>

                            <p className="text-xs text-muted-foreground">
                                Current account security
                                status.
                            </p>
                        </div>

                        <span
                            data-testid="settings-account-locked"
                            className={
                                user.accountLocked
                                    ? "rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive"
                                    : "rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600"
                            }
                        >
                            {user.accountLocked
                                ? "Locked"
                                : "Not locked"}
                        </span>
                    </div>

                    {/* Roles */}
                    <div className="rounded-lg border p-4">
                        <p className="text-sm font-medium">
                            Roles
                        </p>

                        <div
                            data-testid="settings-roles"
                            className="mt-2 flex flex-wrap gap-2"
                        >
                            {user.roles.map(
                                (role) => (
                                    <span
                                        key={role}
                                        className="rounded-full bg-muted px-3 py-1 text-xs font-medium"
                                    >
                                        {role}
                                    </span>
                                )
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}