"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OpmlImportResult } from "@/lib/opml";
import { importOpml } from "@/lib/repository/opmlRepository";
import { LoaderCircle } from "lucide-react";
import { FormEvent, useRef, useState } from "react";

interface ImportOpmlDialogTriggerProps {
  children: React.ReactNode;
}

const ACCEPTED_TYPES = ".opml,.xml,text/xml,application/xml,text/x-opml";

const count = (n: number, singular: string, pluralForm = `${singular}s`) =>
  `${n} ${n === 1 ? singular : pluralForm}`;

const summarise = (result: Extract<OpmlImportResult, { ok: true }>) =>
  `Imported ${count(result.imported, "feed")}. ` +
  `Skipped ${result.skipped} you already had. ` +
  `${count(result.categoriesCreated, "category", "categories")} created.`;

const ImportOpmlDialogTrigger = ({
  children,
}: ImportOpmlDialogTriggerProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<OpmlImportResult | null>(null);
  // Identifies the current import so a dismissed dialog can ignore a result
  // that resolves after the reader has already walked away, rather than
  // showing a stale summary the next time the dialog opens.
  const requestRef = useRef(0);

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      requestRef.current += 1;
      setFile(null);
      setResult(null);
      setImporting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      return;
    }

    const token = ++requestRef.current;
    setImporting(true);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const outcome = await importOpml(formData);
      if (requestRef.current === token) {
        setResult(outcome);
      }
    } catch {
      // Next.js masks the message of an error thrown by a server action in
      // production, so there is nothing more specific to show here.
      if (requestRef.current === token) {
        setResult({ ok: false, error: "Importing failed. Please try again." });
      }
    } finally {
      if (requestRef.current === token) {
        setImporting(false);
      }
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import OPML</DialogTitle>
          <DialogDescription>
            Subscribe to every feed in an OPML file exported from another
            reader. Feeds you already have are left as they are.
          </DialogDescription>
        </DialogHeader>

        {result?.ok ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">{summarise(result)}</p>
            {result.unusable.length > 0 && (
              <div className="flex flex-col gap-1 text-sm">
                <p>Could not import:</p>
                <ul className="text-muted-foreground list-disc pl-5">
                  {result.unusable.map((title, index) => (
                    <li key={`${index}-${title}`}>{title}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-row justify-end">
              <DialogClose asChild>
                <Button className="w-24 cursor-pointer">Close</Button>
              </DialogClose>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="opml-file">OPML file</Label>
              <Input
                id="opml-file"
                type="file"
                accept={ACCEPTED_TYPES}
                disabled={importing}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>

            {result && !result.ok && (
              <Alert variant="destructive">
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-row justify-end gap-2">
              <DialogClose asChild>
                <Button
                  className="w-24 cursor-pointer"
                  type="button"
                  variant="secondary"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button
                className="w-24 cursor-pointer"
                disabled={importing || !file}
                type="submit"
              >
                {importing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  "Import"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportOpmlDialogTrigger;
