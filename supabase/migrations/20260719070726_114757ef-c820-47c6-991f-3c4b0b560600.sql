
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS rider_user_id uuid,
  ADD COLUMN IF NOT EXISTS captain_user_id uuid;

CREATE INDEX IF NOT EXISTS rides_rider_user_id_idx ON public.rides (rider_user_id);
CREATE INDEX IF NOT EXISTS rides_captain_user_id_idx ON public.rides (captain_user_id);
CREATE INDEX IF NOT EXISTS ride_locations_ride_id_idx ON public.ride_locations (ride_id);

DROP POLICY IF EXISTS "Public insert rides" ON public.rides;
DROP POLICY IF EXISTS "Public read rides" ON public.rides;
DROP POLICY IF EXISTS "Public update rides" ON public.rides;

DROP POLICY IF EXISTS "Public insert ride locations" ON public.ride_locations;
DROP POLICY IF EXISTS "Public read ride locations" ON public.ride_locations;

REVOKE ALL ON public.rides FROM anon;
REVOKE ALL ON public.ride_locations FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.rides TO authenticated;
GRANT SELECT, INSERT ON public.ride_locations TO authenticated;
GRANT ALL ON public.rides TO service_role;
GRANT ALL ON public.ride_locations TO service_role;

CREATE POLICY "Participants and open queue can read rides"
  ON public.rides FOR SELECT
  TO authenticated
  USING (
    rider_user_id = auth.uid()
    OR captain_user_id = auth.uid()
    OR (status = 'searching' AND captain_user_id IS NULL)
  );

CREATE POLICY "Rider inserts own ride"
  ON public.rides FOR INSERT
  TO authenticated
  WITH CHECK (rider_user_id = auth.uid());

CREATE POLICY "Rider or accepting captain updates ride"
  ON public.rides FOR UPDATE
  TO authenticated
  USING (
    rider_user_id = auth.uid()
    OR captain_user_id = auth.uid()
    OR (status = 'searching' AND captain_user_id IS NULL)
  )
  WITH CHECK (
    rider_user_id = auth.uid()
    OR captain_user_id = auth.uid()
  );

CREATE POLICY "Ride participants read locations"
  ON public.ride_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = ride_locations.ride_id
        AND (r.rider_user_id = auth.uid() OR r.captain_user_id = auth.uid())
    )
  );

CREATE POLICY "Ride participants insert locations"
  ON public.ride_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = ride_locations.ride_id
        AND (r.rider_user_id = auth.uid() OR r.captain_user_id = auth.uid())
    )
  );
