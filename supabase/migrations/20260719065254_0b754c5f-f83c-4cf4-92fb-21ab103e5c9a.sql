
-- rides
CREATE TABLE public.rides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rider_device_id TEXT NOT NULL,
  captain_device_id TEXT,
  pickup_label TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  drop_label TEXT NOT NULL,
  drop_lat DOUBLE PRECISION NOT NULL,
  drop_lng DOUBLE PRECISION NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'bike',
  fare_inr INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'searching',
  otp TEXT NOT NULL,
  use_smart_route BOOLEAN NOT NULL DEFAULT true,
  smart_route_savings_min INTEGER NOT NULL DEFAULT 0,
  captain_name TEXT,
  captain_plate TEXT,
  captain_vehicle TEXT,
  captain_rating NUMERIC(3,2),
  rating INTEGER,
  tip_inr INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'upi',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rides TO anon, authenticated;
GRANT ALL ON public.rides TO service_role;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read rides" ON public.rides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert rides" ON public.rides FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update rides" ON public.rides FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ride locations (live captain pings)
CREATE TABLE public.ride_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ride_locations_ride ON public.ride_locations(ride_id, created_at DESC);
GRANT SELECT, INSERT ON public.ride_locations TO anon, authenticated;
GRANT ALL ON public.ride_locations TO service_role;
ALTER TABLE public.ride_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ride locations" ON public.ride_locations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert ride locations" ON public.ride_locations FOR INSERT TO anon, authenticated WITH CHECK (true);

-- community routes catalog
CREATE TABLE public.community_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  from_label TEXT NOT NULL,
  to_label TEXT NOT NULL,
  from_lat DOUBLE PRECISION NOT NULL,
  from_lng DOUBLE PRECISION NOT NULL,
  to_lat DOUBLE PRECISION NOT NULL,
  to_lng DOUBLE PRECISION NOT NULL,
  savings_min INTEGER NOT NULL,
  safety_score INTEGER NOT NULL,
  ai_confidence INTEGER NOT NULL,
  verified_by INTEGER NOT NULL DEFAULT 0,
  encoded_polyline TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_routes TO anon, authenticated;
GRANT ALL ON public.community_routes TO service_role;
ALTER TABLE public.community_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read community routes" ON public.community_routes FOR SELECT TO anon, authenticated USING (true);

-- Bangalore-area seed community routes
INSERT INTO public.community_routes (title, from_label, to_label, from_lat, from_lng, to_lat, to_lng, savings_min, safety_score, ai_confidence, verified_by) VALUES
  ('Airport via Hebbal service road', 'MG Road', 'Kempegowda Intl Airport', 12.9752, 77.6060, 13.1986, 77.7066, 14, 92, 96, 128),
  ('Silk Board bypass via Agara', 'Koramangala', 'Electronic City', 12.9352, 77.6245, 12.8452, 77.6602, 12, 88, 94, 84),
  ('Whitefield inner cut', 'Indiranagar', 'ITPL Whitefield', 12.9784, 77.6408, 12.9855, 77.7367, 9, 90, 91, 47),
  ('Cubbon Park diagonal', 'Vidhana Soudha', 'MG Road Metro', 12.9794, 77.5910, 12.9754, 77.6055, 7, 95, 98, 210),
  ('Sarjapur back lanes', 'HSR Layout', 'Sarjapur Rd', 12.9116, 77.6446, 12.9010, 77.6870, 11, 86, 89, 63);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_routes;
