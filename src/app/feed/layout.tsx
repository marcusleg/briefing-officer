import LeftNavigation from "@/components/navigation/LeftNavigation";
import { SidebarProvider } from "@/components/ui/sidebar";

export default async function MyFeedsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <LeftNavigation />

      <div>{children}</div>
    </SidebarProvider>
  );
}
