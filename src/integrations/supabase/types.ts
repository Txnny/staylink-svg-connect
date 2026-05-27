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
      bookings: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          fee_rate: number | null
          fee_status: Database["public"]["Enums"]["fee_status"]
          fee_type: Database["public"]["Enums"]["fee_type"] | null
          finders_fee_xcd: number | null
          id: string
          nights: number | null
          property_id: string | null
          redirect_id: string | null
          room_id: string | null
          total_xcd: number | null
          traveller_id: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          fee_rate?: number | null
          fee_status?: Database["public"]["Enums"]["fee_status"]
          fee_type?: Database["public"]["Enums"]["fee_type"] | null
          finders_fee_xcd?: number | null
          id?: string
          nights?: number | null
          property_id?: string | null
          redirect_id?: string | null
          room_id?: string | null
          total_xcd?: number | null
          traveller_id?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          fee_rate?: number | null
          fee_status?: Database["public"]["Enums"]["fee_status"]
          fee_type?: Database["public"]["Enums"]["fee_type"] | null
          finders_fee_xcd?: number | null
          id?: string
          nights?: number | null
          property_id?: string | null
          redirect_id?: string | null
          room_id?: string | null
          total_xcd?: number | null
          traveller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_redirect_id_fkey"
            columns: ["redirect_id"]
            isOneToOne: false
            referencedRelation: "redirects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_traveller_id_fkey"
            columns: ["traveller_id"]
            isOneToOne: false
            referencedRelation: "travellers"
            referencedColumns: ["id"]
          },
        ]
      }
      earnings: {
        Row: {
          amount_xcd: number
          booking_id: string | null
          created_at: string
          id: string
          invoice_date: string | null
          invoice_number: string | null
          paid_date: string | null
          partner_id: string | null
          status: Database["public"]["Enums"]["fee_status"]
        }
        Insert: {
          amount_xcd?: number
          booking_id?: string | null
          created_at?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          paid_date?: string | null
          partner_id?: string | null
          status?: Database["public"]["Enums"]["fee_status"]
        }
        Update: {
          amount_xcd?: number
          booking_id?: string | null
          created_at?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          paid_date?: string | null
          partner_id?: string | null
          status?: Database["public"]["Enums"]["fee_status"]
        }
        Relationships: [
          {
            foreignKeyName: "earnings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "earnings_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          bank_details: string | null
          business_name: string
          contact_name: string
          email: string
          fee_agreement_type: Database["public"]["Enums"]["fee_type"]
          fee_rate: number
          id: string
          joined_at: string
          phone: string | null
          status: Database["public"]["Enums"]["partner_status"]
          user_id: string | null
        }
        Insert: {
          bank_details?: string | null
          business_name: string
          contact_name: string
          email: string
          fee_agreement_type?: Database["public"]["Enums"]["fee_type"]
          fee_rate?: number
          id?: string
          joined_at?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["partner_status"]
          user_id?: string | null
        }
        Update: {
          bank_details?: string | null
          business_name?: string
          contact_name?: string
          email?: string
          fee_agreement_type?: Database["public"]["Enums"]["fee_type"]
          fee_rate?: number
          id?: string
          joined_at?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["partner_status"]
          user_id?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          location: string | null
          name: string
          parish: string | null
          partner_id: string | null
          status: Database["public"]["Enums"]["property_status"]
          type: Database["public"]["Enums"]["property_type"]
          website: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          location?: string | null
          name: string
          parish?: string | null
          partner_id?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          type: Database["public"]["Enums"]["property_type"]
          website?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          location?: string | null
          name?: string
          parish?: string | null
          partner_id?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          type?: Database["public"]["Enums"]["property_type"]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      redirects: {
        Row: {
          admin_notes: string | null
          confirmed_at: string | null
          created_at: string
          from_property_id: string | null
          id: string
          matched_property_id: string | null
          matched_room_id: string | null
          status: Database["public"]["Enums"]["redirect_status"]
          traveller_id: string
        }
        Insert: {
          admin_notes?: string | null
          confirmed_at?: string | null
          created_at?: string
          from_property_id?: string | null
          id?: string
          matched_property_id?: string | null
          matched_room_id?: string | null
          status?: Database["public"]["Enums"]["redirect_status"]
          traveller_id: string
        }
        Update: {
          admin_notes?: string | null
          confirmed_at?: string | null
          created_at?: string
          from_property_id?: string | null
          id?: string
          matched_property_id?: string | null
          matched_room_id?: string | null
          status?: Database["public"]["Enums"]["redirect_status"]
          traveller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redirects_from_property_id_fkey"
            columns: ["from_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redirects_matched_property_id_fkey"
            columns: ["matched_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redirects_matched_room_id_fkey"
            columns: ["matched_room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redirects_traveller_id_fkey"
            columns: ["traveller_id"]
            isOneToOne: false
            referencedRelation: "travellers"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          amenities: string[] | null
          available: boolean
          available_from: string | null
          available_to: string | null
          created_at: string
          description: string | null
          id: string
          images: string[] | null
          max_guests: number
          name: string
          price_per_night_xcd: number
          property_id: string
          room_type: string | null
        }
        Insert: {
          amenities?: string[] | null
          available?: boolean
          available_from?: string | null
          available_to?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          max_guests?: number
          name: string
          price_per_night_xcd?: number
          property_id: string
          room_type?: string | null
        }
        Update: {
          amenities?: string[] | null
          available?: boolean
          available_from?: string | null
          available_to?: string | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          max_guests?: number
          name?: string
          price_per_night_xcd?: number
          property_id?: string
          room_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      travellers: {
        Row: {
          accommodation_type_preference:
            | Database["public"]["Enums"]["property_type"]
            | null
          arrival_date: string | null
          budget_max_xcd: number | null
          budget_min_xcd: number | null
          created_at: string
          departure_date: string | null
          email: string
          full_name: string
          guest_count: number
          id: string
          nationality: string | null
          nights_needed: number | null
          notes: string | null
          phone: string | null
          source: Database["public"]["Enums"]["traveller_source"]
        }
        Insert: {
          accommodation_type_preference?:
            | Database["public"]["Enums"]["property_type"]
            | null
          arrival_date?: string | null
          budget_max_xcd?: number | null
          budget_min_xcd?: number | null
          created_at?: string
          departure_date?: string | null
          email: string
          full_name: string
          guest_count?: number
          id?: string
          nationality?: string | null
          nights_needed?: number | null
          notes?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["traveller_source"]
        }
        Update: {
          accommodation_type_preference?:
            | Database["public"]["Enums"]["property_type"]
            | null
          arrival_date?: string | null
          budget_max_xcd?: number | null
          budget_min_xcd?: number | null
          created_at?: string
          departure_date?: string | null
          email?: string
          full_name?: string
          guest_count?: number
          id?: string
          nationality?: string | null
          nights_needed?: number | null
          notes?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["traveller_source"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "partner"
      fee_status: "pending" | "invoiced" | "paid"
      fee_type: "flat" | "percentage"
      partner_status: "active" | "inactive" | "onboarding"
      property_status: "active" | "inactive" | "onboarding"
      property_type: "hotel" | "airbnb" | "guesthouse" | "hostel" | "villa"
      redirect_status: "new" | "pending" | "matched" | "confirmed" | "cancelled"
      traveller_source: "redirect" | "walkin" | "online" | "partner_referral"
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
    Enums: {
      app_role: ["admin", "partner"],
      fee_status: ["pending", "invoiced", "paid"],
      fee_type: ["flat", "percentage"],
      partner_status: ["active", "inactive", "onboarding"],
      property_status: ["active", "inactive", "onboarding"],
      property_type: ["hotel", "airbnb", "guesthouse", "hostel", "villa"],
      redirect_status: ["new", "pending", "matched", "confirmed", "cancelled"],
      traveller_source: ["redirect", "walkin", "online", "partner_referral"],
    },
  },
} as const
