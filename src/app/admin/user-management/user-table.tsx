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
import { CheckIcon, XIcon } from "lucide-react";
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
            <TableCell>{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell className="flex justify-center">
              {user.emailVerified ? (
                <CheckIcon className="h-4 w-4" />
              ) : (
                <XIcon className="h-4 w-4" />
              )}
            </TableCell>
            <TableCell>{user.role}</TableCell>
            <TableCell>
              <IntlRelativeTime date={user.createdAt} />
            </TableCell>
            <TableCell>
              <UserTableActions userId={user.id} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default UserTable;
