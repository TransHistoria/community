"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { api } from "@/lib/api";

export function ExportButton() {
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const data = await api.users.exportMe();
          const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        } finally {
          setPending(false);
        }
      }}
    >
      <Download className="h-4 w-4" />
      {pending ? "正在打包..." : "下载我的数据 (JSON)"}
    </Button>
  );
}
