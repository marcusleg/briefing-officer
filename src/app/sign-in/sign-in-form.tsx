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
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof formSchema>;

const SignInForm = () => {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const submitHandler = async (values: FormData) => {
    setSubmitting(true);

    const result = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });

    if (result.error) {
      toast.error("Sign-In Error", {
        description: result.error.message,
      });

      setSubmitting(false);

      return;
    }

    toast.success("Sign-In Successful");

    setSubmitting(false);

    router.push("/feed");
    router.refresh();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitHandler)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Enter your email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            "Login"
          )}
        </Button>
      </form>
    </Form>
  );
};

export default SignInForm;
