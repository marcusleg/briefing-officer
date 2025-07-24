import UserDropdownMenu from "@/components/layout/UserDropdownMenu";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const UserNavigation = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <UserDropdownMenu userName={session?.user.name} />
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

export default UserNavigation;
