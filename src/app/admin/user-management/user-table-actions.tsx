"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface UserListActionsProps {
  userId: string;
}

const UserTableActions = ({ userId }: UserListActionsProps) => {
  const router = useRouter();

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    const { data: deletedUser, error } = await authClient.admin.removeUser({
      userId,
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

  return (
    <>
      <Button
        variant="secondary"
        size="icon"
        className="size-4"
        onClick={handleDelete}
      >
        <TrashIcon />
      </Button>
    </>
  );
};

export default UserTableActions;
