"use client";

import { useAuth } from "@/providers/auth-provider";
import { generateVCard } from "@/lib/vcard";
import QRCode from "react-qr-code";
import { Card, CardContent } from "@/components/ui/card";

export function AttendeeQrCode() {
  const { user, profile } = useAuth();

  if (!user || !profile?.first_name || !profile?.last_name) {
    return null;
  }

  const vcard = generateVCard(
    profile.email,
    profile.first_name,
    profile.last_name
  );

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-col items-center py-6">
        <div className="rounded-lg bg-white p-3">
          <QRCode
            value={vcard}
            size={180}
            bgColor="#FFFFFF"
            fgColor="#1B1D23"
          />
        </div>
        <p className="mt-3 text-sm font-medium">Your Badge QR Code</p>
        <p className="text-xs text-muted-foreground">
          Show this to sponsors to share your contact info
        </p>
      </CardContent>
    </Card>
  );
}
