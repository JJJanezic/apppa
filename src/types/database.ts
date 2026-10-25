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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      apartments: {
        Row: {
          archived_at: string | null
          check_in: string
          check_out: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          max_guests: number
          name: string
          note: string | null
          price_cents: number | null
          property_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          check_in?: string
          check_out?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          max_guests: number
          name: string
          note?: string | null
          price_cents?: number | null
          property_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          check_in?: string
          check_out?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          max_guests?: number
          name?: string
          note?: string | null
          price_cents?: number | null
          property_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apartments_property_fkey"
            columns: ["property_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "apartments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label: string
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          tenant_id?: string
        }
        Relationships: []
      }
      guest_duplicate_dismissals: {
        Row: {
          dismissed_at: string
          dismissed_by: string | null
          guest_a: string
          guest_b: string
          tenant_id: string
        }
        Insert: {
          dismissed_at?: string
          dismissed_by?: string | null
          guest_a: string
          guest_b: string
          tenant_id: string
        }
        Update: {
          dismissed_at?: string
          dismissed_by?: string | null
          guest_a?: string
          guest_b?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_duplicate_dismissals_a_fkey"
            columns: ["guest_a", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "guest_duplicate_dismissals_b_fkey"
            columns: ["guest_b", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "guest_duplicate_dismissals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          address_country: string | null
          anonymized_at: string | null
          birth_date: string | null
          city: string | null
          company_billing_address: string | null
          company_name: string | null
          company_vat_id: string | null
          country: string
          created_at: string
          created_by: string | null
          email: string | null
          email_key: string | null
          email_source: string
          first_name: string | null
          id: string
          language: string | null
          last_name: string
          marketing_custom: string | null
          marketing_source: string | null
          name_key: string | null
          note: string | null
          phone: string | null
          phone_key: string | null
          phone_source: string
          postal_code: string | null
          search_text: string
          street: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_country?: string | null
          anonymized_at?: string | null
          birth_date?: string | null
          city?: string | null
          company_billing_address?: string | null
          company_name?: string | null
          company_vat_id?: string | null
          country: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_key?: string | null
          email_source?: string
          first_name?: string | null
          id?: string
          language?: string | null
          last_name: string
          marketing_custom?: string | null
          marketing_source?: string | null
          name_key?: string | null
          note?: string | null
          phone?: string | null
          phone_key?: string | null
          phone_source?: string
          postal_code?: string | null
          search_text?: string
          street?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_country?: string | null
          anonymized_at?: string | null
          birth_date?: string | null
          city?: string | null
          company_billing_address?: string | null
          company_name?: string | null
          company_vat_id?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_key?: string | null
          email_source?: string
          first_name?: string | null
          id?: string
          language?: string | null
          last_name?: string
          marketing_custom?: string | null
          marketing_source?: string | null
          name_key?: string | null
          note?: string | null
          phone?: string | null
          phone_key?: string | null
          phone_source?: string
          postal_code?: string | null
          search_text?: string
          street?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          kind: string
          role: Database["public"]["Enums"]["member_role"]
          sent_at: string
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          kind: string
          role: Database["public"]["Enums"]["member_role"]
          sent_at?: string
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          kind?: string
          role?: Database["public"]["Enums"]["member_role"]
          sent_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      login_failures: {
        Row: {
          account_hash: string
          created_at: string
          id: number
          kind: string
        }
        Insert: {
          account_hash: string
          created_at?: string
          id?: never
          kind: string
        }
        Update: {
          account_hash?: string
          created_at?: string
          id?: never
          kind?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["member_role"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["member_role"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      municipalities: {
        Row: {
          code: string
          name: string
          search_key: string
          state: string
          successor_code: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          name: string
          search_key: string
          state: string
          successor_code?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          name?: string
          search_key?: string
          state?: string
          successor_code?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "municipalities_successor_code_fkey"
            columns: ["successor_code"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["code"]
          },
        ]
      }
      municipality_postal_codes: {
        Row: {
          municipality_code: string
          postal_code: string
        }
        Insert: {
          municipality_code: string
          postal_code: string
        }
        Update: {
          municipality_code?: string
          postal_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipality_postal_codes_municipality_code_fkey"
            columns: ["municipality_code"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["code"]
          },
        ]
      }
      operator_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          id: number
          target_email: string | null
          tenant_id: string
          tenant_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: never
          target_email?: string | null
          tenant_id: string
          tenant_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: never
          target_email?: string | null
          tenant_id?: string
          tenant_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          email: string
          id: string
          is_operator_admin: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email: string
          id: string
          is_operator_admin?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email?: string
          id?: string
          is_operator_admin?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          city: string
          created_at: string
          created_by: string | null
          id: string
          municipality_code: string
          name: string
          postal_code: string
          street: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          city: string
          created_at?: string
          created_by?: string | null
          id?: string
          municipality_code: string
          name: string
          postal_code: string
          street: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          created_by?: string | null
          id?: string
          municipality_code?: string
          name?: string
          postal_code?: string
          street?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_municipality_code_fkey"
            columns: ["municipality_code"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "properties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_invitation_id: string }; Returns: string }
      accept_new_account_invitations: { Args: never; Returns: string }
      admin_change_member: {
        Args: { p_action: string; p_tenant_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_create_tenant: {
        Args: { p_allow_duplicate?: boolean; p_email: string; p_name: string }
        Returns: {
          kind: string
          tenant_id: string
        }[]
      }
      admin_delete_tenant: {
        Args: { p_confirm_name: string; p_tenant_id: string }
        Returns: {
          invited_email: string
          user_id: string
        }[]
      }
      admin_invite_owner: {
        Args: { p_email: string; p_tenant_id: string }
        Returns: string
      }
      admin_resend_invitation: {
        Args: { p_invitation_id: string; p_tenant_id: string }
        Returns: {
          email: string
          kind: string
          role: Database["public"]["Enums"]["member_role"]
          tenant_name: string
        }[]
      }
      admin_revoke_invitation: {
        Args: { p_invitation_id: string; p_tenant_id: string }
        Returns: {
          email: string
          kind: string
        }[]
      }
      admin_set_tenant_status: {
        Args: { p_active: boolean; p_tenant_id: string }
        Returns: undefined
      }
      admin_tenant_overview: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          created_at: string
          id: string
          invitations: Json
          last_sign_in_at: string
          member_count: number
          name: string
          owners: Json
          status: Database["public"]["Enums"]["tenant_status"]
          total: number
        }[]
      }
      anonymize_guest: { Args: { p_guest_id: string }; Returns: undefined }
      belongs_to_deactivated_tenant: { Args: never; Returns: boolean }
      create_apartment_with_property: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_city: string
          p_kind: string
          p_max_guests: number
          p_municipality_code: string
          p_name: string
          p_note: string
          p_postal_code: string
          p_price_cents: number
          p_property_name: string
          p_street: string
          p_tenant_id: string
        }
        Returns: string
      }
      decline_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      delete_guest: { Args: { p_guest_id: string }; Returns: string }
      guest_duplicate_candidates: {
        Args: {
          p_email: string
          p_first_name: string
          p_last_name: string
          p_phone: string
          p_tenant_id: string
        }
        Returns: {
          id: string
          reasons: string[]
        }[]
      }
      guest_duplicate_pairs: {
        Args: { p_tenant_id: string }
        Returns: {
          guest_a: string
          guest_b: string
          reasons: string[]
        }[]
      }
      guest_list: {
        Args: {
          p_country?: string
          p_limit?: number
          p_marketing?: string
          p_offset?: number
          p_query?: string
          p_sort?: string
          p_tenant_id: string
        }
        Returns: {
          anonymized_at: string
          company_name: string
          country: string
          first_name: string
          id: string
          last_name: string
          last_stay: string
          stay_count: number
          total: number
        }[]
      }
      merge_guests: {
        Args: { p_choice: Json; p_keep: string; p_remove: string }
        Returns: undefined
      }
      my_open_invitations: {
        Args: never
        Returns: {
          expires_at: string
          id: string
          invited_by_name: string
          role: Database["public"]["Enums"]["member_role"]
          tenant_name: string
        }[]
      }
    }
    Enums: {
      member_role: "owner" | "staff"
      tenant_status: "active" | "deactivated"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      member_role: ["owner", "staff"],
      tenant_status: ["active", "deactivated"],
    },
  },
} as const
