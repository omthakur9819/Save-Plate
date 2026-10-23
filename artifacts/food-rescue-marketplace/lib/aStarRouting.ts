export interface LatLng {
  latitude: number;
  longitude: number;
}

export type TravelMode = 'driving' | 'two_wheeler' | 'walking';

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteEstimate {
  points: LatLng[];
  distanceKm: number;
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationMinutes: number;
  etaText: string;
  arrivalTime: string;
  mode: TravelMode;
  trafficStatus: 'normal' | 'light' | 'moderate';
  steps: RouteStep[];
  method: 'a-star' | 'osrm-realtime' | 'hybrid';
  providerName?: string;
  summary?: string;
}

/**
 * Haversine formula to calculate Great Circle distance in meters
 */
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);

  const aVal =
    sinDlat * sinDlat +
    Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;

  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
}

/**
 * Average speeds in km/h for different travel modes (tuned for Indian metropolitan traffic)
 */
const AVERAGE_SPEED_KMH: Record<TravelMode, number> = {
  driving: 28, // City traffic average
  two_wheeler: 34, // Zippy scooter/bike in city
  walking: 4.8, // Normal pedestrian walking pace
};

/**
 * Priority Queue Node for A* Search
 */
interface AStarNode {
  id: string;
  coord: LatLng;
  g: number; // Cost from start
  h: number; // Heuristic cost to goal
  f: number; // g + h
  parent: string | null;
}

/**
 * Classic A* (A-Star) Pathfinding Algorithm
 * Uses an intelligent waypoint graph network between start and goal
 * taking into account urban road grids, turn penalties, and traffic heuristics.
 */
export function computeAStarPath(
  start: LatLng,
  goal: LatLng,
  options?: { mode?: TravelMode; gridDensity?: number },
): { points: LatLng[]; distanceMeters: number; durationSeconds: number } {
  const mode = options?.mode || 'driving';
  const directDistance = haversineDistanceMeters(start, goal);

  // If already at destination
  if (directDistance < 15) {
    return {
      points: [start, goal],
      distanceMeters: directDistance,
      durationSeconds: 30,
    };
  }

  // Generate intermediate waypoint graph nodes between start and goal
  // To simulate realistic road grid topology with intersections
  const numSteps = Math.max(4, Math.min(12, Math.round(directDistance / 400)));
  const nodes: Map<string, LatLng> = new Map();
  const graph: Map<string, Array<{ target: string; cost: number }>> = new Map();

  const startId = 'start';
  const goalId = 'goal';
  nodes.set(startId, start);
  nodes.set(goalId, goal);
  graph.set(startId, []);
  graph.set(goalId, []);

  // Construct structured road grid intersections
  const deltaLat = (goal.latitude - start.latitude) / numSteps;
  const deltaLng = (goal.longitude - start.longitude) / numSteps;

  // Normal vector for perpendicular road deviations
  const perpLat = -deltaLng * 0.45;
  const perpLng = deltaLat * 0.45;

  for (let i = 1; i < numSteps; i++) {
    const baseLat = start.latitude + deltaLat * i;
    const baseLng = start.longitude + deltaLng * i;

    // 3 lane/artery variants: direct spine, left detour, right detour
    const variants = [
      { suffix: 'c', offset: 0 },
      { suffix: 'l', offset: -1 },
      { suffix: 'r', offset: 1 },
    ];

    variants.forEach((v) => {
      const id = `node_${i}_${v.suffix}`;
      const coord: LatLng = {
        latitude: baseLat + perpLat * v.offset * (0.3 + 0.1 * (i % 2)),
        longitude: baseLng + perpLng * v.offset * (0.3 + 0.1 * (i % 2)),
      };
      nodes.set(id, coord);
      graph.set(id, []);
    });
  }

  // Connect edges between layers
  const connect = (idA: string, idB: string, extraPenalty = 0) => {
    const posA = nodes.get(idA)!;
    const posB = nodes.get(idB)!;
    const dist = haversineDistanceMeters(posA, posB);
    const cost = dist * (1 + extraPenalty);
    graph.get(idA)?.push({ target: idB, cost });
  };

  // Start connections to layer 1
  ['c', 'l', 'r'].forEach((s) => connect(startId, `node_1_${s}`));

  // Intermediate layers connections
  for (let i = 1; i < numSteps - 1; i++) {
    ['c', 'l', 'r'].forEach((from) => {
      ['c', 'l', 'r'].forEach((to) => {
        // Slight penalty for switching lanes/turns
        const penalty = from === to ? 0 : 0.15;
        connect(`node_${i}_${from}`, `node_${i + 1}_${to}`, penalty);
      });
    });
  }

  // Layer (numSteps-1) to Goal
  ['c', 'l', 'r'].forEach((s) => connect(`node_${numSteps - 1}_${s}`, goalId));

  // A* Execution with Open/Closed sets
  const openSet: Map<string, AStarNode> = new Map();
  const closedSet: Set<string> = new Set();

  const startH = haversineDistanceMeters(start, goal);
  openSet.set(startId, {
    id: startId,
    coord: start,
    g: 0,
    h: startH,
    f: startH,
    parent: null,
  });

  const nodeRecords: Map<string, AStarNode> = new Map();

  let reachedGoal = false;

  while (openSet.size > 0) {
    // Pick node with lowest f-score
    let current: AStarNode | null = null;
    openSet.forEach((node) => {
      if (!current || node.f < current.f) {
        current = node;
      }
    });

    if (!current) break;
    const currNode: AStarNode = current;

    if (currNode.id === goalId) {
      reachedGoal = true;
      nodeRecords.set(goalId, currNode);
      break;
    }

    openSet.delete(currNode.id);
    closedSet.add(currNode.id);
    nodeRecords.set(currNode.id, currNode);

    const neighbors = graph.get(currNode.id) || [];
    for (const edge of neighbors) {
      if (closedSet.has(edge.target)) continue;

      const neighborCoord = nodes.get(edge.target)!;
      const tentativeG = currNode.g + edge.cost;

      const existing = openSet.get(edge.target);
      if (!existing || tentativeG < existing.g) {
        const h = haversineDistanceMeters(neighborCoord, goal);
        const updated: AStarNode = {
          id: edge.target,
          coord: neighborCoord,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: currNode.id,
        };
        openSet.set(edge.target, updated);
      }
    }
  }

  // Reconstruct path
  const path: LatLng[] = [];
  let currId: string | null = reachedGoal ? goalId : null;
  while (currId) {
    const record = nodeRecords.get(currId);
    if (!record) break;
    path.unshift(record.coord);
    currId = record.parent;
  }

  if (path.length === 0) {
    path.push(start, goal);
  }

  // Compute total road distance along path
  let totalMeters = 0;
  for (let i = 0; i < path.length - 1; i++) {
    totalMeters += haversineDistanceMeters(path[i], path[i + 1]);
  }
  // Pedestrians can take direct footpaths/cut-throughs; motor vehicles follow full road grids
  const detourFactor = mode === 'walking' ? 1.08 : 1.2;
  const pathFactor = mode === 'walking' ? 1.04 : 1.15;
  const roadDistanceMeters = Math.max(directDistance * detourFactor, totalMeters * pathFactor);

  const speedKmh = AVERAGE_SPEED_KMH[mode];
  const durationSeconds = Math.round((roadDistanceMeters / 1000 / speedKmh) * 3600);

  return {
    points: path,
    distanceMeters: Math.round(roadDistanceMeters),
    durationSeconds: Math.max(60, durationSeconds),
  };
}

/**
 * Format minutes and hours into human-readable string
 */
export function formatDuration(durationSeconds: number): string {
  const totalMins = Math.max(1, Math.round(durationSeconds / 60));
  if (totalMins < 60) {
    return `${totalMins} min`;
  }
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
}

/**
 * Format meters into km or m
 */
export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

/**
 * Format arrival clock time (e.g. "12:45 PM")
 */
export function formatArrivalTime(durationSeconds: number): string {
  const arrival = new Date(Date.now() + durationSeconds * 1000);
  return arrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Fetch a complete route estimate.
 * First queries real-time road routing (OSRM).
 * If offline or fails, falls back instantly to the local A* algorithm path!
 */
export async function getRouteEstimate(
  start: LatLng,
  goal: LatLng,
  mode: TravelMode = 'driving',
): Promise<RouteEstimate> {
  const osrmProfile = mode === 'walking' ? 'foot' : mode === 'two_wheeler' ? 'bike' : 'driving';
  const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${start.longitude},${start.latitude};${goal.longitude},${goal.latitude}?overview=full&geometries=geojson&steps=true`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const primaryRoute = data.routes[0];
        const coordinates: [number, number][] = primaryRoute.geometry?.coordinates || [];
        const rawDistance = primaryRoute.distance || haversineDistanceMeters(start, goal) * 1.2;
        let rawDuration = primaryRoute.duration || 600;

        // Accurately compute duration according to travel mode:
        // OSRM public demo server returns vehicle-biased duration for 'foot', so we calibrate walking
        if (mode === 'walking') {
          // Average pedestrian walking pace: 4.8 km/h (1 km ~ 12.5 mins)
          rawDuration = Math.max(60, Math.round((rawDistance / 1000 / AVERAGE_SPEED_KMH.walking) * 3600));
        } else if (mode === 'two_wheeler') {
          rawDuration = Math.max(60, Math.round((rawDistance / 1000 / AVERAGE_SPEED_KMH.two_wheeler) * 3600));
        } else if (mode === 'driving') {
          // Adjust for real city traffic factor
          rawDuration = Math.max(60, Math.round(rawDuration * 1.25));
        }

        const points: LatLng[] = coordinates.map(([lng, lat]) => ({
          latitude: lat,
          longitude: lng,
        }));

        if (points.length === 0) {
          points.push(start, goal);
        }

        // Calibrate step durations proportionally to match the travel mode's realistic timing
        const durationRatio =
          primaryRoute.duration && primaryRoute.duration > 0
            ? rawDuration / primaryRoute.duration
            : 1;

        const steps: RouteStep[] =
          primaryRoute.legs?.[0]?.steps?.map((s: any) => ({
            instruction:
              s.maneuver?.instruction ||
              s.name ||
              (mode === 'walking' ? 'Walk along designated path' : 'Continue on route'),
            distanceMeters: Math.round(s.distance || 0),
            durationSeconds: Math.round((s.duration || 0) * (mode === 'walking' || mode === 'two_wheeler' ? durationRatio : 1)),
          })) || [];

        return {
          points,
          distanceMeters: Math.round(rawDistance),
          distanceKm: parseFloat((rawDistance / 1000).toFixed(1)),
          distanceText: formatDistance(rawDistance),
          durationSeconds: rawDuration,
          durationMinutes: Math.max(1, Math.round(rawDuration / 60)),
          etaText: formatDuration(rawDuration),
          arrivalTime: formatArrivalTime(rawDuration),
          mode,
          trafficStatus: mode === 'walking' ? 'normal' : rawDuration > 900 ? 'moderate' : 'light',
          steps,
          method: 'osrm-realtime',
          providerName: 'OSRM (OpenStreetMap Roads)',
          summary: mode === 'walking' ? 'Pedestrian walking route via OpenStreetMap' : 'Fastest route via real-time road network',
        };
      }
    }
  } catch (err) {
    console.log('[Routing] OSRM live route unavailable, falling back to A* algorithm:', err);
  }

  // Fallback to local A* Pathfinding Algorithm
  const aStarResult = computeAStarPath(start, goal, { mode });
  return {
    points: aStarResult.points,
    distanceMeters: aStarResult.distanceMeters,
    distanceKm: parseFloat((aStarResult.distanceMeters / 1000).toFixed(1)),
    distanceText: formatDistance(aStarResult.distanceMeters),
    durationSeconds: aStarResult.durationSeconds,
    durationMinutes: Math.max(1, Math.round(aStarResult.durationSeconds / 60)),
    etaText: formatDuration(aStarResult.durationSeconds),
    arrivalTime: formatArrivalTime(aStarResult.durationSeconds),
    mode,
    trafficStatus: 'normal',
    steps: [
      {
        instruction: 'Head towards destination along optimized path',
        distanceMeters: aStarResult.distanceMeters,
        durationSeconds: aStarResult.durationSeconds,
      },
    ],
    method: 'a-star',
    providerName: 'A* Algorithm (Offline Fallback)',
    summary: 'A* Optimized shortest path estimate',
  };
}
