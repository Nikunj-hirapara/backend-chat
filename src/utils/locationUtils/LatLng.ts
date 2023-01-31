export class LatLng {
  latitude: number
  longitude: number
}

export function isEqual(a: LatLng, b: LatLng): boolean {
  return a.latitude === b.latitude && a.longitude == b.longitude
}
