"use server";

import UserTableActions from "@/app/admin/user-management/user-table-actions";
import IntlRelativeTime from "@/components/IntlRelativeTime";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { CheckIcon, ShieldBanIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { headers } from "next/headers";

const UserTable = async () => {
  const { users, total } = await auth.api.listUsers({
    query: {
      sortBy: "name",
      sortDirection: "desc",
    },
    headers: await headers(),
  });

  return (
    <Table>
      <TableCaption>List of registered users.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="text-center">Enabled</TableHead>
          <TableHead className="w-[100px]">Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead className="text-center">Email Verified</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Signed up</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="flex justify-center">
              {user.banned ? (
                <ShieldBanIcon className="size-4 text-red-800" />
              ) : (
                <ShieldCheckIcon className="size-4 text-green-800" />
              )}
            </TableCell>
            <TableCell>{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell className="flex justify-center">
              {user.emailVerified ? (
                <CheckIcon className="size-4" />
              ) : (
                <XIcon className="size-4" />
              )}
            </TableCell>
            <TableCell>{user.role}</TableCell>
            <TableCell>
              <IntlRelativeTime date={user.createdAt} />
            </TableCell>
            <TableCell>
              <UserTableActions user={user} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default UserTable;
