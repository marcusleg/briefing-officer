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
import { Textarea } from "@/components/ui/textarea";
import {
  createFeed,
  getUserCategories,
  updateFeed,
} from "@/lib/repository/feedRepository";
import { feedSchema, FeedSchema } from "@/lib/repository/feedSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Feed, FeedCategory } from "../../../prisma/generated/prisma/client";

interface FeedFormProps {
  editFeed?: Feed;
  onSubmitComplete: () => void;
}

const FeedForm = ({ editFeed, onSubmitComplete }: FeedFormProps) => {
  const [categories, setCategories] = useState<FeedCategory[]>([]);

  const form = useForm<FeedSchema>({
    resolver: zodResolver(feedSchema),
    defaultValues: editFeed
      ? {
          title: editFeed.title,
          link: editFeed.link,
          titleFilterExpressions: editFeed.titleFilterExpressions,
          feedCategoryId: editFeed.feedCategoryId ?? undefined,
        }
      : {
          title: "",
          link: "",
          titleFilterExpressions: "",
          feedCategoryId: undefined,
        },
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const userCategories = await getUserCategories();
        setCategories(userCategories);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      }
    };

    fetchCategories();
  }, []);

  const submitHandler = async (values: FeedSchema) => {
    setSubmitting(true);
    editFeed ? await updateFeed(editFeed.id, values) : await createFeed(values);
    setSubmitting(false);
    onSubmitComplete();
  };

  const submitButtonText = editFeed ? "Update" : "Create";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitHandler)}>
        <div className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input
                    placeholder="leave empty for auto-detection"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="link"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Feed URL</FormLabel>
                <FormControl>
                  <Input placeholder="http://example.org/feed.xml" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="feedCategoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    value={field.value || ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value=""></option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="titleFilterExpressions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title Filter Expressions</FormLabel>
                <FormControl>
                  <Textarea
                    className="resize-none"
                    placeholder={`^(Advertisement: |Sponsored: ).+$
^.*NSFW.*$`}
                    rows={5}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-row justify-end gap-2">
            <DialogClose asChild>
              <Button className="w-24 cursor-pointer" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button
              className="w-24 cursor-pointer"
              disabled={submitting}
              type="submit"
            >
              {submitting ? (
                <LoaderCircle className="size-4 animate-spin" />
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

export default FeedForm;
