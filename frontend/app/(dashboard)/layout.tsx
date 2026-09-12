import {AppSidebar} from '@/components/app-sidebar';
import {SidebarProvider, SidebarTrigger} from '@/components/ui/sidebar';
import {TooltipProvider} from '@/components/ui/tooltip';

import React from 'react'

export default function HomeLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {

    return (
        <TooltipProvider>
            <SidebarProvider>
                <AppSidebar />
                <main className="flex-1 p-4">
                    <header className="flex h-14 items-center border-b px-4">
                        <SidebarTrigger className={"md:hidden"} />
                    </header>
                    {children}
                </main>
            </SidebarProvider>
        </TooltipProvider>
    )
}