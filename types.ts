export interface Stop {
  id: string;
  address: string;
  observation?: string; // New field for user notes
  label?: string; // e.g., "Ponto 1 - Coleta"
}

export interface RouteCalculationResult {
  totalDistanceKm: number;
  totalDurationMin: number;
  estimatedPrice: number;
  mapUrl: string;
  segments: {
    from: string;
    to: string;
    distance: string;
  }[];
  optimizedOrder?: string[]; // IDs in order
}

export interface DeliveryRequest {
  id: string;
  requesterName: string;
  stops: Stop[];
  returnToStart: boolean;
  optimizeRoute: boolean;
  isScheduled: boolean;
  scheduledDate?: string;
  scheduledTime?: string;
  result: RouteCalculationResult | null;
  createdAt: number;
}