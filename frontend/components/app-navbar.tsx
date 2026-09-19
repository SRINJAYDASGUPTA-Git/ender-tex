"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {
    ChevronDownIcon,
    FolderKanbanIcon,
    LayoutDashboardIcon,
    LogOutIcon,
    SettingsIcon,
    UsersIcon,
} from "lucide-react";

import {Avatar, AvatarFallback} from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {useUser} from "@/providers/UserContext";

export function AppNavbar() {
    const {user} = useUser();
    const router = useRouter();

    const getInitials = (email: string) => {
        const localPart = email.split("@")[0];

        return (
            localPart
                .trim()
                .split(/[._\-\s]+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase() || "U"
        );
    };

    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", {
                method: "POST",
            });
        } finally {
            router.push("/login");
            router.refresh();
        }
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background">
            <div className="flex h-14 items-center px-6">
                {/* Brand */}
                <Link
                    href="/"
                    className="mr-8 font-semibold tracking-tight"
                >
                    <span className={"text-3xl"}>
                      Ender
                      <span className="bg-linear-to-r from-violet-400 via-purple-500 to-fuchsia-500 bg-clip-text text-transparent">
                        TeX
                      </span>
                    </span>
                </Link>

                {/* Main navigation */}
                <nav className="flex items-center gap-1">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <LayoutDashboardIcon className="size-4"/>
                        Dashboard
                    </Link>

                    <Link
                        href="/projects"
                        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <FolderKanbanIcon className="size-4"/>
                        Projects
                    </Link>

                    {user?.role === "ADMIN" && (
                        <Link
                            href="/admin"
                            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            <UsersIcon className="size-4"/>
                            Administration
                        </Link>
                    )}
                </nav>

                {/* User menu */}
                <div className="ml-auto">
                    {user && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <Avatar className="size-8 rounded-lg">
                                        <AvatarFallback className="rounded-lg">
                                            {getInitials(user.name)}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="hidden text-left leading-tight sm:block">
                                        <div className="max-w-48 truncate text-sm font-medium">
                                            {user.name}
                                        </div>

                                        <div className="text-xs text-muted-foreground">
                                            {user.role}
                                        </div>
                                    </div>

                                    <ChevronDownIcon className="size-4 text-muted-foreground"/>
                                </button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent
                                align="end"
                                className="w-56"
                            >
                                <DropdownMenuItem
                                    onClick={() => router.push("/settings")}
                                >
                                    <SettingsIcon/>
                                    Settings
                                </DropdownMenuItem>

                                <DropdownMenuSeparator/>

                                <DropdownMenuItem
                                    variant="destructive"
                                    onClick={handleLogout}
                                >
                                    <LogOutIcon/>
                                    Logout
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>
        </header>
    );
}