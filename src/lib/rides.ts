// Ride helpers — thin wrappers over supabase-js for the demo (anon-permissive RLS).
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Ride = Database["public"]["Tables"]["rides"]["Row"];
export type RideInsert = Database["public"]["Tables"]["rides"]["Insert"];
export type RideLocation = Database["public"]["Tables"]["ride_locations"]["Row"];
export type CommunityRoute = Database["public"]["Tables"]["community_routes"]["Row"];

export type RideStatus =
  | "searching"
  | "accepted"
  | "arriving"
  | "in_progress"
  | "completed"
  | "rated"
  | "cancelled";

export function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
