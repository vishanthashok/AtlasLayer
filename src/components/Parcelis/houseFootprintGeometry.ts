import * as turf from '@turf/turf';
import type { HouseModel, Land } from '../../models/types';

export type HouseFootprintGeometries = {
  houseBaseGeoJSON: ReturnType<typeof turf.polygon> | null;
  houseRoofGeoJSON: ReturnType<typeof turf.polygon> | null;
  houseFloorPlanGeoJSON: GeoJSON.FeatureCollection | null;
};

export function buildHouseFootprintGeometries(
  selectedLand: Land | null,
  selectedHouseModel: HouseModel | null
): HouseFootprintGeometries {
  if (!selectedLand || !selectedHouseModel) {
    return { houseBaseGeoJSON: null, houseRoofGeoJSON: null, houseFloorPlanGeoJSON: null };
  }

  const center = turf.point([selectedLand.longitude, selectedLand.latitude]);
  const w = (selectedHouseModel.footprintDimensions.width * 0.3048) / 2000;
  const d = (selectedHouseModel.footprintDimensions.depth * 0.3048) / 2000;
  const opts = { units: 'kilometers' as const };

  const NW = turf.destination(turf.destination(center, w, 270, opts), d, 0, opts).geometry.coordinates;
  const NE = turf.destination(turf.destination(center, w, 90, opts), d, 0, opts).geometry.coordinates;
  const SE = turf.destination(turf.destination(center, w, 90, opts), d, 180, opts).geometry.coordinates;
  const SW = turf.destination(turf.destination(center, w, 270, opts), d, 180, opts).geometry.coordinates;

  const houseBaseGeoJSON = turf.polygon([[NW, NE, SE, SW, NW]]);

  const rw = w * 0.92;
  const rd = d * 0.92;
  const rNW = turf.destination(turf.destination(center, rw, 270, opts), rd, 0, opts).geometry.coordinates;
  const rNE = turf.destination(turf.destination(center, rw, 90, opts), rd, 0, opts).geometry.coordinates;
  const rSE = turf.destination(turf.destination(center, rw, 90, opts), rd, 180, opts).geometry.coordinates;
  const rSW = turf.destination(turf.destination(center, rw, 270, opts), rd, 180, opts).geometry.coordinates;
  const houseRoofGeoJSON = turf.polygon([[rNW, rNE, rSE, rSW, rNW]]);

  const midN = [(NW[0]! + NE[0]!) / 2, (NW[1]! + NE[1]!) / 2];
  const midW = [(NW[0]! + SW[0]!) / 2, (NW[1]! + SW[1]!) / 2];
  const midE = [(NE[0]! + SE[0]!) / 2, (NE[1]! + SE[1]!) / 2];
  const thirdN_W = [NW[0]! + (NE[0]! - NW[0]!) * 0.33, NW[1]! + (NE[1]! - NW[1]!) * 0.33];
  const thirdN_E = [NW[0]! + (NE[0]! - NW[0]!) * 0.67, NW[1]! + (NE[1]! - NW[1]!) * 0.67];
  const thirdS_W = [SW[0]! + (SE[0]! - SW[0]!) * 0.33, SW[1]! + (SE[1]! - SW[1]!) * 0.33];
  const thirdS_E = [SW[0]! + (SE[0]! - SW[0]!) * 0.67, SW[1]! + (SE[1]! - SW[1]!) * 0.67];
  const midThirdN_W = [thirdN_W[0]!, midW[1]!];
  const midThirdN_E = [thirdN_E[0]!, midE[1]!];

  const rooms = [
    [[NW, thirdN_W, midThirdN_W, midW, NW]],
    [[thirdN_W, thirdN_E, midThirdN_E, midThirdN_W, thirdN_W]],
    [[thirdN_E, NE, midE, midThirdN_E, thirdN_E]],
    [[midW, midE, SE, SW, midW]],
  ];

  const houseFloorPlanGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: rooms.map((coords, i) => ({
      type: 'Feature',
      properties: { room: i },
      geometry: { type: 'Polygon', coordinates: coords },
    })),
  };

  return { houseBaseGeoJSON, houseRoofGeoJSON, houseFloorPlanGeoJSON };
}
