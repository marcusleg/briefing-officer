import LeftNavigation from "@/components/navigation/left-navigation";
import { SidebarProvider } from "@/components/ui/sidebar";

export default async function MyFeedsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <LeftNavigation />

      <main className="w-full">{children}</main>
    </SidebarProvider>
  );
}
