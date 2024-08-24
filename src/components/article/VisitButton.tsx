import { Button, buttonVariants } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import React from "react";

interface VisitButtonProps {
  link: string;
  size?: React.ComponentProps<typeof Button>["size"];
}

const VisitButton = ({ link, size }: VisitButtonProps) => {
  return (
    <Link
      className={buttonVariants({
        size: size ? size : "default",
        variant: "outline",
      })}
      href={link}
      referrerPolicy="no-referrer"
    >
      <ExternalLink className="mr-2 h-4 w-4" />
      Visit
    </Link>
  );
};

export default VisitButton;
