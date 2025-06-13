import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { auth } from "@/lib/auth";
import { CircleUserRoundIcon } from "lucide-react";
import { headers } from "next/headers";

const UserAccountButton = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="size-12" size="icon" variant="ghost">
          <CircleUserRoundIcon className="size-8" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuItem>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserAccountButton;
