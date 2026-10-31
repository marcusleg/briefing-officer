import { ArticleOverridesProvider } from "@/components/article/article-overrides";
import LiveUpdates from "@/components/live-updates";
import LeftNavigation from "@/components/navigation/left-navigation";
import OfflineBanner from "@/components/offline-banner";
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
        <OfflineBanner />
        <LiveUpdates>
          <ArticleOverridesProvider>{children}</ArticleOverridesProvider>
        </LiveUpdates>
      </div>
    </SidebarProvider>
  );
}
