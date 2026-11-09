"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const ProfileForm = ({ name, email }: { name: string; email: string }) => {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const formSchema = z.object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .refine((value) => value !== name, "That's already your name"),
  });
  type FormData = z.infer<typeof formSchema>;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name },
  });

  const submitHandler = async (values: FormData) => {
    setSubmitting(true);
    try {
      const result = await authClient.updateUser({ name: values.name });

      if (result.error) {
        toast.error(result.error.message || "Could not update your name");
        return;
      }

      toast.success("Name updated");
      router.refresh();
    } catch {
      toast.error("Failed to update name");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitHandler)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  disabled={submitting}
                  placeholder="Enter your name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Better Auth can only change a verified address by mailing a
            confirmation link, and this app sends no mail. */}
        <div className="grid gap-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input
            id="profile-email"
            type="email"
            value={email}
            readOnly
            aria-describedby="profile-email-description"
          />
          <p
            id="profile-email-description"
            className="text-muted-foreground text-sm"
          >
            Your email address can&apos;t be changed.
          </p>
        </div>
        <Button type="submit" className="cursor-pointer" disabled={submitting}>
          {submitting ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            "Save"
          )}
        </Button>
      </form>
    </Form>
  );
};

export default ProfileForm;
