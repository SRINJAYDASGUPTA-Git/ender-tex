"use client";

import {
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  SettingsIcon,
} from "lucide-react";

import {Collapsible, CollapsibleContent, CollapsibleTrigger,} from "@/components/ui/collapsible";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import Link from "next/link";

export function NavMain() {
  return (
      <SidebarGroup>
        <SidebarGroupLabel>
          EnderDoes
        </SidebarGroupLabel>

        <SidebarMenu>
          {/* Overview */}
          <SidebarMenuItem>
            <SidebarMenuButton data-testid={"nav-overview"} asChild tooltip="Overview">
              <Link href="/dashboard">
                <LayoutDashboardIcon />
                <span>Overview</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Tasks */}
          <Collapsible
              defaultOpen
              className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton data-testid={"nav-tasks"} tooltip="Tasks">
                  <ListTodoIcon />
                  <span>Tasks</span>

                  <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton data-testid={"nav-all-tasks"} asChild>
                      <a href="/todos">
                        <ListTodoIcon />
                        <span>All Tasks</span>
                      </a>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>

                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton data-testid={"nav-active-tasks"} asChild>
                      <a href="/todos?view=active">
                        <CircleIcon />
                        <span>Active</span>
                      </a>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>

                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton data-testid={"nav-completed-tasks"} asChild>
                      <a href="/todos?view=completed">
                        <CheckCircle2Icon />
                        <span>Completed</span>
                      </a>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
          {/* Settings */}
          <SidebarMenuItem>
            <SidebarMenuButton data-testid={"nav-settings"} asChild tooltip="Settings">
              <a href="/settings">
                <SettingsIcon />
                <span>Settings</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
  );
}