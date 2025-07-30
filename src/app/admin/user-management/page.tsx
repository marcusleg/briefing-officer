import UserTable from "@/app/admin/user-management/user-table";
import TopNavigation from "@/components/navigation/TopNavigation";

const AdminPage = async () => {
  return (
    <div className="flex flex-col gap-4">
      <TopNavigation
        segments={[{ name: "Administration" }]}
        page="User Management"
      />

      <h2 className="text-3xl font-bold tracking-tight">User Management</h2>

      <UserTable />
    </div>
  );
};

export default AdminPage;
