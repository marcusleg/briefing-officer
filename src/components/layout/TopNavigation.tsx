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
  href: string;
}

interface TopNavigationProps {
  segments?: Segment[];
  page: string;
}

const TopNavigation = ({ segments, page }: TopNavigationProps) => {
  return (
    <div className="flex items-center gap-4">
      <SidebarTrigger />

      <Breadcrumb>
        <BreadcrumbList>
          {segments &&
            segments.map(({ name, href }) => (
              <React.Fragment key={href}>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={href}>{name}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </React.Fragment>
            ))}
          <BreadcrumbPage>{page}</BreadcrumbPage>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};

export default TopNavigation;
