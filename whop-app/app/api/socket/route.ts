import { Server } from "socket.io";
import { NextApiResponseServerIo } from "@/types";
import { generateSignals, getLastSignals } from "@/lib/tradingService";

export const dynamic = "force-dynamic";

let interval: NodeJS.Timeout | null = null;

const ioHandler = (req: Request, res: NextApiResponseServerIo) => {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server as any, {
      path: "/api/socket/io",
      addTrailingSlash: false,
    });

    res.socket.server.io = io;

    io.on("connection", (socket) => {
      console.log("Client connected", socket.id);
      // Send current signals on connection
      socket.emit("signals", getLastSignals());

      socket.on("disconnect", () => {
        console.log("Client disconnected", socket.id);
      });
    });

    // Start polling if not already
    if (!interval) {
      interval = setInterval(async () => {
        const signals = await generateSignals();
        io.emit("signals", signals);
      }, 5 * 60 * 1000); // Every 5 minutes
    }
  }

  res.end();
};

export { ioHandler as GET, ioHandler as POST };