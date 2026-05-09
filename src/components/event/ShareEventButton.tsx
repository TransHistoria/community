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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Visibility } from "@/lib/enums";
import { ShareToUser } from "./ShareToUser";
import { ShareExternal } from "./ShareExternal";

export function ShareEventButton({
  eventId,
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
          <DialogDescription>
            把「{title}」推荐给社群成员，或通过链接分享到站外。
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="internal" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="internal" className="flex-1">
              站内推荐
            </TabsTrigger>
            <TabsTrigger value="external" className="flex-1">
              站外分享
            </TabsTrigger>
          </TabsList>
          <TabsContent value="internal">
            <ShareToUser eventId={eventId} onDone={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="external">
            <ShareExternal slug={slug} title={title} visibility={visibility} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
