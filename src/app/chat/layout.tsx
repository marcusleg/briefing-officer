import LeftNavigation from "@/components/navigation/left-navigation";
import { SidebarProvider } from "@/components/ui/sidebar";

// The root layout's <main> adds p-4 (2rem vertically), so the chat takes the
// rest of the viewport. Its conversation scrolls inside that height instead of
// the page, which keeps the prompt input pinned at the bottom. The sidebar
// wrapper's own min-h-svh would add the padding on top and scroll the page, so
// it is dropped here.
export default async function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider className="min-h-0">
      <LeftNavigation />

      <div className="flex h-[calc(100svh-2rem)] w-full flex-col">
        {children}
      </div>
    </SidebarProvider>
  );
}
