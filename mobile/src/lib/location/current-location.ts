/**
 * The phone's current position for "near me" search and on-site listings (FR-102, FR-150).
 * Asks for "while using the app" permission only. Returns null if the user says no — screens then
 * explain and let them type a city instead. Accuracy "Balanced" (~100 m) is enough: the API
 * rounds stored pins to ~110 m anyway.
 */
import * as Location from 'expo-location';

export interface CurrentLocation {
  lat: number;
  lng: number;
  /** Best-effort city/area name from the phone's geocoder (may be null). */
  city: string | null;
}

export async function getCurrentLocation(): Promise<CurrentLocation | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return null;

  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 500 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;

  let city: string | null = null;
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    city = place?.city ?? place?.district ?? place?.subregion ?? null;
  } catch {
    // Geocoding is a nicety; the coordinates are what matter.
  }
  return { lat, lng, city };
}
