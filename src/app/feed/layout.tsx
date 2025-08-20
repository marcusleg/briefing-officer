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

      <div className="w-full">{children}</div>
    </SidebarProvider>
  );
}
