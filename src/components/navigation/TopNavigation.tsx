"use server";

import ThemeModeToggle from "@/components/theme-mode-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Link from "next/link";
import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";

interface Segment {
  name: string;
  href?: string;
}

interface TopNavigationProps {
  segments?: Segment[];
  page: string;
}

const TopNavigation = async ({ segments, page }: TopNavigationProps) => {
  return (
    <div className="flex items-center gap-4">
      <SidebarTrigger />

      <Breadcrumb>
        <BreadcrumbList>
          {segments &&
            segments.map(({ name, href }) => (
              <React.Fragment key={name}>
                <BreadcrumbItem>
                  {href ? (
                    <BreadcrumbLink asChild>
                      <Link href={href}>{name}</Link>
                    </BreadcrumbLink>
                  ) : (
                    name
                  )}
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </React.Fragment>
            ))}
          <BreadcrumbPage>{page}</BreadcrumbPage>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grow" />

      <ThemeModeToggle />
    </div>
  );
};

export default TopNavigation;
