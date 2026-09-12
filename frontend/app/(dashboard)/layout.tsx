import {TooltipProvider} from '@/components/ui/tooltip';

import React from 'react'
import {AppNavbar} from "@/components/app-navbar";

export default function HomeLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {

    return (
        <TooltipProvider>
            <AppNavbar />
                <main className="flex-1 p-4">
                    {children}
                </main>
        </TooltipProvider>
    )
}