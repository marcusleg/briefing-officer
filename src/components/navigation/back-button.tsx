"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";

const BackButton = () => {
  const router = useRouter();

  return (
    <Button
      className="cursor-pointer text-xs"
      onClick={router.back}
      size="sm"
      variant="ghost"
    >
      <ArrowLeftIcon className="mr-1 size-4" />
      Back
    </Button>
  );
};

export default BackButton;
