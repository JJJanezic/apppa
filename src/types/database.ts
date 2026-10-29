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
          adult_price_cents: number | null
          archived_at: string | null
          check_in: string
          check_out: string
          child_prices: Json
          cleaning_fee_cents: number | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          max_adults: number | null
          max_guests: number
          name: string
          note: string | null
          price_cents: number | null
          price_mode: string
          property_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adult_price_cents?: number | null
          archived_at?: string | null
          check_in?: string
          check_out?: string
          child_prices?: Json
          cleaning_fee_cents?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          max_adults?: number | null
          max_guests: number
          name: string
          note?: string | null
          price_cents?: number | null
          price_mode?: string
          property_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adult_price_cents?: number | null
          archived_at?: string | null
          check_in?: string
          check_out?: string
          child_prices?: Json
          cleaning_fee_cents?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          max_adults?: number | null
          max_guests?: number
          name?: string
          note?: string | null
          price_cents?: number | null
          price_mode?: string
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
      booking_amounts: {
        Row: {
          billed_nights_cents: number
          cancellation_fee_cents: number | null
          created_at: string
          created_by: string | null
          id: string
          nights_cents: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          billed_nights_cents?: number
          cancellation_fee_cents?: number | null
          created_at?: string
          created_by?: string | null
          id: string
          nights_cents: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          billed_nights_cents?: number
          cancellation_fee_cents?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          nights_cents?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_amounts_booking_fkey"
            columns: ["id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "booking_amounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_charges: {
        Row: {
          amount_cents: number
          booking_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          position: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_cents: number
          booking_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          position: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          position?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_charges_booking_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "booking_charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_companions: {
        Row: {
          birth_date: string | null
          booking_id: string
          created_at: string
          created_by: string | null
          first_name: string
          id: string
          last_name: string
          position: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          birth_date?: string | null
          booking_id: string
          created_at?: string
          created_by?: string | null
          first_name: string
          id?: string
          last_name: string
          position: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          birth_date?: string | null
          booking_id?: string
          created_at?: string
          created_by?: string | null
          first_name?: string
          id?: string
          last_name?: string
          position?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_companions_booking_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "booking_companions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_numbers: {
        Row: {
          last_seq: number
          tenant_id: string
          year: number
        }
        Insert: {
          last_seq: number
          tenant_id: string
          year: number
        }
        Update: {
          last_seq?: number
          tenant_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_numbers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          adults: number | null
          apartment_id: string
          arrival: string
          block_reason: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          channel: string
          check_in: string | null
          check_out: string | null
          child_ages: number[]
          created_at: string
          created_by: string | null
          departure: string
          guest_id: string | null
          guest_sheet_number: string | null
          id: string
          kind: string
          note: string | null
          number: string | null
          number_seq: number | null
          number_year: number | null
          option_until: string | null
          override_at: string | null
          override_by: string | null
          planned_departure: string
          price_review: boolean
          residence_registered: boolean
          source: string
          source_custom: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adults?: number | null
          apartment_id: string
          arrival: string
          block_reason?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          channel?: string
          check_in?: string | null
          check_out?: string | null
          child_ages?: number[]
          created_at?: string
          created_by?: string | null
          departure: string
          guest_id?: string | null
          guest_sheet_number?: string | null
          id?: string
          kind: string
          note?: string | null
          number?: string | null
          number_seq?: number | null
          number_year?: number | null
          option_until?: string | null
          override_at?: string | null
          override_by?: string | null
          planned_departure: string
          price_review?: boolean
          residence_registered?: boolean
          source?: string
          source_custom?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adults?: number | null
          apartment_id?: string
          arrival?: string
          block_reason?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          channel?: string
          check_in?: string | null
          check_out?: string | null
          child_ages?: number[]
          created_at?: string
          created_by?: string | null
          departure?: string
          guest_id?: string | null
          guest_sheet_number?: string | null
          id?: string
          kind?: string
          note?: string | null
          number?: string | null
          number_seq?: number | null
          number_year?: number | null
          option_until?: string | null
          override_at?: string | null
          override_by?: string | null
          planned_departure?: string
          price_review?: boolean
          residence_registered?: boolean
          source?: string
          source_custom?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_apartment_fkey"
            columns: ["apartment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "bookings_guest_fkey"
            columns: ["guest_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          company_address_line1: string | null
          company_address_line2: string | null
          company_city: string | null
          company_country: string | null
          company_name: string | null
          company_postal_code: string | null
          company_vat_id: string | null
          country: string
          created_at: string
          created_by: string | null
          document_authority: string | null
          document_back_path: string | null
          document_country: string | null
          document_front_path: string | null
          document_issued_on: string | null
          document_number: string | null
          document_type: string | null
          email: string | null
          email_key: string | null
          email_source: string
          first_name: string | null
          gender: string
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
          title_prefix: string | null
          title_suffix: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_country?: string | null
          anonymized_at?: string | null
          birth_date?: string | null
          city?: string | null
          company_address_line1?: string | null
          company_address_line2?: string | null
          company_city?: string | null
          company_country?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          company_vat_id?: string | null
          country: string
          created_at?: string
          created_by?: string | null
          document_authority?: string | null
          document_back_path?: string | null
          document_country?: string | null
          document_front_path?: string | null
          document_issued_on?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          email_key?: string | null
          email_source?: string
          first_name?: string | null
          gender?: string
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
          title_prefix?: string | null
          title_suffix?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_country?: string | null
          anonymized_at?: string | null
          birth_date?: string | null
          city?: string | null
          company_address_line1?: string | null
          company_address_line2?: string | null
          company_city?: string | null
          company_country?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          company_vat_id?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          document_authority?: string | null
          document_back_path?: string | null
          document_country?: string | null
          document_front_path?: string | null
          document_issued_on?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          email_key?: string | null
          email_source?: string
          first_name?: string | null
          gender?: string
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
          title_prefix?: string | null
          title_suffix?: string | null
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
          changed_fields: string[] | null
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
          changed_fields?: string[] | null
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
          changed_fields?: string[] | null
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
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          name_line2: string | null
          postal_code: string | null
          register_number: string | null
          status: Database["public"]["Enums"]["tenant_status"]
          tax_number: string | null
          updated_at: string
          updated_by: string | null
          vat_id: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          name_line2?: string | null
          postal_code?: string | null
          register_number?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          tax_number?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_id?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          name_line2?: string | null
          postal_code?: string | null
          register_number?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          tax_number?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_id?: string | null
        }
        Relationships: []
      }
      vat_status_changes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          small_business: boolean
          tenant_id: string
          updated_at: string
          updated_by: string | null
          valid_from: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          small_business: boolean
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          valid_from: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          small_business?: boolean
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "vat_status_changes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          city: string
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
      booking_warnings: {
        Args: {
          p_adults?: number
          p_apartment_id: string
          p_arrival: string
          p_departure: string
          p_exclude?: string
          p_guest_sheet_number?: string
          p_persons: number
          p_tenant_id: string
        }
        Returns: Json
      }
      cancel_booking: {
        Args: { p_booking_id: string; p_fee_cents?: number; p_reason?: string }
        Returns: undefined
      }
      confirm_option: {
        Args: { p_booking_id: string; p_confirm?: boolean }
        Returns: Json
      }
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
          title_prefix: string
          title_suffix: string
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
      save_block: {
        Args: { p_confirm?: boolean; p_input: Json }
        Returns: Json
      }
      save_booking: {
        Args: { p_confirm?: boolean; p_input: Json }
        Returns: Json
      }
      save_booking_note: {
        Args: {
          p_booking_id: string
          p_fee_cents?: number
          p_note: string
          p_set_fee?: boolean
          p_updated_at: string
        }
        Returns: undefined
      }
      save_companions: {
        Args: { p_booking_id: string; p_companions: Json; p_updated_at: string }
        Returns: undefined
      }
      unused_guest_documents: { Args: { p_limit?: number }; Returns: string[] }
      update_tenant_master_data: {
        Args: {
          p_data: Json
          p_expected_updated_at: string
          p_tenant_id: string
        }
        Returns: undefined
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
