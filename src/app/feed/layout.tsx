import LeftNavigation from "@/components/layout/LeftNavigation";
import { SidebarProvider } from "@/components/ui/sidebar";

export default async function MyFeedsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <LeftNavigation />

      <div className="container p-4">{children}</div>
    </SidebarProvider>
  );
}
