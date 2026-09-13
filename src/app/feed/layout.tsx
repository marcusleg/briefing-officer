import LiveUpdates from "@/components/live-updates";
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

      <div className="w-full">
        <LiveUpdates>{children}</LiveUpdates>
      </div>
    </SidebarProvider>
  );
}
