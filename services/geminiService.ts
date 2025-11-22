import { Stop, RouteCalculationResult } from "../types";

// Configuration for OpenStreetMap Services
// Note: These are public demo servers. For high-volume production, use a paid provider or self-hosted instance.
const NOMINATIM_API = "https://nominatim.openstreetmap.org/search";
const OSRM_API = "https://router.project-osrm.org";

interface GeoPoint {
  id: string;
  address: string;
  lat: number;
  lon: number;
}

/**
 * Calculates the distance between two points (Haversine formula)
 * Used for client-side optimization (Nearest Neighbor)
 */
const getDirectDistance = (p1: GeoPoint, p2: GeoPoint) => {
  const R = 6371; // Earth radius in km
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLon = (p2.lon - p1.lon) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Geocodes an address string to coordinates using Nominatim
 */
const geocodeAddress = async (stop: Stop): Promise<GeoPoint> => {
  try {
    const url = `${NOMINATIM_API}?format=json&q=${encodeURIComponent(stop.address)}&limit=1&countrycodes=br`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LogiCalcApp/1.0' // Required by Nominatim TOS
      }
    });
    
    if (!response.ok) throw new Error("Erro na conexão com serviço de mapas.");
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      throw new Error(`Endereço não localizado: ${stop.address}`);
    }

    return {
      id: stop.id,
      address: stop.address,
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon)
    };
  } catch (error) {
    console.error(error);
    throw new Error(`Falha ao buscar endereço: ${stop.address}`);
  }
};

export const calculateRoute = async (
  stops: Stop[],
  returnToStart: boolean,
  shouldOptimize: boolean
): Promise<RouteCalculationResult> => {
  
  // 1. Geocode all stops concurrently
  const validStops = stops.filter(s => s.address.trim().length > 0);
  const geocodedPoints: GeoPoint[] = [];

  // Using Promise.all for speed, but sequential is safer for rate limits on public APIs. 
  // We'll do sequential to be polite to the public API demo server.
  for (const stop of validStops) {
    const point = await geocodeAddress(stop);
    geocodedPoints.push(point);
    // Small delay to be polite to Nominatim
    await new Promise(r => setTimeout(r, 700)); 
  }

  if (geocodedPoints.length < 2) {
    throw new Error("Mínimo de 2 endereços válidos necessários.");
  }

  // 2. Optimize Route (Nearest Neighbor Greedy Strategy)
  // We assume P1 (Index 0) is fixed as the Start point.
  let orderedPoints: GeoPoint[] = [];
  
  if (shouldOptimize && geocodedPoints.length > 2) {
    const unvisited = [...geocodedPoints.slice(1)];
    let current = geocodedPoints[0];
    orderedPoints = [current];

    while (unvisited.length > 0) {
      let nearestIndex = -1;
      let minInfoDist = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const dist = getDirectDistance(current, unvisited[i]);
        if (dist < minInfoDist) {
          minInfoDist = dist;
          nearestIndex = i;
        }
      }

      if (nearestIndex !== -1) {
        current = unvisited[nearestIndex];
        orderedPoints.push(current);
        unvisited.splice(nearestIndex, 1);
      }
    }
  } else {
    // Maintain original order
    orderedPoints = [...geocodedPoints];
  }

  // 3. Handle Return to Start
  // We don't add the point physically to the optimized list ID list (to keep display clean), 
  // but we add it to the routing coordinates.
  const routingPoints = [...orderedPoints];
  if (returnToStart) {
    routingPoints.push(orderedPoints[0]);
  }

  // 4. Call OSRM for Routing
  // Format: lon,lat;lon,lat
  const coordinatesString = routingPoints.map(p => `${p.lon},${p.lat}`).join(';');
  const routeUrl = `${OSRM_API}/route/v1/driving/${coordinatesString}?overview=false`;

  const routeResponse = await fetch(routeUrl);
  const routeData = await routeResponse.json();

  if (routeData.code !== 'Ok' || !routeData.routes || routeData.routes.length === 0) {
    throw new Error("Não foi possível calcular a rota rodoviária entre os pontos informados.");
  }

  const route = routeData.routes[0];
  const totalDistanceMeters = route.distance;
  const totalDurationSeconds = route.duration;

  // 5. Calculate Final Values
  const totalDistanceKm = parseFloat((totalDistanceMeters / 1000).toFixed(2)); // Round to 2 decimals
  const totalDurationMin = Math.ceil(totalDurationSeconds / 60);

  // --- PRICE CALCULATION LOGIC ---
  // Rule 1: 0 to 10 km -> R$ 1.20 per km
  // Rule 2: 11 km and above -> R$ 1.00 per km
  let distanceCost = 0;
  if (totalDistanceKm <= 10) {
    distanceCost = totalDistanceKm * 1.20;
  } else {
    // First 10km at 1.20, rest at 1.00
    distanceCost = (10 * 1.20) + ((totalDistanceKm - 10) * 1.00);
  }

  // Rule 3: 40% surcharge on the value
  // We apply 40% on top of the distance-based cost
  let valueWithSurcharge = distanceCost * 1.40;

  // Rule 4: Additional stop fee
  // "a partir do ponto 3 ter taxa adcional de 2,00 por ponto"
  // validStops includes Start and End. So if length > 2, we have extra stops.
  const extraStopsCount = Math.max(0, validStops.length - 2);
  const extraStopsFee = extraStopsCount * 2.00;

  let totalCalculated = valueWithSurcharge + extraStopsFee;

  // Rule 5: Minimum value R$ 7.00
  if (totalCalculated < 7.00) {
    totalCalculated = 7.00;
  }

  const estimatedPrice = parseFloat(totalCalculated.toFixed(2));

  // 6. Construct Google Maps URL
  // Format: https://www.google.com/maps/dir/lat,lon/lat,lon/...
  const mapPath = routingPoints.map(p => `${p.lat},${p.lon}`).join('/');
  const mapUrl = `https://www.google.com/maps/dir/${mapPath}`;

  return {
    totalDistanceKm,
    totalDurationMin,
    estimatedPrice,
    mapUrl,
    segments: [], // Not currently used in UI
    optimizedOrder: shouldOptimize ? orderedPoints.map(p => p.id) : undefined
  };
};