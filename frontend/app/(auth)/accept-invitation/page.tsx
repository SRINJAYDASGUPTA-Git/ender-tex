"use client";

import { FormEvent, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Invitation = {
    email: string;
    name: string;
    project_name: string;
    existing_user: boolean;
    expires_at: string;
};

type CurrentUser = {
    id: string;
    email: string;
    name: string;
};

// 1. Extract the main logic into a separate component
function AcceptInvitationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const token = searchParams.get("token");

    const [invitation, setInvitation] = useState<Invitation | null>(null);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [loading, setLoading] = useState(true);
    const [checkingAuth, setCheckingAuth] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [error, setError] = useState("");

    useEffect(() => {
        if (!token) {
            setError("Invalid invitation link.");
            setLoading(false);
            return;
        }

        const loadInvitation = async () => {
            try {
                const response = await fetch(
                    `/api/auth/invitation?token=${encodeURIComponent(token)}`,
                    {
                        cache: "no-store",
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    setError(
                        data.error ??
                        "This invitation is no longer valid."
                    );
                    return;
                }

                setInvitation(data);

                // Existing users need to already be authenticated.
                if (data.existing_user) {
                    setCheckingAuth(true);

                    const meResponse = await fetch("/api/users/me", {
                        cache: "no-store",
                    });

                    if (!meResponse.ok) {
                        router.push(
                            `/login?returnTo=${encodeURIComponent(
                                `/accept-invitation?token=${token}`
                            )}`
                        );
                        return;
                    }

                    const user = await meResponse.json();

                    if (
                        user.email?.toLowerCase() !==
                        data.email?.toLowerCase()
                    ) {
                        setError(
                            `This invitation is for ${data.email}. ` +
                            `You are currently logged in as ${user.email}.`
                        );
                        return;
                    }

                    setCurrentUser(user);
                }
            } catch {
                setError("Unable to load invitation.");
            } finally {
                setCheckingAuth(false);
                setLoading(false);
            }
        };

        loadInvitation();
    }, [token, router]);

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (!token) {
            setError("Invalid invitation link.");
            return;
        }

        // Only validate passwords for new users.
        if (!invitation?.existing_user) {
            if (password.length < 8) {
                setError(
                    "Password must be at least 8 characters."
                );
                return;
            }

            if (password !== confirmPassword) {
                setError("Passwords do not match.");
                return;
            }
        }

        setSubmitting(true);
        setError("");

        try {
            const response = await fetch(
                "/api/auth/accept-invitation",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        token,
                        ...(invitation?.existing_user
                            ? {}
                            : { password }),
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(
                    data.error ??
                    "Unable to accept invitation."
                );
                return;
            }

            router.push(`/projects/${data.project_id}`);
        } catch {
            setError(
                "Something went wrong. Please try again."
            );
        } finally {
            setSubmitting(false);
        }
    }

    if (loading || checkingAuth) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p>
                    {checkingAuth
                        ? "Checking your account..."
                        : "Loading invitation..."}
                </p>
            </div>
        );
    }

    if (error && !invitation) {
        return (
            <div className="flex min-h-screen items-center justify-center px-4">
                <div className="text-center">
                    <h1 className="text-2xl font-semibold">
                        Invitation unavailable
                    </h1>

                    <p className="mt-2 text-muted-foreground">
                        {error}
                    </p>
                </div>
            </div>
        );
    }

    if (!invitation) {
        return null;
    }

    const isExistingUser = invitation.existing_user;

    return (
        <div className="flex min-h-screen items-center justify-center px-4">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold">
                        Welcome to EnderTex
                    </h1>

                    <p className="mt-2 text-muted-foreground">
                        You&apos;ve been invited to collaborate on
                        the project{" "}
                        <span className="font-medium">
                            {invitation.project_name}
                        </span>
                        .
                    </p>
                </div>

                <div className="mb-6 rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">
                        Name
                    </p>

                    <p className="font-medium">
                        {invitation.name}
                    </p>

                    <p className="mt-3 text-sm text-muted-foreground">
                        Email
                    </p>

                    <p className="font-medium">
                        {invitation.email}
                    </p>
                </div>

                {isExistingUser ? (
                    <div className="space-y-4">
                        <div className="rounded-lg border p-4">
                            <p className="text-sm">
                                You already have an EnderTex
                                account.
                            </p>

                            <p className="mt-1 text-sm text-muted-foreground">
                                You&apos;re signed in as{" "}
                                <span className="font-medium">
                                    {currentUser?.email}
                                </span>
                                .
                            </p>
                        </div>

                        {error && (
                            <p className="text-sm text-red-500">
                                {error}
                            </p>
                        )}

                        <form onSubmit={handleSubmit}>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
                            >
                                {submitting
                                    ? "Accepting invitation..."
                                    : "Accept Invitation →"}
                            </button>
                        </form>
                    </div>
                ) : (
                    <form
                        onSubmit={handleSubmit}
                        className="space-y-4"
                    >
                        <div>
                            <label
                                htmlFor="password"
                                className="mb-2 block text-sm font-medium"
                            >
                                Password
                            </label>

                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(event) =>
                                    setPassword(
                                        event.target.value
                                    )
                                }
                                className="w-full rounded-md border px-3 py-2"
                                minLength={8}
                                required
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="confirm-password"
                                className="mb-2 block text-sm font-medium"
                            >
                                Confirm password
                            </label>

                            <input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(event) =>
                                    setConfirmPassword(
                                        event.target.value
                                    )
                                }
                                className="w-full rounded-md border px-3 py-2"
                                minLength={8}
                                required
                            />
                        </div>

                        {error && (
                            <p className="text-sm text-red-500">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
                        >
                            {submitting
                                ? "Creating account..."
                                : "Accept Invitation →"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

// 2. Wrap the content component inside a Suspense boundary in the exported page
export default function AcceptInvitationPage() {
    return (
        <main className="flex min-h-screen items-center justify-center">
            <Suspense fallback={<p>Loading invitation...</p>}>
                <AcceptInvitationContent />
            </Suspense>
        </main>
    );
}