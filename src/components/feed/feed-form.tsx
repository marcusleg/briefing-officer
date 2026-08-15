"use client";

import KeywordListField from "@/components/feed/keyword-list-field";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Feed, FeedCategory } from "@/generated/prisma/client";
import { describeFilters } from "@/lib/feedFilters";
import {
  createFeed,
  getFeedFilters,
  getUserCategories,
  updateFeed,
} from "@/lib/repository/feedRepository";
import { feedSchema, FeedSchema } from "@/lib/repository/feedSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

interface FeedFormProps {
  editFeed?: Feed;
  onSubmitComplete: () => void;
}

const FeedForm = ({ editFeed, onSubmitComplete }: FeedFormProps) => {
  const [categories, setCategories] = useState<FeedCategory[]>([]);

  const form = useForm<z.input<typeof feedSchema>, unknown, FeedSchema>({
    resolver: zodResolver(feedSchema),
    defaultValues: editFeed
      ? {
          title: editFeed.title,
          link: editFeed.link,
          interests: [],
          disinterests: [],
          feedCategoryId: editFeed.feedCategoryId ?? undefined,
          autoRefresh: editFeed.autoRefresh,
        }
      : {
          title: "",
          link: "",
          interests: [],
          disinterests: [],
          feedCategoryId: undefined,
          autoRefresh: true,
        },
  });

  const [submitting, setSubmitting] = useState(false);

  const interests = useWatch({ control: form.control, name: "interests" });
  const disinterests = useWatch({
    control: form.control,
    name: "disinterests",
  });

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

  useEffect(() => {
    if (!editFeed) {
      return;
    }

    getFeedFilters(editFeed.id).then(({ interests, disinterests }) => {
      form.setValue("interests", interests);
      form.setValue("disinterests", disinterests);
    });
  }, [editFeed, form]);

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
                    disabled={submitting}
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
                  <Input
                    disabled={submitting}
                    placeholder="http://example.org/feed.xml"
                    {...field}
                  />
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
                    disabled={submitting}
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
            name="interests"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interested in</FormLabel>
                <FormControl>
                  <KeywordListField
                    disabled={submitting}
                    inputLabel="Add an interest"
                    onChange={field.onChange}
                    placeholder="Linux kernel development"
                    value={field.value ?? []}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="disinterests"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Not interested in</FormLabel>
                <FormControl>
                  <KeywordListField
                    disabled={submitting}
                    inputLabel="Add a disinterest"
                    onChange={field.onChange}
                    placeholder="USB driver development"
                    value={field.value ?? []}
                  />
                </FormControl>
                <FormDescription>
                  {describeFilters(interests ?? [], disinterests ?? [])} When
                  both lists speak to an article, the more specific entry wins.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="autoRefresh"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <FormLabel>Refresh Automatically</FormLabel>
                  <p className="text-muted-foreground text-sm">
                    When disabled, this feed is skipped during automatic
                    refresh.
                  </p>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={submitting}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex flex-row justify-end gap-2">
            <DialogClose asChild>
              <Button
                className="w-24 cursor-pointer"
                disabled={submitting}
                variant="secondary"
              >
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
