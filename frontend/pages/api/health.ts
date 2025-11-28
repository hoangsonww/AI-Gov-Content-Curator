import type { NextApiRequest, NextApiResponse } from "next";

interface HealthCheckResponse {
  status: string;
  uptime: number;
  timestamp: number;
  environment: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthCheckResponse>,
) {
  const healthCheck: HealthCheckResponse = {
    status: "OK",
    uptime: process.uptime(),
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || "development",
  };

  res.status(200).json(healthCheck);
}
