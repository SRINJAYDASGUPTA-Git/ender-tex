"use client"

import * as React from "react"

import {NavMain} from "@/components/nav-main"
import {NavUser} from "@/components/nav-user"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import {useUser} from "@/providers/UserContext";
import {useRouter} from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export function AppSidebar({...props}: React.ComponentProps<typeof Sidebar>) {
    const {user, loading} = useUser()
    const router = useRouter();

    if (loading) {
        return (
            <></>
        )
    }

    if (!user) {
        return null
    }
    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            className="cursor-default hover:bg-transparent"
                        >
                            <Link href="/dashboard" className="flex items-center justify-between w-[65%]">
                                <Image src={'/word_logo.png'} alt={'logo'} width={150} height={37}  />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>

                <NavMain/>
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={user!}/>
            </SidebarFooter>
            <SidebarRail/>
        </Sidebar>
    )
}
