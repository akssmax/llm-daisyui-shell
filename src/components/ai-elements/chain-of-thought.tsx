"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2Icon, ChevronDownIcon, CircleIcon, Loader2Icon, SearchIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export type ChainOfThoughtProps = ComponentProps<"div"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ChainOfThought({
  className,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  ...props
}: ChainOfThoughtProps) {
  return (
    <div className={cn("not-prose mb-4", className)} {...props}>
      <Collapsible open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        {children}
      </Collapsible>
    </div>
  );
}

export function ChainOfThoughtHeader({
  className,
  children,
  ...props
}: ComponentProps<typeof CollapsibleTrigger>) {
  return (
    <CollapsibleTrigger
      className={cn(
        "group flex w-full items-center justify-between gap-2 text-left text-sm text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    >
      <span className="flex items-center gap-2 font-medium">
        <SearchIcon className="size-4" />
        {children ?? "Chain of Thought"}
      </span>
      <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  );
}

export function ChainOfThoughtContent({
  className,
  ...props
}: ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      className={cn(
        "mt-3 space-y-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:animate-in data-[state=open]:slide-in-from-top-2",
        className
      )}
      {...props}
    />
  );
}

export type ChainOfThoughtStepProps = ComponentProps<"div"> & {
  icon?: ReactNode;
  label: string;
  description?: string;
  status?: "complete" | "active" | "pending";
};

export function ChainOfThoughtStep({
  className,
  icon,
  label,
  description,
  status = "complete",
  ...props
}: ChainOfThoughtStepProps) {
  const statusIcon =
    status === "complete" ? (
      <CheckCircle2Icon className="size-4 text-green-600" />
    ) : status === "active" ? (
      <Loader2Icon className="size-4 animate-spin text-blue-600" />
    ) : (
      <CircleIcon className="size-4 text-muted-foreground" />
    );

  return (
    <div
      className={cn("rounded-md border border-border bg-card px-3 py-2", className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        {icon ?? statusIcon}
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function ChainOfThoughtSearchResults({
  className,
  ...props
}: ComponentProps<"div">) {
  return <div className={cn("mt-2 flex flex-wrap gap-2", className)} {...props} />;
}

export function ChainOfThoughtSearchResult({
  className,
  ...props
}: ComponentProps<typeof Badge>) {
  return <Badge variant="secondary" className={cn("rounded-full text-xs", className)} {...props} />;
}

export function ChainOfThoughtImage({
  className,
  caption,
  children,
  ...props
}: ComponentProps<"div"> & { caption?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-2", className)} {...props}>
      {children}
      {caption ? <p className="mt-2 text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

