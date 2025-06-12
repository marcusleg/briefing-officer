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
import { createFeed, updateFeed } from "@/lib/repository/feedRepository";
import { feedSchema, FeedSchema } from "@/lib/repository/feedSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Feed } from "@prisma/client";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

interface FeedFormProps {
  editFeed?: Feed;
  onSubmitComplete: () => void;
}

const FeedForm = ({ editFeed, onSubmitComplete }: FeedFormProps) => {
  const form = useForm<FeedSchema>({
    resolver: zodResolver(feedSchema),
    defaultValues: editFeed
      ? { ...editFeed }
      : {
          title: "",
          link: "",
          titleFilterExpressions: "",
        },
  });

  const [submitting, setSubmitting] = useState(false);

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

export default FeedForm;
