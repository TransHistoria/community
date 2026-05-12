"use client";
import * as React from "react";
import QRCode from "qrcode";
import { Copy, Share2, QrCode, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-context";
import type { Visibility } from "@/lib/enums";
import { toQueryRoute } from "@/lib/query-routing";

export function ShareExternal({
  slug,
  title,
  visibility,
}: {
  slug: string;
  title: string;
  visibility: Visibility;
}) {
  const { toast } = useToast();
  const [url, setUrl] = React.useState("");
  const [qr, setQr] = React.useState<string | null>(null);
  const [showQr, setShowQr] = React.useState(false);
  const canWebShare =
    typeof navigator !== "undefined" && "share" in navigator;

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setUrl(`${window.location.origin}${toQueryRoute(`/events/${slug}`)}`);
    }
  }, [slug]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "链接已复制", variant: "success" });
    } catch {
      toast({ title: "复制失败", description: url, variant: "danger" });
    }
  }

  async function nativeShare() {
    try {
      await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
        title,
        text: `推荐一个社群活动：${title}`,
        url,
      });
    } catch {
      // user cancelled or unsupported — silent
    }
  }

  async function toggleQr() {
    if (!showQr && !qr) {
      try {
        const dataUrl = await QRCode.toDataURL(url, {
          margin: 1,
          width: 320,
          color: { dark: "#1F1B17", light: "#FFFFFF" },
        });
        setQr(dataUrl);
      } catch {
        toast({ title: "生成二维码失败", variant: "danger" });
        return;
      }
    }
    setShowQr((v) => !v);
  }

  return (
    <div className="space-y-3">
      {visibility !== "PUBLIC" ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p className="leading-relaxed">
            此活动仅对
            {visibility === "VERIFIED" ? "认证成员" : "信任成员"}
            可见。链接可以复制，但未登录或权限不足的访客打开后会看到 404。
            如要带新成员加入，建议先发邀请码。
          </p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label className="text-xs text-ink-muted">活动链接</label>
        <div className="flex gap-2">
          <Input value={url} readOnly className="font-mono text-xs" />
          <Button onClick={copy} variant="outline" size="icon" aria-label="复制">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={toggleQr}
          className="justify-start"
        >
          <QrCode className="h-4 w-4" />
          {showQr ? "隐藏二维码" : "二维码"}
        </Button>
        {canWebShare ? (
          <Button
            variant="outline"
            onClick={nativeShare}
            className="justify-start"
          >
            <Share2 className="h-4 w-4" />
            系统分享
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={copy}
            className="justify-start"
          >
            <Copy className="h-4 w-4" />
            复制链接
          </Button>
        )}
      </div>

      {showQr && qr ? (
        <div className="flex justify-center pt-2">
          <div className="rounded-lg border border-border bg-white p-3">
            <img src={qr} alt="活动链接二维码" width={240} height={240} />
          </div>
        </div>
      ) : null}

      <p className="text-xs text-ink-subtle leading-relaxed pt-2">
        提示：精确地址、会议链接永远只对报名通过的成员可见，
        即使分享出去的链接被未授权者打开，也看不到这些敏感信息。
      </p>
    </div>
  );
}
