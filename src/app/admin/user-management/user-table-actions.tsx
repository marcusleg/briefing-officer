"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { User } from "better-auth";
import { ShieldBanIcon, ShieldCheckIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface UserListActionsProps {
  user: User;
}

const UserTableActions = ({ user }: UserListActionsProps) => {
  const router = useRouter();

  // @ts-ignore the correct type `UserWithRole` cannot be imported
  const isBanned = user.banned;
  // @ts-ignore the correct type `UserWithRole` cannot be imported
  const isAdmin = user.role === "admin";

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    const { data: deletedUser, error } = await authClient.admin.removeUser({
      userId: user.id,
    });

    if (error) {
      toast.error("An error occurred deleting this user.", {
        description: error.message,
      });
    }

    if (!deletedUser) {
      toast.error("An error occurred deleting this user.", {
        description: "User not found.",
      });
    }

    toast.success("User deleted successfully.");
    router.refresh();
  };

  const handleToggleBan = async () => {
    if (isAdmin) {
      toast.error("Admin accounts cannot be disabled.");
      return;
    }

    if (isBanned) {
      await authClient.admin.unbanUser({ userId: user.id });

      toast.info("User account enabled.", {
        description: `User with email address ${user.email} has been enabled.`,
      });
    } else {
      await authClient.admin.banUser({
        userId: user.id,
        banReason: "Banned via admin panel.",
      });

      toast.info("User account disabled.", {
        description: `User with email address ${user.email} has been disabled.`,
      });
    }

    router.refresh();
  };

  return (
    <div className="flex space-x-2">
      <Button
        title={isBanned ? "Enable User" : "Disable User"}
        variant="secondary"
        size="icon"
        className="size-4 cursor-pointer"
        onClick={handleToggleBan}
      >
        {isBanned ? (
          <ShieldCheckIcon className="size-4" />
        ) : (
          <ShieldBanIcon className="size-4" />
        )}
      </Button>

      <Button
        title="Delete User"
        variant="secondary"
        size="icon"
        className="size-4 cursor-pointer"
        onClick={handleDelete}
      >
        <TrashIcon />
      </Button>
    </div>
  );
};

export default UserTableActions;
