"use client";
import * as React from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Visibility } from "@/lib/enums";
import { ShareExternal } from "./ShareExternal";

export function ShareEventButton({
  slug,
  title,
  visibility,
}: {
  eventId: string;
  slug: string;
  title: string;
  visibility: Visibility;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4" />
          分享
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>分享活动</DialogTitle>
          <DialogDescription>把「{title}」通过链接分享到站外。</DialogDescription>
        </DialogHeader>
        <ShareExternal slug={slug} title={title} visibility={visibility} />
      </DialogContent>
    </Dialog>
  );
}
