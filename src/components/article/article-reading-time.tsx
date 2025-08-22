import { ClockIcon, FileTextIcon } from "lucide-react";

export interface ArticleReadingTimeProps {
  text: string;
  words: number;
}

export const ArticleReadingTime = ({ text, words }: ArticleReadingTimeProps) => {
  return (
    <div className="text-muted-foreground flex items-center gap-4 text-xs">
      <span className="flex items-center gap-1">
        <ClockIcon className="mr-1 h-3 w-3" />
        {text}
      </span>

      <span className="flex items-center gap-1">
        <FileTextIcon className="mr-1 h-3 w-3" />
        {words} words
      </span>
    </div>
  );
};

export default ArticleReadingTime;
