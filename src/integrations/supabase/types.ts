export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      community_routes: {
        Row: {
          ai_confidence: number
          created_at: string
          encoded_polyline: string | null
          from_label: string
          from_lat: number
          from_lng: number
          id: string
          safety_score: number
          savings_min: number
          title: string
          to_label: string
          to_lat: number
          to_lng: number
          verified_by: number
        }
        Insert: {
          ai_confidence: number
          created_at?: string
          encoded_polyline?: string | null
          from_label: string
          from_lat: number
          from_lng: number
          id?: string
          safety_score: number
          savings_min: number
          title: string
          to_label: string
          to_lat: number
          to_lng: number
          verified_by?: number
        }
        Update: {
          ai_confidence?: number
          created_at?: string
          encoded_polyline?: string | null
          from_label?: string
          from_lat?: number
          from_lng?: number
          id?: string
          safety_score?: number
          savings_min?: number
          title?: string
          to_label?: string
          to_lat?: number
          to_lng?: number
          verified_by?: number
        }
        Relationships: []
      }
      ride_locations: {
        Row: {
          created_at: string
          heading: number | null
          id: string
          lat: number
          lng: number
          ride_id: string
        }
        Insert: {
          created_at?: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          ride_id: string
        }
        Update: {
          created_at?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_locations_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          captain_device_id: string | null
          captain_name: string | null
          captain_plate: string | null
          captain_rating: number | null
          captain_user_id: string | null
          captain_vehicle: string | null
          created_at: string
          drop_label: string
          drop_lat: number
          drop_lng: number
          fare_inr: number
          id: string
          otp: string
          payment_method: string
          pickup_label: string
          pickup_lat: number
          pickup_lng: number
          rating: number | null
          rider_device_id: string
          rider_user_id: string | null
          smart_route_savings_min: number
          status: string
          tip_inr: number
          updated_at: string
          use_smart_route: boolean
          vehicle_type: string
        }
        Insert: {
          captain_device_id?: string | null
          captain_name?: string | null
          captain_plate?: string | null
          captain_rating?: number | null
          captain_user_id?: string | null
          captain_vehicle?: string | null
          created_at?: string
          drop_label: string
          drop_lat: number
          drop_lng: number
          fare_inr: number
          id?: string
          otp: string
          payment_method?: string
          pickup_label: string
          pickup_lat: number
          pickup_lng: number
          rating?: number | null
          rider_device_id: string
          rider_user_id?: string | null
          smart_route_savings_min?: number
          status?: string
          tip_inr?: number
          updated_at?: string
          use_smart_route?: boolean
          vehicle_type?: string
        }
        Update: {
          captain_device_id?: string | null
          captain_name?: string | null
          captain_plate?: string | null
          captain_rating?: number | null
          captain_user_id?: string | null
          captain_vehicle?: string | null
          created_at?: string
          drop_label?: string
          drop_lat?: number
          drop_lng?: number
          fare_inr?: number
          id?: string
          otp?: string
          payment_method?: string
          pickup_label?: string
          pickup_lat?: number
          pickup_lng?: number
          rating?: number | null
          rider_device_id?: string
          rider_user_id?: string | null
          smart_route_savings_min?: number
          status?: string
          tip_inr?: number
          updated_at?: string
          use_smart_route?: boolean
          vehicle_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
