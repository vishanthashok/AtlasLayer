import { HouseModel } from '../models/types';

export const HOUSE_MODELS: HouseModel[] = [
  { id: 'h1', name: 'The Aspen', styleType: 'Modern Townhome', footprintDimensions: { width: 30, depth: 60 }, description: 'Sleek, narrow footprint perfect for urban infill.' },
  { id: 'h2', name: 'Oakridge Ranch', styleType: 'Ranch', footprintDimensions: { width: 60, depth: 40 }, description: 'Spacious single-story living with wide front facade.' },
  { id: 'h3', name: 'Heritage Colonial', styleType: 'Colonial', footprintDimensions: { width: 45, depth: 45 }, description: 'Classic two-story design with symmetric proportions.' },
  { id: 'h4', name: 'Meadow Farmhouse', styleType: 'Modern Farmhouse', footprintDimensions: { width: 55, depth: 50 }, description: 'Wrap-around porch and open concept interior.' },
  { id: 'h5', name: 'The Cascade', styleType: 'Bungalow', footprintDimensions: { width: 35, depth: 50 }, description: 'Cozy and efficient, ideal for smaller lots.' },
  { id: 'h6', name: 'Summit Contemporary', styleType: 'Modern Townhome', footprintDimensions: { width: 25, depth: 70 }, description: 'Ultra-modern, maximized depth for deep, narrow lots.' },
  { id: 'h7', name: 'Prairie View', styleType: 'Ranch', footprintDimensions: { width: 70, depth: 35 }, description: 'Low slung, horizontal lines fitting expansive plots.' },
  { id: 'h8', name: 'Craftsman Retreat', styleType: 'Bungalow', footprintDimensions: { width: 40, depth: 60 }, description: 'Detailed woodwork and deep porches.' },
  { id: 'h9', name: 'The Belvedere', styleType: 'Colonial', footprintDimensions: { width: 50, depth: 40 }, description: 'Stately brick facade with formal dining.' },
  { id: 'h10', name: 'Valley Estate', styleType: 'Modern Farmhouse', footprintDimensions: { width: 65, depth: 60 }, description: 'Luxury acreage model with attached three-car garage.' }
];

export async function fetchHouseModels(): Promise<HouseModel[]> {
  return HOUSE_MODELS;
}
