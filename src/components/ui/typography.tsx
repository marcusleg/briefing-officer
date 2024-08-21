import { cn } from "@/lib/utils";

interface TypographyProps {
  children: React.ReactNode;
  className?: string;
  variant?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p";
}

const Typography = ({ children, className, variant }: TypographyProps) => {
  if (variant === "h1") {
    return (
      <h1
        className={cn(
          "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
          className,
        )}
      >
        {children}
      </h1>
    );
  }

  if (variant === "h2") {
    return (
      <h2
        className={cn(
          "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
          className,
        )}
      >
        {children}
      </h2>
    );
  }

  if (variant === "h3") {
    return (
      <h3
        className={cn(
          "scroll-m-20 text-2xl font-semibold tracking-tight",
          className,
        )}
      >
        {children}
      </h3>
    );
  }

  if (variant === "h4") {
    return (
      <h4
        className={cn(
          "scroll-m-20 text-xl font-semibold tracking-tight",
          className,
        )}
      >
        {children}
      </h4>
    );
  }

  if (variant === "h5") {
    return (
      <h4
        className={cn(
          "scroll-m-20 text-lg font-semibold tracking-tight",
          className,
        )}
      >
        {children}
      </h4>
    );
  }

  if (variant === "h6") {
    return (
      <h4
        className={cn(
          "scroll-m-20 text-base font-semibold tracking-tight",
          className,
        )}
      >
        {children}
      </h4>
    );
  }

  return (
    <p className={cn("leading-7 [&:not(:first-child)]:mt-6", className)}>
      {children}
    </p>
  );
};

export default Typography;
