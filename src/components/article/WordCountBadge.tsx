import { Badge } from "@/components/ui/badge";
import { LetterText } from "lucide-react";

interface WordCountBadgeProps {
  words: number;
}

export const WordCountBadge = ({ words }: WordCountBadgeProps) => (
  <Badge className="text-muted-foreground" variant="outline">
    <LetterText className="mr-2 h-4 w-4" />
    {words} words
  </Badge>
);
