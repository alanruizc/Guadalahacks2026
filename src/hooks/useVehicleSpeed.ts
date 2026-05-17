import { useCallback, useEffect, useRef, useState } from 'react';

export type VehicleSpeedStatus =
  | 'idle'
  | 'requesting'
  | 'tracking'
  | 'denied'
  | 'unavailable'
  | 'error';

const MS_TO_KMH = 3.6;
const MAX_SPEED_KMH = 300;
const MIN_DT_SEC = 0.5;
const SMOOTHING = 0.35;
/** Por debajo de esto se considera detenido (ruido típico del GPS en reposo). */
const STATIONARY_THRESHOLD_KMH = 5;
/** Desplazamiento mínimo entre lecturas para calcular velocidad por posición. */
const MIN_MOVEMENT_METERS = 10;
/** Con poca precisión horizontal, ignorar velocidades bajas del chip GPS. */
const LOW_SPEED_ACCURACY_CUTOFF_M = 35;

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 1000,
  timeout: 15000,
};

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function applyStationaryFilter(kmh: number, accuracyM: number | null): number {
  if (kmh < STATIONARY_THRESHOLD_KMH) return 0;
  if (
    accuracyM != null &&
    accuracyM > LOW_SPEED_ACCURACY_CUTOFF_M &&
    kmh < STATIONARY_THRESHOLD_KMH * 3
  ) {
    return 0;
  }
  return kmh;
}

function getStatusLabel(status: VehicleSpeedStatus): string {
  switch (status) {
    case 'requesting':
      return 'Obteniendo ubicación…';
    case 'tracking':
      return 'GPS activo';
    case 'denied':
      return 'Permiso de ubicación denegado';
    case 'unavailable':
      return 'GPS no disponible';
    case 'error':
      return 'Error al leer ubicación';
    default:
      return '';
  }
}

export interface UseVehicleSpeedReturn {
  speed: number;
  status: VehicleSpeedStatus;
  statusLabel: string;
  isTracking: boolean;
  retry: () => void;
}

export function useVehicleSpeed(enabled = true): UseVehicleSpeedReturn {
  const [speed, setSpeed] = useState(0);
  const [status, setStatus] = useState<VehicleSpeedStatus>('idle');

  const smoothedRef = useRef(0);
  const lastPosRef = useRef<{ lat: number; lon: number; ts: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const processPosition = useCallback((position: GeolocationPosition) => {
    setStatus('tracking');

    let rawKmh: number | null = null;
    const { coords, timestamp } = position;

    const accuracyM = coords.accuracy ?? null;

    if (coords.speed != null && !Number.isNaN(coords.speed) && coords.speed >= 0) {
      rawKmh = applyStationaryFilter(coords.speed * MS_TO_KMH, accuracyM);
    } else if (lastPosRef.current) {
      const dt = (timestamp - lastPosRef.current.ts) / 1000;
      if (dt >= MIN_DT_SEC) {
        const meters = haversineMeters(
          lastPosRef.current.lat,
          lastPosRef.current.lon,
          coords.latitude,
          coords.longitude,
        );
        if (meters >= MIN_MOVEMENT_METERS) {
          rawKmh = applyStationaryFilter((meters / dt) * MS_TO_KMH, accuracyM);
        } else {
          rawKmh = 0;
        }
      }
    }

    lastPosRef.current = {
      lat: coords.latitude,
      lon: coords.longitude,
      ts: timestamp,
    };

    if (rawKmh == null || rawKmh > MAX_SPEED_KMH) return;

    const prev = smoothedRef.current;
    let next: number;

    if (rawKmh === 0) {
      next = prev <= STATIONARY_THRESHOLD_KMH ? 0 : Math.round(prev * 0.25);
    } else {
      next = prev === 0 ? rawKmh : SMOOTHING * rawKmh + (1 - SMOOTHING) * prev;
    }

    smoothedRef.current = next;
    setSpeed(Math.round(next));
  }, []);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatch = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      setSpeed(0);
      return;
    }

    stopWatch();
    setStatus('requesting');
    smoothedRef.current = 0;
    lastPosRef.current = null;
    setSpeed(0);

    watchIdRef.current = navigator.geolocation.watchPosition(
      processPosition,
      (err) => {
        setSpeed(0);
        smoothedRef.current = 0;
        lastPosRef.current = null;
        if (err.code === err.PERMISSION_DENIED) setStatus('denied');
        else if (err.code === err.POSITION_UNAVAILABLE) setStatus('unavailable');
        else setStatus('error');
      },
      WATCH_OPTIONS,
    );
  }, [processPosition, stopWatch]);

  const retry = useCallback(() => {
    startWatch();
  }, [startWatch]);

  useEffect(() => {
    if (!enabled) {
      stopWatch();
      setStatus('idle');
      setSpeed(0);
      return;
    }
    startWatch();
    return stopWatch;
  }, [enabled, startWatch, stopWatch]);

  return {
    speed,
    status,
    statusLabel: getStatusLabel(status),
    isTracking: status === 'tracking',
    retry,
  };
}
