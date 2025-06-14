"use client";

import { authClient } from "@/lib/auth-client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";

const UserNavigation = () => {
  const router = useRouter();

  const handleSignOut = () => {
    authClient.signOut();
    router.push("/sign-in");
  };

  return (
    <Button
      className="max-w-52 justify-start font-bold"
      onClick={() => handleSignOut()}
      size="sm"
      variant="ghost"
    >
      <LogOut className="mr-2 h-4 w-4" /> Sign Out
    </Button>
  );
};

export default UserNavigation;
