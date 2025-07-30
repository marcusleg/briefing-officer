"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";

const BackButton = () => {
  const router = useRouter();

  return (
    <Button variant="ghost" size="sm" onClick={router.back} className="text-xs">
      <ArrowLeftIcon className="mr-1 h-4 w-4" />
      Back
    </Button>
  );
};

export default BackButton;
