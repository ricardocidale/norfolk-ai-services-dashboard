"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getShowCharts, setShowCharts } from "@/lib/dashboard-prefs";

export function DisplayPrefsCard() {
  const [charts, setCharts] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCharts(getShowCharts());
    setMounted(true);
  }, []);

  const toggle = (v: boolean) => {
    setCharts(v);
    setShowCharts(v);
  };

  if (!mounted) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Display preferences</CardTitle>
        <CardDescription>
          Toggle visual elements on the main dashboard. Changes are saved in
          your browser and take effect immediately on next visit.
        </CardDescription>
        <div className="flex items-center gap-3 pt-4">
          <Switch
            id="toggle-charts"
            checked={charts}
            onCheckedChange={toggle}
          />
          <Label htmlFor="toggle-charts" className="cursor-pointer">
            Show charts on dashboard
          </Label>
        </div>
      </CardHeader>
    </Card>
  );
}
