"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWhop } from "@whop/react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const socket = io();

const assets = ["EURUSD", "GBPUSD", "XAUUSD"];

export default function Dashboard({ params }: { params: { experienceId: string } }) {
  const { user } = useWhop();
  const [signals, setSignals] = useState<{ [key: string]: any }>({});
  const [charts, setCharts] = useState<{ [key: string]: any }>({});
  const [settings, setSettings] = useState({
    riskLevel: "medium",
    preferredAssets: assets,
    notifications: true,
  });

  useEffect(() => {
    if (user) {
      const userDoc = doc(db, "users", user.id);
      getDoc(userDoc).then((snap) => {
        if (snap.exists()) {
          setSettings(snap.data() as any);
        }
      });
    }
  }, [user]);

  useEffect(() => {
    socket.on("signals", (newSignals) => {
      setSignals(newSignals);
      if (settings.notifications) {
        // TODO: send push notification
        console.log("New signals received", newSignals);
      }
    });

    // Fetch historical data for charts
    assets.forEach(async (asset) => {
      const res = await fetch(`/api/data/${asset}`);
      const data = await res.json();
      if (data["Time Series FX (Daily)"]) {
        const labels = Object.keys(data["Time Series FX (Daily)"]).slice(0, 30).reverse();
        const prices = labels.map((date) => parseFloat(data["Time Series FX (Daily)"][date]["4. close"]));
        setCharts((prev) => ({
          ...prev,
          [asset]: {
            labels,
            datasets: [{
              label: `${asset} Price`,
              data: prices,
              borderColor: "rgb(75, 192, 192)",
              tension: 0.1,
            }],
          },
        }));
      }
    });

    return () => {
      socket.off("signals");
    };
  }, []);

  const updateSettings = async (newSettings: any) => {
    setSettings(newSettings);
    if (user) {
      await setDoc(doc(db, "users", user.id), newSettings);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Trading Bot Dashboard</h1>
      <p className="text-red-500 mb-4">
        Disclaimer: Trading involves risk. This is not financial advice. Use at your own risk.
      </p>

      <Tabs defaultValue="signals">
        <TabsList>
          <TabsTrigger value="signals">Signals</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="signals">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {assets.map((asset) => (
              <Card key={asset}>
                <CardHeader>
                  <CardTitle>{asset}</CardTitle>
                </CardHeader>
                <CardContent>
                  {signals[asset] ? (
                    <>
                      <p>Signal: {signals[asset].signal.toUpperCase()}</p>
                      <p>Stop Loss: {signals[asset].sl}</p>
                      <p>Take Profit: {signals[asset].tp}</p>
                      <p>Time: {signals[asset].timestamp}</p>
                    </>
                  ) : (
                    <p>No signal yet</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="charts">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {assets.map((asset) => (
              <Card key={asset}>
                <CardHeader>
                  <CardTitle>{asset} Chart</CardTitle>
                </CardHeader>
                <CardContent>
                  {charts[asset] ? <Line data={charts[asset]} /> : <p>Loading chart...</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>User Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="notifications">Enable Notifications</Label>
                <Switch
                  id="notifications"
                  checked={settings.notifications}
                  onCheckedChange={(checked) => updateSettings({ ...settings, notifications: checked })}
                />
              </div>
              <div>
                <Label htmlFor="riskLevel">Risk Level</Label>
                <Select
                  value={settings.riskLevel}
                  onValueChange={(value) => updateSettings({ ...settings, riskLevel: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select risk level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Add more settings like preferred assets */}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}