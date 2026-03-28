"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGetLinkQr, getGetLinkQrQueryKey } from "@workspace/api-client-react";
import { Download, Loader2 } from "lucide-react";
import type { Link } from "@workspace/api-client-react";

interface QrModalProps {
  link: Link | null;
  onClose: () => void;
}

export function QrModal({ link, onClose }: QrModalProps) {
  const isOpen = !!link;
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const { data, isLoading } = useGetLinkQr(link?.id || "", {
    query: {
      queryKey: getGetLinkQrQueryKey(link?.id || ""),
      enabled: isOpen && !!link?.id,
    }
  });

  const handleDownload = () => {
    if (!data?.svg || !link) return;
    const blob = new Blob([data.svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snipr-qr-${link.slug}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display text-center">QR Code</DialogTitle>
          <DialogDescription className="text-center">
            Scan to visit <span className="font-semibold text-foreground">{data?.shortUrl || (link && `${origin}/r/${link.slug}`)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-6 space-y-8">
          {isLoading ? (
            <div className="w-48 h-48 flex items-center justify-center bg-[#2E2E35] rounded-xl border border-border">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : data?.svg ? (
            <div 
              className="w-56 h-56 bg-[#EFEFF0] p-4 rounded-xl shadow-md border border-border/50 flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: data.svg }} 
            />
          ) : (
            <p className="text-muted-foreground">Failed to load QR code</p>
          )}

          <Button 
            onClick={handleDownload} 
            disabled={!data?.svg}
            className="w-full rounded-xl py-6 text-base font-semibold shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:-translate-y-0.5"
          >
            <Download className="w-5 h-5 mr-2" />
            Download SVG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
