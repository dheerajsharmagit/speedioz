
export type RideStatus =
  | "destination"
  | "vehicle"
  | "confirm"
  | "searching"
  | "accepted"
  | "arriving"
  | "in_progress"
  | "completed"
  | "rating"
  | "rated";

export interface Ride {
  id: string;
  rider_user_id: string;
  pickup_label: string;
  pickup_lat: number;
  pickup_lng: number;
  drop_label: string;
  drop_lat: number;
  drop_lng: number;
  vehicle_type: "bike" | "auto" | "ev";
  fare_inr: number;
  status: RideStatus;
  otp: string;
  use_smart_route?: boolean;
  captain_name?: string;
  captain_phone?: string;
  captain_lat?: number;
  captain_lng?: number;
  captain_plate?: string;
  captain_vehicle?: string;
  captain_avatar?: string;
  captain_rating?: number;
  created_at: string;
}

export interface CommunityRoute {
  id: string;
  title: string;
  from_label: string;
  from_lat: number;
  from_lng: number;
  to_label: string;
  to_lat: number;
  to_lng: number;
  savings_min: number;
  confidence_score: number;
  safety_score: number;
  ai_confidence: number;
  verified_by: number;
  encoded_polyline: string;
  tags: string[];
}

export function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}
