"use client";

import AudioPlayer from "@/components/article/AudioPlayer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSpeechSynthesis } from "@/lib/polly";
import { Article } from "@prisma/client";
import { LoaderCircle, Speech } from "lucide-react";
import { useState } from "react";

interface ReadAloudButtonProps {
  article: Article;
}

const ReadAloudButton = ({ article }: ReadAloudButtonProps) => {
  const [synthesisInProgress, setSynthesisInProgress] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleClick = async () => {
    setSynthesisInProgress(true);
    await getSpeechSynthesis(article.feedId, article.id);
    setSynthesisInProgress(false);

    setDialogOpen(true);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <Button
        disabled={synthesisInProgress}
        size="sm"
        variant="outline"
        onClick={handleClick}
      >
        {synthesisInProgress ? (
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Speech className="mr-2 h-4 w-4" />
        )}
        Read aloud
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{article.title}</DialogTitle>
          <DialogDescription>
            <AudioPlayer src={`/tts/${article.id}.ogg`} />
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};

export default ReadAloudButton;
