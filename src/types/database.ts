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
      apartment_tourist_tax_rates: {
        Row: {
          amount_cents: number | null
          apartment_id: string
          base: string | null
          created_at: string
          created_by: string | null
          exempt_under_age: number | null
          id: string
          label: string
          method: string
          percent_rate: number | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          valid_from: string
          vat_rate: number
        }
        Insert: {
          amount_cents?: number | null
          apartment_id: string
          base?: string | null
          created_at?: string
          created_by?: string | null
          exempt_under_age?: number | null
          id?: string
          label: string
          method: string
          percent_rate?: number | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          valid_from: string
          vat_rate?: number
        }
        Update: {
          amount_cents?: number | null
          apartment_id?: string
          base?: string | null
          created_at?: string
          created_by?: string | null
          exempt_under_age?: number | null
          id?: string
          label?: string
          method?: string
          percent_rate?: number | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          valid_from?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "apartment_tourist_tax_rates_apartment_fkey"
            columns: ["apartment_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "apartment_tourist_tax_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      apartments: {
        Row: {
          adult_price_cents: number | null
          archived_at: string | null
          bank_account_id: string | null
          booking_hotel_id: string | null
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
          bank_account_id?: string | null
          booking_hotel_id?: string | null
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
          bank_account_id?: string | null
          booking_hotel_id?: string | null
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
            foreignKeyName: "apartments_bank_account_fkey"
            columns: ["bank_account_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id", "tenant_id"]
          },
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
      bank_accounts: {
        Row: {
          account_holder: string
          archived_at: string | null
          bank_name: string | null
          bic: string | null
          created_at: string
          created_by: string | null
          iban: string
          id: string
          is_primary: boolean
          label: string | null
          note: string | null
          position: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_holder: string
          archived_at?: string | null
          bank_name?: string | null
          bic?: string | null
          created_at?: string
          created_by?: string | null
          iban: string
          id?: string
          is_primary?: boolean
          label?: string | null
          note?: string | null
          position: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_holder?: string
          archived_at?: string | null
          bank_name?: string | null
          bic?: string | null
          created_at?: string
          created_by?: string | null
          iban?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          note?: string | null
          position?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_amounts: {
        Row: {
          billed_nights_cents: number
          cancellation_fee_cents: number | null
          cancellation_fee_vat_rate: number
          created_at: string
          created_by: string | null
          id: string
          nights_cents: number
          nights_extension_pricing: string
          nights_vat_rate: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          billed_nights_cents?: number
          cancellation_fee_cents?: number | null
          cancellation_fee_vat_rate?: number
          created_at?: string
          created_by?: string | null
          id: string
          nights_cents: number
          nights_extension_pricing?: string
          nights_vat_rate?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          billed_nights_cents?: number
          cancellation_fee_cents?: number | null
          cancellation_fee_vat_rate?: number
          created_at?: string
          created_by?: string | null
          id?: string
          nights_cents?: number
          nights_extension_pricing?: string
          nights_vat_rate?: number
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
            foreignKeyName: "booking_amounts_booking_fkey"
            columns: ["id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guest_sheet_missing"
            referencedColumns: ["booking_id", "tenant_id"]
          },
          {
            foreignKeyName: "booking_amounts_booking_fkey"
            columns: ["id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guest_sheet_register"
            referencedColumns: ["booking_id", "tenant_id"]
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
          tax_person_nights: number | null
          tenant_id: string
          tourist_tax: boolean
          tourist_tax_rate_id: string | null
          updated_at: string
          updated_by: string | null
          vat_rate: number
        }
        Insert: {
          amount_cents: number
          booking_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          position: number
          tax_person_nights?: number | null
          tenant_id: string
          tourist_tax?: boolean
          tourist_tax_rate_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_rate?: number
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          position?: number
          tax_person_nights?: number | null
          tenant_id?: string
          tourist_tax?: boolean
          tourist_tax_rate_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_rate?: number
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
            foreignKeyName: "booking_charges_booking_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guest_sheet_missing"
            referencedColumns: ["booking_id", "tenant_id"]
          },
          {
            foreignKeyName: "booking_charges_booking_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guest_sheet_register"
            referencedColumns: ["booking_id", "tenant_id"]
          },
          {
            foreignKeyName: "booking_charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_charges_tourist_tax_rate_id_fkey"
            columns: ["tourist_tax_rate_id"]
            isOneToOne: false
            referencedRelation: "apartment_tourist_tax_rates"
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
          tourist_tax_exempt: boolean
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
          tourist_tax_exempt?: boolean
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
          tourist_tax_exempt?: boolean
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
            foreignKeyName: "booking_companions_booking_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guest_sheet_missing"
            referencedColumns: ["booking_id", "tenant_id"]
          },
          {
            foreignKeyName: "booking_companions_booking_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guest_sheet_register"
            referencedColumns: ["booking_id", "tenant_id"]
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
          main_guest_tourist_tax_exempt: boolean
          note: string | null
          number: string | null
          number_seq: number | null
          number_year: number | null
          option_until: string | null
          override_at: string | null
          override_by: string | null
          planned_departure: string
          platform_number: string | null
          price_review: boolean
          residence_registered: boolean
          source: string
          source_custom: string | null
          tenant_id: string
          tourist_tax_mode: string
          updated_at: string
          updated_by: string | null
          billed_cents: number | null
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
          main_guest_tourist_tax_exempt?: boolean
          note?: string | null
          number?: string | null
          number_seq?: number | null
          number_year?: number | null
          option_until?: string | null
          override_at?: string | null
          override_by?: string | null
          planned_departure: string
          platform_number?: string | null
          price_review?: boolean
          residence_registered?: boolean
          source?: string
          source_custom?: string | null
          tenant_id: string
          tourist_tax_mode?: string
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
          main_guest_tourist_tax_exempt?: boolean
          note?: string | null
          number?: string | null
          number_seq?: number | null
          number_year?: number | null
          option_until?: string | null
          override_at?: string | null
          override_by?: string | null
          planned_departure?: string
          platform_number?: string | null
          price_review?: boolean
          residence_registered?: boolean
          source?: string
          source_custom?: string | null
          tenant_id?: string
          tourist_tax_mode?: string
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
      companies: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          contact: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          name_key: string
          name_missing: boolean
          postal_code: string | null
          search_text: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          vat_id: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          name_key?: string
          name_missing?: boolean
          postal_code?: string | null
          search_text?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          vat_id?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          name_key?: string
          name_missing?: boolean
          postal_code?: string | null
          search_text?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          vat_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      company_duplicate_dismissals: {
        Row: {
          company_a: string
          company_b: string
          dismissed_at: string
          dismissed_by: string | null
          tenant_id: string
        }
        Insert: {
          company_a: string
          company_b: string
          dismissed_at?: string
          dismissed_by?: string | null
          tenant_id: string
        }
        Update: {
          company_a?: string
          company_b?: string
          dismissed_at?: string
          dismissed_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_duplicate_dismissals_a_fkey"
            columns: ["company_a", "tenant_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "company_duplicate_dismissals_b_fkey"
            columns: ["company_b", "tenant_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "company_duplicate_dismissals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_numbers: {
        Row: {
          created_at: string
          created_by: string | null
          establishment_number: string | null
          id: string
          municipality_code: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          establishment_number?: string | null
          id?: string
          municipality_code: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          establishment_number?: string | null
          id?: string
          municipality_code?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "establishment_numbers_municipality_code_fkey"
            columns: ["municipality_code"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "establishment_numbers_tenant_id_fkey"
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
      guest_sheet_number_ranges: {
        Row: {
          created_at: string
          created_by: string | null
          exhausted_at: string | null
          id: string
          municipality_code: string
          next_number: string | null
          position: number
          range_from: string
          range_to: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          exhausted_at?: string | null
          id?: string
          municipality_code: string
          next_number?: string | null
          position?: never
          range_from: string
          range_to: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          exhausted_at?: string | null
          id?: string
          municipality_code?: string
          next_number?: string | null
          position?: never
          range_from?: string
          range_to?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_sheet_number_ranges_municipality_code_fkey"
            columns: ["municipality_code"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "guest_sheet_number_ranges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sheet_options: {
        Row: {
          backfill_enabled: boolean
          created_at: string
          created_by: string | null
          id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          backfill_enabled?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          backfill_enabled?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_sheet_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sheet_settings: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          marketing_text: Json | null
          privacy_text: Json | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          marketing_text?: Json | null
          privacy_text?: Json | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          marketing_text?: Json | null
          privacy_text?: Json | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_sheet_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sheets: {
        Row: {
          booking_id: string
          created_at: string
          created_by: string | null
          departure_noted_at: string | null
          departure_noted_by: string | null
          guest_id: string | null
          id: string
          kind: string
          marketing_consent: boolean
          pdf_path: string
          pdf_sha256: string | null
          replaced_at: string | null
          replaced_by: string | null
          sheet_number: string | null
          signature_1_path: string | null
          signature_2_path: string | null
          signed_at_1: string | null
          signed_at_2: string | null
          signed_on: string | null
          snapshot: Json | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          created_by?: string | null
          departure_noted_at?: string | null
          departure_noted_by?: string | null
          guest_id?: string | null
          id?: string
          kind: string
          marketing_consent?: boolean
          pdf_path: string
          pdf_sha256?: string | null
          replaced_at?: string | null
          replaced_by?: string | null
          sheet_number?: string | null
          signature_1_path?: string | null
          signature_2_path?: string | null
          signed_at_1?: string | null
          signed_at_2?: string | null
          signed_on?: string | null
          snapshot?: Json | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          created_by?: string | null
          departure_noted_at?: string | null
          departure_noted_by?: string | null
          guest_id?: string | null
          id?: string
          kind?: string
          marketing_consent?: boolean
          pdf_path?: string
          pdf_sha256?: string | null
          replaced_at?: string | null
          replaced_by?: string | null
          sheet_number?: string | null
          signature_1_path?: string | null
          signature_2_path?: string | null
          signed_at_1?: string | null
          signed_at_2?: string | null
          signed_on?: string | null
          snapshot?: Json | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_sheets_booking_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "guest_sheets_booking_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guest_sheet_missing"
            referencedColumns: ["booking_id", "tenant_id"]
          },
          {
            foreignKeyName: "guest_sheets_booking_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guest_sheet_register"
            referencedColumns: ["booking_id", "tenant_id"]
          },
          {
            foreignKeyName: "guest_sheets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_sheets_guest_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_sheets_noted_by_fkey"
            columns: ["departure_noted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_sheets_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "guest_sheet_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_sheets_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "guest_sheet_register"
            referencedColumns: ["sheet_id"]
          },
          {
            foreignKeyName: "guest_sheets_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "guest_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_sheets_tenant_id_fkey"
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
          company_id: string | null
          company_name: string | null
          company_postal_code: string | null
          company_vat_id: string | null
          country: string | null
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
          marketing_consent_at: string | null
          marketing_consent_sheet_id: string | null
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
          company_id?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          company_vat_id?: string | null
          country?: string | null
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
          marketing_consent_at?: string | null
          marketing_consent_sheet_id?: string | null
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
          company_id?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          company_vat_id?: string | null
          country?: string | null
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
          marketing_consent_at?: string | null
          marketing_consent_sheet_id?: string | null
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
            foreignKeyName: "guests_company_fkey"
            columns: ["company_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "guests_marketing_consent_sheet_id_fkey"
            columns: ["marketing_consent_sheet_id"]
            isOneToOne: false
            referencedRelation: "guest_sheet_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_marketing_consent_sheet_id_fkey"
            columns: ["marketing_consent_sheet_id"]
            isOneToOne: false
            referencedRelation: "guest_sheet_register"
            referencedColumns: ["sheet_id"]
          },
          {
            foreignKeyName: "guests_marketing_consent_sheet_id_fkey"
            columns: ["marketing_consent_sheet_id"]
            isOneToOne: false
            referencedRelation: "guest_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      id_reading_settings: {
        Row: {
          created_at: string
          created_by: string | null
          daily_limit: number
          enabled: boolean
          id: string
          privacy_hint_seen_at: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          enabled?: boolean
          id?: string
          privacy_hint_seen_at?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          enabled?: boolean
          id?: string
          privacy_hint_seen_at?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "id_reading_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      id_readings: {
        Row: {
          counted: boolean
          finished_at: string | null
          guest_id: string | null
          id: string
          input_tokens: number | null
          model: string | null
          outcome: string
          output_tokens: number | null
          place: string
          started_at: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          counted?: boolean
          finished_at?: string | null
          guest_id?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          outcome?: string
          output_tokens?: number | null
          place: string
          started_at?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          counted?: boolean
          finished_at?: string | null
          guest_id?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          outcome?: string
          output_tokens?: number | null
          place?: string
          started_at?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "id_readings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "id_readings_tenant_id_fkey"
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
      invoice_deductions: {
        Row: {
          created_at: string
          deducted_invoice_id: string
          invoice_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          deducted_invoice_id: string
          invoice_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          deducted_invoice_id?: string
          invoice_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_deductions_deducted_fkey"
            columns: ["deducted_invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoice_payment_status"
            referencedColumns: ["invoice_id", "tenant_id"]
          },
          {
            foreignKeyName: "invoice_deductions_deducted_fkey"
            columns: ["deducted_invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "invoice_deductions_invoice_fkey"
            columns: ["invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoice_payment_status"
            referencedColumns: ["invoice_id", "tenant_id"]
          },
          {
            foreignKeyName: "invoice_deductions_invoice_fkey"
            columns: ["invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "invoice_deductions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          label: string
          position: number
          source_charge_id: string | null
          source_kind: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          vat_rate: number
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          label: string
          position: number
          source_charge_id?: string | null
          source_kind?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          vat_rate?: number
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          label?: string
          position?: number
          source_charge_id?: string | null
          source_kind?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_fkey"
            columns: ["invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoice_payment_status"
            referencedColumns: ["invoice_id", "tenant_id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_fkey"
            columns: ["invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "invoice_lines_source_charge_id_fkey"
            columns: ["source_charge_id"]
            isOneToOne: false
            referencedRelation: "booking_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_settings: {
        Row: {
          backfill_enabled: boolean
          backfill_updated_at: string
          created_at: string
          created_by: string | null
          footer: Json | null
          id: string
          letterhead_font: string
          letterhead_font_size: number
          letterhead_line_spacing: string
          letterhead_logo_height_mm: number
          letterhead_logo_position: string
          letterhead_paragraph_spacing: string
          letterhead_show_issuer: boolean
          letterhead_updated_at: string
          number_digits: number
          number_prefix: string
          number_separator: string
          number_start: number
          number_start_year: number | null
          number_with_year: boolean
          number_yearly_reset: boolean
          numbering_updated_at: string
          small_business_note: Json
          tenant_id: string
          texts_updated_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          backfill_enabled?: boolean
          backfill_updated_at?: string
          created_at?: string
          created_by?: string | null
          footer?: Json | null
          id?: string
          letterhead_font?: string
          letterhead_font_size?: number
          letterhead_line_spacing?: string
          letterhead_logo_height_mm?: number
          letterhead_logo_position?: string
          letterhead_paragraph_spacing?: string
          letterhead_show_issuer?: boolean
          letterhead_updated_at?: string
          number_digits?: number
          number_prefix?: string
          number_separator?: string
          number_start?: number
          number_start_year?: number | null
          number_with_year?: boolean
          number_yearly_reset?: boolean
          numbering_updated_at?: string
          small_business_note: Json
          tenant_id: string
          texts_updated_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          backfill_enabled?: boolean
          backfill_updated_at?: string
          created_at?: string
          created_by?: string | null
          footer?: Json | null
          id?: string
          letterhead_font?: string
          letterhead_font_size?: number
          letterhead_line_spacing?: string
          letterhead_logo_height_mm?: number
          letterhead_logo_position?: string
          letterhead_paragraph_spacing?: string
          letterhead_show_issuer?: boolean
          letterhead_updated_at?: string
          number_digits?: number
          number_prefix?: string
          number_separator?: string
          number_start?: number
          number_start_year?: number | null
          number_with_year?: boolean
          number_yearly_reset?: boolean
          numbering_updated_at?: string
          small_business_note?: Json
          tenant_id?: string
          texts_updated_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_text_blocks: {
        Row: {
          block: string
          body: Json
          content_updated_at: string
          created_at: string
          created_by: string | null
          deposit_days: number | null
          deposit_percent: number | null
          due_basis: string | null
          due_days: number | null
          id: string
          is_default: boolean
          name: string
          name_key: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          block: string
          body: Json
          content_updated_at?: string
          created_at?: string
          created_by?: string | null
          deposit_days?: number | null
          deposit_percent?: number | null
          due_basis?: string | null
          due_days?: number | null
          id?: string
          is_default?: boolean
          name: string
          name_key?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          block?: string
          body?: Json
          content_updated_at?: string
          created_at?: string
          created_by?: string | null
          deposit_days?: number | null
          deposit_percent?: number | null
          due_basis?: string | null
          due_days?: number | null
          id?: string
          is_default?: boolean
          name?: string
          name_key?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_text_blocks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          booking_fingerprint: string | null
          booking_id: string | null
          closing_block_id: string | null
          closing_text: Json | null
          company_salutation: string | null
          created_at: string
          created_by: string | null
          credit_reason: string | null
          credited_invoice_id: string | null
          deduction_removed: boolean
          deposit_days: number | null
          deposit_percent: number | null
          due_basis: string | null
          due_days: number | null
          guest_id: string | null
          guest_names: string | null
          id: string
          intro_block_id: string | null
          intro_text: Json | null
          invoice_date: string
          issued_at: string | null
          issued_by: string | null
          issued_snapshot: Json | null
          issued_without_logo: boolean
          kind: string | null
          number: string | null
          number_key: string | null
          origin: string
          partial_amount_cents: number | null
          partial_mode: string | null
          partial_percent: number | null
          payment_block_id: string | null
          payment_text: Json | null
          pdf_path: string | null
          pdf_sha256: string | null
          recipient: string
          recipient_city: string | null
          recipient_country: string | null
          recipient_kind: string | null
          recipient_line1: string | null
          recipient_line2: string | null
          recipient_name: string | null
          recipient_postal_code: string | null
          recipient_vat_id: string | null
          small_business: boolean
          tenant_id: string
          total_cents: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          booking_fingerprint?: string | null
          booking_id?: string | null
          closing_block_id?: string | null
          closing_text?: Json | null
          company_salutation?: string | null
          created_at?: string
          created_by?: string | null
          credit_reason?: string | null
          credited_invoice_id?: string | null
          deduction_removed?: boolean
          deposit_days?: number | null
          deposit_percent?: number | null
          due_basis?: string | null
          due_days?: number | null
          guest_id?: string | null
          guest_names?: string | null
          id?: string
          intro_block_id?: string | null
          intro_text?: Json | null
          invoice_date: string
          issued_at?: string | null
          issued_by?: string | null
          issued_snapshot?: Json | null
          issued_without_logo?: boolean
          kind?: string | null
          number?: string | null
          number_key?: string | null
          origin?: string
          partial_amount_cents?: number | null
          partial_mode?: string | null
          partial_percent?: number | null
          payment_block_id?: string | null
          payment_text?: Json | null
          pdf_path?: string | null
          pdf_sha256?: string | null
          recipient: string
          recipient_city?: string | null
          recipient_country?: string | null
          recipient_kind?: string | null
          recipient_line1?: string | null
          recipient_line2?: string | null
          recipient_name?: string | null
          recipient_postal_code?: string | null
          recipient_vat_id?: string | null
          small_business?: boolean
          tenant_id: string
          total_cents?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          booking_fingerprint?: string | null
          booking_id?: string | null
          closing_block_id?: string | null
          closing_text?: Json | null
          company_salutation?: string | null
          created_at?: string
          created_by?: string | null
          credit_reason?: string | null
          credited_invoice_id?: string | null
          deduction_removed?: boolean
          deposit_days?: number | null
          deposit_percent?: number | null
          due_basis?: string | null
          due_days?: number | null
          guest_id?: string | null
          guest_names?: string | null
          id?: string
          intro_block_id?: string | null
          intro_text?: Json | null
          invoice_date?: string
          issued_at?: string | null
          issued_by?: string | null
          issued_snapshot?: Json | null
          issued_without_logo?: boolean
          kind?: string | null
          number?: string | null
          number_key?: string | null
          origin?: string
          partial_amount_cents?: number | null
          partial_mode?: string | null
          partial_percent?: number | null
          payment_block_id?: string | null
          payment_text?: Json | null
          pdf_path?: string | null
          pdf_sha256?: string | null
          recipient?: string
          recipient_city?: string | null
          recipient_country?: string | null
          recipient_kind?: string | null
          recipient_line1?: string | null
          recipient_line2?: string | null
          recipient_name?: string | null
          recipient_postal_code?: string | null
          recipient_vat_id?: string | null
          small_business?: boolean
          tenant_id?: string
          total_cents?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "invoices_booking_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guest_sheet_missing"
            referencedColumns: ["booking_id", "tenant_id"]
          },
          {
            foreignKeyName: "invoices_booking_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guest_sheet_register"
            referencedColumns: ["booking_id", "tenant_id"]
          },
          {
            foreignKeyName: "invoices_closing_block_id_fkey"
            columns: ["closing_block_id"]
            isOneToOne: false
            referencedRelation: "invoice_text_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_credited_fkey"
            columns: ["credited_invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoice_payment_status"
            referencedColumns: ["invoice_id", "tenant_id"]
          },
          {
            foreignKeyName: "invoices_credited_fkey"
            columns: ["credited_invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "invoices_guest_fkey"
            columns: ["guest_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "invoices_intro_block_id_fkey"
            columns: ["intro_block_id"]
            isOneToOne: false
            referencedRelation: "invoice_text_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_block_id_fkey"
            columns: ["payment_block_id"]
            isOneToOne: false
            referencedRelation: "invoice_text_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
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
          target_block: string | null
          target_email: string | null
          target_label: string | null
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
          target_block?: string | null
          target_email?: string | null
          target_label?: string | null
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
          target_block?: string | null
          target_email?: string | null
          target_label?: string | null
          tenant_id?: string
          tenant_name?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          position: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          position?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          position?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          commission_cents: number
          created_at: string
          created_by: string | null
          fee_cents: number
          id: string
          invoice_id: string
          kind: string
          method_id: string
          note: string | null
          paid_on: string
          receipt_path: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_cents: number
          commission_cents?: number
          created_at?: string
          created_by?: string | null
          fee_cents?: number
          id?: string
          invoice_id: string
          kind: string
          method_id: string
          note?: string | null
          paid_on: string
          receipt_path?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_cents?: number
          commission_cents?: number
          created_at?: string
          created_by?: string | null
          fee_cents?: number
          id?: string
          invoice_id?: string
          kind?: string
          method_id?: string
          note?: string | null
          paid_on?: string
          receipt_path?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_fkey"
            columns: ["invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoice_payment_status"
            referencedColumns: ["invoice_id", "tenant_id"]
          },
          {
            foreignKeyName: "payments_invoice_fkey"
            columns: ["invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "payments_method_fkey"
            columns: ["method_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          email: string | null
          id: string
          logo_path: string | null
          name: string
          name_line2: string | null
          phone: string | null
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
          email?: string | null
          id?: string
          logo_path?: string | null
          name: string
          name_line2?: string | null
          phone?: string | null
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
          email?: string | null
          id?: string
          logo_path?: string | null
          name?: string
          name_line2?: string | null
          phone?: string | null
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
      establishment_number_list: {
        Row: {
          establishment_number: string | null
          has_properties: boolean | null
          municipality_code: string | null
          municipality_name: string | null
          tenant_id: string | null
        }
        Relationships: []
      }
      guest_sheet_list: {
        Row: {
          apartment_name: string | null
          arrival: string | null
          booking_cancelled: boolean | null
          booking_id: string | null
          booking_number: string | null
          changed: boolean | null
          created_at: string | null
          created_by_name: string | null
          departure: string | null
          departure_noted_at: string | null
          departure_noted_by_name: string | null
          first_name: string | null
          guest_id: string | null
          id: string | null
          kind: string | null
          last_name: string | null
          marketing_consent: boolean | null
          pdf_path: string | null
          property_name: string | null
          replaced_at: string | null
          search_text: string | null
          sheet_number: string | null
          signature_1_path: string | null
          signature_2_path: string | null
          signed_at: string | null
          signed_on: string | null
          snapshot: Json | null
          tenant_id: string | null
          title_prefix: string | null
          title_suffix: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_sheets_booking_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "guest_sheets_booking_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guest_sheet_missing"
            referencedColumns: ["booking_id", "tenant_id"]
          },
          {
            foreignKeyName: "guest_sheets_booking_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "guest_sheet_register"
            referencedColumns: ["booking_id", "tenant_id"]
          },
          {
            foreignKeyName: "guest_sheets_guest_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_sheets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sheet_missing: {
        Row: {
          apartment_id: string | null
          apartment_name: string | null
          arrival: string | null
          booking_id: string | null
          booking_number: string | null
          departure: string | null
          first_name: string | null
          guest_anonymized: boolean | null
          guest_id: string | null
          last_name: string | null
          property_name: string | null
          search_text: string | null
          tenant_id: string | null
          title_prefix: string | null
          title_suffix: string | null
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
      guest_sheet_number_range_list: {
        Row: {
          exhausted_at: string | null
          id: string | null
          last_issued: string | null
          municipality_code: string | null
          next_number: string | null
          position: number | null
          range_from: string | null
          range_to: string | null
          state: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_sheet_number_ranges_municipality_code_fkey"
            columns: ["municipality_code"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "guest_sheet_number_ranges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sheet_numbering: {
        Row: {
          free_count: number | null
          has_apartments: boolean | null
          has_ranges: boolean | null
          municipality_code: string | null
          municipality_name: string | null
          next_number: string | null
          tenant_id: string | null
          tenant_name: string | null
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
      guest_sheet_register: {
        Row: {
          apartment_id: string | null
          apartment_name: string | null
          arrival: string | null
          booking_id: string | null
          booking_number: string | null
          departure: string | null
          first_name: string | null
          guest_anonymized: boolean | null
          guest_id: string | null
          last_name: string | null
          property_name: string | null
          search_text: string | null
          sheet_id: string | null
          sheet_kind: string | null
          sheet_number: string | null
          signed_date: string | null
          sort_prefix: string | null
          sort_value: number | null
          tenant_id: string | null
          title_prefix: string | null
          title_suffix: string | null
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
      invoice_payment_status: {
        Row: {
          balance_cents: number | null
          commission_cents: number | null
          fee_cents: number | null
          invoice_id: string | null
          mode: string | null
          open_cents: number | null
          overdue: boolean | null
          received_cents: number | null
          refunded_cents: number | null
          settled_cents: number | null
          status: string | null
          tenant_id: string | null
          total_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_list: {
        Row: {
          amount_cents: number | null
          booking_id: string | null
          booking_number: string | null
          commission_cents: number | null
          created_at: string | null
          fee_cents: number | null
          id: string | null
          invoice_id: string | null
          invoice_number: string | null
          kind: string | null
          method_id: string | null
          method_name: string | null
          note: string | null
          paid_on: string | null
          receipt_path: string | null
          recipient: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_fkey"
            columns: ["invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoice_payment_status"
            referencedColumns: ["invoice_id", "tenant_id"]
          },
          {
            foreignKeyName: "payments_invoice_fkey"
            columns: ["invoice_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "payments_method_fkey"
            columns: ["method_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      admin_set_id_reading: {
        Args: { p_daily_limit: number; p_enabled: boolean; p_tenant_id: string }
        Returns: undefined
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
      assign_guest_sheet_number: {
        Args: {
          p_actor_id: string
          p_booking_id: string
          p_expected_updated_at: string
        }
        Returns: Json
      }
      belongs_to_deactivated_tenant: { Args: never; Returns: boolean }
      billed_cents: {
        Args: { "": Database["public"]["Tables"]["bookings"]["Row"] }
        Returns: {
          error: true
        } & "the function public.billed_cents with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache"
      }
      booking_invoices: { Args: { p_booking_id: string }; Returns: Json }
      booking_warnings: {
        Args: {
          p_adults?: number
          p_apartment_id: string
          p_arrival: string
          p_departure: string
          p_exclude?: string
          p_guest_sheet_number?: string
          p_persons: number
          p_platform_number?: string
          p_source?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      cancel_booking: {
        Args: {
          p_booking_id: string
          p_fee_cents?: number
          p_fee_vat_rate?: string
          p_reason?: string
        }
        Returns: undefined
      }
      company_duplicate_pairs: {
        Args: { p_tenant_id: string }
        Returns: {
          company_a: string
          company_b: string
          reasons: string[]
        }[]
      }
      company_list: {
        Args: {
          p_exact_name?: string
          p_exclude_id?: string
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_tenant_id: string
        }
        Returns: {
          address_line1: string
          city: string
          country: string
          guest_count: number
          id: string
          name: string
          name_missing: boolean
          postal_code: string
          total: number
          vat_id: string
        }[]
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
      dashboard_billing_states: {
        Args: { p_booking_ids: string[] }
        Returns: {
          billing: string
          booking_id: string
        }[]
      }
      dashboard_open_invoices: {
        Args: { p_tenant_ids: string[] }
        Returns: {
          apartment_name: string
          invoice_date: string
          invoice_id: string
          next_due: string
          number: string
          open_cents: number
          overdue: boolean
          property_name: string
          recipient: string
          tenant_id: string
        }[]
      }
      dashboard_statistics: {
        Args: { p_month: string; p_tenant_ids: string[] }
        Returns: {
          available_nights: number
          occupied_nights: number
          revenue_cents: number
          tenant_id: string
          vat_cents: number
        }[]
      }
      dashboard_unbilled: {
        Args: { p_limit: number; p_tenant_ids: string[]; p_today: string }
        Returns: {
          apartment_name: string
          billing: string
          booking_id: string
          cancelled: boolean
          due_date: string
          first_name: string
          last_name: string
          property_name: string
          tenant_id: string
          title_prefix: string
          title_suffix: string
          total_count: number
        }[]
      }
      decline_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      delete_company: { Args: { p_company_id: string }; Returns: number }
      delete_guest: { Args: { p_guest_id: string }; Returns: string }
      delete_guest_sheet_number_range: {
        Args: { p_expected_updated_at: string; p_id: string }
        Returns: undefined
      }
      delete_invoice: { Args: { p_invoice_id: string }; Returns: string }
      delete_invoice_draft: { Args: { p_invoice_id: string }; Returns: string }
      delete_invoice_text_block: {
        Args: { p_block_id: string; p_tenant_id: string }
        Returns: undefined
      }
      delete_payment: { Args: { p_payment_id: string }; Returns: Json }
      dismiss_id_reading_privacy_hint: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      finish_guest_sheet: { Args: { p_input: Json }; Returns: string }
      finish_id_reading: {
        Args: {
          p_id: string
          p_input_tokens: number
          p_model: string
          p_outcome: string
          p_output_tokens: number
        }
        Returns: undefined
      }
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
          company_id: string
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
      id_reading_usage: {
        Args: { p_tenant_id: string }
        Returns: {
          last_month: number
          this_month: number
        }[]
      }
      invoice_list_page: {
        Args: {
          p_limit: number
          p_max_cents: number
          p_min_cents: number
          p_offset: number
          p_pattern: string
          p_payment: string
          p_status: string
          p_tenant_id: string
          p_year: number
        }
        Returns: {
          booking_id: string
          booking_number: string
          id: string
          invoice_date: string
          kind: string
          number: string
          origin: string
          pdf_path: string
          recipient: string
          total_cents: number
        }[]
      }
      invoice_list_totals: {
        Args: {
          p_max_cents: number
          p_min_cents: number
          p_pattern: string
          p_payment: string
          p_status: string
          p_tenant_id: string
          p_year: number
        }
        Returns: {
          invoice_count: number
          open_cents: number
          paid_cents: number
          total_cents: number
        }[]
      }
      invoice_numbers: { Args: { p_tenant_id: string }; Returns: string[] }
      invoice_preview_data: { Args: { p_tenant_id: string }; Returns: Json }
      issue_credit_note: { Args: { p_input: Json }; Returns: string }
      issue_invoice: { Args: { p_input: Json }; Returns: string }
      merge_companies: {
        Args: { p_choice: Json; p_keep: string; p_remove: string }
        Returns: undefined
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
      payment_list_totals: {
        Args: {
          p_from: string
          p_method_id: string
          p_query: string
          p_tenant_id: string
          p_to: string
        }
        Returns: {
          commission_cents: number
          fee_cents: number
          received_cents: number
        }[]
      }
      record_payment: { Args: { p_input: Json }; Returns: Json }
      register_guest_sheet_upload: { Args: { p_input: Json }; Returns: string }
      rename_cleaning_charges: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      reorder_payment_methods: {
        Args: { p_ids: string[]; p_tenant_id: string }
        Returns: undefined
      }
      reserve_id_reading: {
        Args: {
          p_guest_id: string
          p_place: string
          p_tenant_id: string
          p_user_id: string
        }
        Returns: string
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
          p_fee_vat_rate?: string
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
      save_establishment_numbers: {
        Args: { p_items: Json; p_tenant_id: string }
        Returns: undefined
      }
      save_guest: { Args: { p_input: Json }; Returns: string }
      save_guest_from_id_document: { Args: { p_input: Json }; Returns: string }
      save_guest_sheet_backfill: {
        Args: { p_enabled: boolean; p_tenant_id: string }
        Returns: undefined
      }
      save_guest_sheet_field: {
        Args: {
          p_booking_id: string
          p_expected_updated_at: string
          p_target: string
          p_values: Json
        }
        Returns: string
      }
      save_guest_sheet_field_from_id_document: {
        Args: {
          p_booking_id: string
          p_expected_updated_at: string
          p_target: string
          p_values: Json
        }
        Returns: string
      }
      save_guest_sheet_number_range: {
        Args: { p_input: Json }
        Returns: string
      }
      save_guest_sheet_texts: {
        Args: {
          p_expected_updated_at: string
          p_marketing: Json
          p_privacy: Json
          p_tenant_id: string
        }
        Returns: string
      }
      save_invoice: { Args: { p_input: Json }; Returns: Json }
      save_invoice_backfill: {
        Args: {
          p_enabled: boolean
          p_expected_updated_at: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      save_invoice_draft: { Args: { p_input: Json }; Returns: string }
      save_invoice_fixed_texts: {
        Args: {
          p_data: Json
          p_expected_updated_at: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      save_invoice_letterhead: {
        Args: {
          p_data: Json
          p_expected_updated_at: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      save_invoice_numbering: {
        Args: {
          p_data: Json
          p_expected_updated_at: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      save_invoice_text_block: { Args: { p_input: Json }; Returns: string }
      save_tourist_tax_rates: {
        Args: { p_apartment_id: string; p_rates: Json }
        Returns: undefined
      }
      search_invoice_bookings: {
        Args: { p_limit?: number; p_query: string; p_tenant_id: string }
        Returns: {
          apartment_name: string
          arrival: string
          cancelled: boolean
          departure: string
          guest_first_name: string
          guest_last_name: string
          id: string
          kind: string
          number: string
          property_name: string
        }[]
      }
      search_payable_invoices: {
        Args: {
          p_booking_id: string
          p_limit?: number
          p_query: string
          p_tenant_id: string
        }
        Returns: {
          booking_id: string
          id: string
          kind: string
          number: string
          open_cents: number
          platform: boolean
          recipient: string
        }[]
      }
      set_default_payment_method: {
        Args: { p_method_id: string; p_tenant_id: string }
        Returns: undefined
      }
      set_invoice_text_block_default: {
        Args: {
          p_block: string
          p_block_id: string
          p_expected_default_id: string
          p_tenant_id: string
        }
        Returns: undefined
      }
      statistics_origin: {
        Args: { p_from: string; p_tenant_id: string; p_to: string }
        Returns: {
          apartment_id: string
          arrivals: number
          country: string
          guest_nights: number
          previous: boolean
          revenue_cents: number
        }[]
      }
      statistics_rows: {
        Args: { p_from: string; p_tenant_id: string; p_to: string }
        Returns: {
          apartment_id: string
          arrivals: number
          available_nights: number
          blocked_nights: number
          bookings: number
          fee_cents: number
          fee_vat_cents: number
          guest_nights: number
          month: string
          occupied_nights: number
          revenue_cents: number
          revenue_vat_cents: number
          stay_nights: number
        }[]
      }
      statistics_tenant_origin: {
        Args: { p_from: string; p_tenant_ids: string[]; p_to: string }
        Returns: {
          apartment_id: string
          arrivals: number
          country: string
          guest_nights: number
          previous: boolean
          revenue_cents: number
          tenant_id: string
        }[]
      }
      statistics_tenant_rows: {
        Args: { p_from: string; p_tenant_ids: string[]; p_to: string }
        Returns: {
          apartment_id: string
          arrivals: number
          available_nights: number
          blocked_nights: number
          bookings: number
          fee_cents: number
          fee_vat_cents: number
          guest_nights: number
          month: string
          occupied_nights: number
          revenue_cents: number
          revenue_vat_cents: number
          stay_nights: number
          tenant_id: string
        }[]
      }
      tourist_tax_monthly: {
        Args: { p_from: string; p_tenant_ids: string[]; p_to: string }
        Returns: {
          amount_cents: number
          month: string
          municipality_id: string
          municipality_name: string
          tenant_id: string
        }[]
      }
      tourist_tax_report: {
        Args: { p_from: string; p_tenant_id: string; p_to: string }
        Returns: {
          amount_cents: number
          apartment_name: string
          arrival: string
          booking_id: string
          booking_number: string
          departure: string
          exempt_person_nights: number
          guest_anonymized: boolean
          guest_first_name: string
          guest_last_name: string
          known_taxable_person_nights: number
          legacy: boolean
          municipality_id: string
          municipality_name: string
          partial: boolean
          percent: boolean
          persons: number
          property_name: string
          taxable_person_nights: number
          unknown_positions: number
        }[]
      }
      unused_guest_documents: { Args: { p_limit?: number }; Returns: string[] }
      unused_guest_sheet_files: {
        Args: { p_limit?: number }
        Returns: string[]
      }
      unused_invoice_pdfs: { Args: { p_limit?: number }; Returns: string[] }
      unused_payment_receipts: { Args: { p_limit?: number }; Returns: string[] }
      unused_tenant_logos: { Args: { p_limit?: number }; Returns: string[] }
      update_payment: { Args: { p_input: Json }; Returns: Json }
      update_tenant_master_data: {
        Args: {
          p_data: Json
          p_expected_updated_at: string
          p_tenant_id: string
        }
        Returns: Json
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
