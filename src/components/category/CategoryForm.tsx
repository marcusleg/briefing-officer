"use client";

import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  createCategory,
  updateCategory,
} from "@/lib/repository/feedRepository";
import { categorySchema, CategorySchema } from "@/lib/repository/feedSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { FeedCategory } from "@prisma/client";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

interface CategoryFormProps {
  editCategory?: FeedCategory;
  onSubmitComplete: () => void;
}

const CategoryForm = ({
  editCategory,
  onSubmitComplete,
}: CategoryFormProps) => {
  const form = useForm<CategorySchema>({
    resolver: zodResolver(categorySchema),
    defaultValues: editCategory
      ? { name: editCategory.name }
      : {
          name: "",
        },
  });

  const [submitting, setSubmitting] = useState(false);

  const submitHandler = async (values: CategorySchema) => {
    setSubmitting(true);
    editCategory
      ? await updateCategory(editCategory.id, values)
      : await createCategory(values);
    setSubmitting(false);
    onSubmitComplete();
  };

  const submitButtonText = editCategory ? "Update" : "Create";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitHandler)}>
        <div className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter category name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-row justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button disabled={submitting} type="submit">
              {submitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                submitButtonText
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
};

export default CategoryForm;
