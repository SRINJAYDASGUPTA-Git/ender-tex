"use client";

import {useState} from "react";
import {cn} from "@/lib/utils";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Field, FieldGroup, FieldLabel,} from "@/components/ui/field";
import {useRouter} from "next/navigation";
import axios from "@/utils/axiosInstance"
import {Eye, EyeOff} from "lucide-react";
import {useUser} from "@/providers/UserContext";

type LoginFormProps = {
    className?: string;
} & React.HTMLAttributes<HTMLFormElement>;

export function LoginForm({
                              className,
                              ...props
                          }: LoginFormProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const {refreshUser} = useUser();

    const router = useRouter();

    async function handleSubmit(
        e: React.FormEvent<HTMLFormElement>
    ) {
        e.preventDefault();

        setLoading(true);
        setError("");

        try {
            const result = await axios.post(
                "/auth/login",
                {
                    email,
                    password,
                }
            );

            if (result.status !== 200) {
                setError(
                    result.data.message ||
                    "Something went wrong"
                );

                return;
            }

            await refreshUser();

            router.push("/dashboard");
        } catch (error: any) {
            setError(
                error.response?.data?.message ||
                "Invalid email or password."
            );
        } finally {
            setLoading(false);
        }
    }


    return (
        <>
            <form
                data-testid="login-form"
                onSubmit={handleSubmit}
                className={cn(
                    "flex flex-col gap-6",
                    className
                )}
                {...props}
            >
                <FieldGroup>
                    <div className="space-y-2 text-center">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Welcome back
                        </h1>

                        <p className="text-sm text-muted-foreground">
                            Sign in to manage your infrastructure.
                        </p>
                    </div>

                    <Field>
                        <FieldLabel htmlFor="email">
                            Email
                        </FieldLabel>

                        <Input
                            id="email"
                            data-testid="login-email"
                            type="email"
                            placeholder="admin@srinjaydg.in"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) =>
                                setEmail(e.target.value)
                            }
                        />
                    </Field>

                    <Field>
                        <FieldLabel htmlFor="password">
                            Password
                        </FieldLabel>

                        <div className="relative">
                            <Input
                                id="password"
                                data-testid="login-password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pr-10"
                            />

                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? (
                                    <EyeOff className="size-4"/>
                                ) : (
                                    <Eye className="size-4"/>
                                )}
                            </button>
                        </div>
                    </Field>

                    {error && (
                        <p data-testid="login-error" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}

                    <Button
                        data-testid="login-submit"
                        type="submit"
                        disabled={loading}
                        className="w-full"
                    >
                        {loading ? "Signing in..." : "Sign In"}
                    </Button>

                    <p className="text-center text-sm text-muted-foreground">
                        Don&apos;t have an account?{" "}
                        <button
                            type="button"
                            onClick={() => router.push("/register")}
                            className="font-medium text-foreground hover:underline"
                        >
                            Register
                        </button>
                    </p>
                </FieldGroup>
            </form>
        </>

    );
}