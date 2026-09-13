export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type Table<Row, Insert, Update = Partial<Insert>, Relationships extends any[] = []> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: Relationships
}

export type Database = {
  public: {
    Tables: {
      organizations: Table<
        { id: string; name: string; document: string; email: string; phone: string; is_multi_branch: boolean; created_at: string; updated_at: string },
        { id?: string; name: string; document: string; email: string; phone: string; is_multi_branch?: boolean; created_at?: string; updated_at?: string }
      >
      plans: Table<
        { id: string; name: string; max_barbers: number; monthly_price: number; asaas_external_id: string | null; is_active: boolean; created_at: string; updated_at: string },
        { id?: string; name: string; max_barbers: number; monthly_price: number; asaas_external_id?: string | null; is_active?: boolean; created_at?: string; updated_at?: string }
      >
      tenants: Table<
        { id: string; organization_id: string; plan_id: string | null; name: string; slug: string; custom_domain: string | null; status: Database['public']['Enums']['tenant_status']; past_due_since: string | null; address: Json; document_number?: string | null; owner_name?: string | null; address_street?: string | null; address_number?: string | null; address_neighborhood?: string | null; address_city?: string | null; address_state?: string | null; address_cep?: string | null; active_gateway: Database['public']['Enums']['gateway_provider'] | null; gateway_credentials: Json; visual_settings: Json; asaas_customer_id: string | null; asaas_subscription_id: string | null; created_at: string; updated_at: string },
        { id?: string; organization_id: string; plan_id?: string | null; name: string; slug: string; custom_domain?: string | null; status?: Database['public']['Enums']['tenant_status']; past_due_since?: string | null; address?: Json; document_number?: string | null; owner_name?: string | null; address_street?: string | null; address_number?: string | null; address_neighborhood?: string | null; address_city?: string | null; address_state?: string | null; address_cep?: string | null; active_gateway?: Database['public']['Enums']['gateway_provider'] | null; gateway_credentials?: Json; visual_settings?: Json; asaas_customer_id?: string | null; asaas_subscription_id?: string | null; created_at?: string; updated_at?: string },
        Partial<{ id: string; organization_id: string; plan_id: string | null; name: string; slug: string; custom_domain: string | null; status: Database['public']['Enums']['tenant_status']; past_due_since: string | null; address: Json; document_number?: string | null; owner_name?: string | null; address_street?: string | null; address_number?: string | null; address_neighborhood?: string | null; address_city?: string | null; address_state?: string | null; address_cep?: string | null; active_gateway: Database['public']['Enums']['gateway_provider'] | null; gateway_credentials: Json; visual_settings: Json; asaas_customer_id: string | null; asaas_subscription_id: string | null; created_at: string; updated_at: string }>,
        [
          {
            foreignKeyName: "tenants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      >

      system_settings: Table<
        { id: boolean; landing_content: Json; grace_period_days: number; created_at: string; updated_at: string },
        { id?: boolean; landing_content?: Json; grace_period_days?: number; created_at?: string; updated_at?: string }
      >
      tenant_settings: Table<
        { tenant_id: string; evolution_api_enabled: boolean; evolution_api_url: string | null; evolution_api_key: string | null; evolution_instance: string | null; notify_barber_on_booking: boolean; closing_buffer_minutes: number; cancellation_notice_hours: number; no_show_commission_enabled: boolean; no_show_commission_percent: number; no_show_policy: Database['public']['Enums']['refund_policy']; timezone: string; enable_product_commission: boolean; credits_validity_days: number; hold_timeout_minutes: number; allow_vip_members: boolean; fidelity_rules: Json; birthday_rules: Json; vip_payment_mode: Database['public']['Enums']['vip_payment_mode']; created_at: string; updated_at: string },
        { tenant_id: string; evolution_api_enabled?: boolean; evolution_api_url?: string | null; evolution_api_key?: string | null; evolution_instance?: string | null; notify_barber_on_booking?: boolean; closing_buffer_minutes?: number; cancellation_notice_hours?: number; no_show_commission_enabled?: boolean; no_show_commission_percent?: number; no_show_policy?: Database['public']['Enums']['refund_policy']; timezone?: string; enable_product_commission?: boolean; credits_validity_days?: number; hold_timeout_minutes?: number; allow_vip_members?: boolean; fidelity_rules?: Json; birthday_rules?: Json; vip_payment_mode?: Database['public']['Enums']['vip_payment_mode']; created_at?: string; updated_at?: string }
      >
      tenant_site_config: Table<
        {
          id: string
          tenant_id: string
          logo_url: string | null
          banner_url: string | null
          headline_title: string | null
          headline_subtitle: string | null
          about_text: string | null
          font_family: 'font-sans' | 'font-serif' | 'font-cinzel' | 'font-bebas' | string
          bg_texture: 'clean_dark' | 'carbon' | 'dark_wood' | 'dark_brick' | 'noise_grain' | string
          primary_color: string
          background_color: string
          card_color: string
          gallery_photos: Json
          amenities: Json
          sections_visibility: Json
          updated_at: string
        },
        {
          id?: string
          tenant_id: string
          logo_url?: string | null
          banner_url?: string | null
          headline_title?: string | null
          headline_subtitle?: string | null
          about_text?: string | null
          font_family?: string
          bg_texture?: string
          primary_color?: string
          background_color?: string
          card_color?: string
          gallery_photos?: Json
          amenities?: Json
          sections_visibility?: Json
          updated_at?: string
        },
        Partial<{
          id: string
          tenant_id: string
          logo_url: string | null
          banner_url: string | null
          headline_title: string | null
          headline_subtitle: string | null
          about_text: string | null
          font_family: string
          bg_texture: string
          primary_color: string
          background_color: string
          card_color: string
          gallery_photos: Json
          amenities: Json
          sections_visibility: Json
          updated_at: string
        }>
      >
      profiles: Table<
        { id: string; tenant_id: string | null; role: Database['public']['Enums']['user_role']; full_name: string; email: string; phone: string | null; birth_date: string | null; avatar_url: string | null; commission_percent: number; tax_document: string | null; legal_name: string | null; partner_contract_signed_at: string | null; seniority_tier?: 'junior' | 'pleno' | 'senior' | 'master'; is_active: boolean; created_at: string; updated_at: string },
        { id: string; tenant_id?: string | null; role?: Database['public']['Enums']['user_role']; full_name: string; email: string; phone?: string | null; birth_date?: string | null; avatar_url?: string | null; commission_percent?: number; tax_document?: string | null; legal_name?: string | null; partner_contract_signed_at?: string | null; seniority_tier?: 'junior' | 'pleno' | 'senior' | 'master'; is_active?: boolean; created_at?: string; updated_at?: string }
      >
      barber_schedules: Table<
        { id: string; tenant_id: string; barber_id: string; weekday: number; starts_at: string; ends_at: string; break_starts_at: string | null; break_ends_at: string | null; slot_interval_minutes: number; is_active: boolean; is_day_off: boolean; created_at: string; updated_at: string },
        { id?: string; tenant_id: string; barber_id: string; weekday: number; starts_at: string; ends_at: string; break_starts_at?: string | null; break_ends_at?: string | null; slot_interval_minutes?: number; is_active?: boolean; is_day_off?: boolean; created_at?: string; updated_at?: string }
      >
      barber_blocked_slots: Table<
        { id: string; tenant_id: string; barber_id: string; starts_at: string; ends_at: string; reason: string | null; created_by: string | null; created_at: string },
        { id?: string; tenant_id: string; barber_id: string; starts_at: string; ends_at: string; reason?: string | null; created_by?: string | null; created_at?: string }
      >
      tenant_holidays: Table<
        { id: string; tenant_id: string; holiday_date: string; name: string; is_closed: boolean; opens_at: string | null; closes_at: string | null; created_at: string },
        { id?: string; tenant_id: string; holiday_date: string; name: string; is_closed?: boolean; opens_at?: string | null; closes_at?: string | null; created_at?: string }
      >
      services: Table<
        { id: string; tenant_id: string; name: string; description: string | null; duration_minutes: number; cleanup_minutes: number; price: number; reservation_fee: number; is_active: boolean; created_at: string; updated_at: string },
        { id?: string; tenant_id: string; name: string; description?: string | null; duration_minutes: number; cleanup_minutes?: number; price: number; reservation_fee?: number; is_active?: boolean; created_at?: string; updated_at?: string }
      >
      products: Table<
        { id: string; tenant_id: string; name: string; sku: string | null; description: string | null; price: number; stock_quantity: number; min_stock_threshold: number; unit: string | null; commission_percent: number; commission_fixed: number; is_active: boolean; created_at: string; updated_at: string },
        { id?: string; tenant_id: string; name: string; sku?: string | null; description?: string | null; price: number; stock_quantity?: number; min_stock_threshold?: number; unit?: string | null; commission_percent?: number; commission_fixed?: number; is_active?: boolean; created_at?: string; updated_at?: string }
      >
      vip_plans: Table<
        { id: string; tenant_id: string; name: string; description: string | null; monthly_price: number; included_services: Json; allow_fidelity_stamps: boolean; frequency: Database['public']['Enums']['vip_frequency']; usage_interval_days: number | null; barber_id: string | null; is_active: boolean; created_at: string; updated_at: string },
        { id?: string; tenant_id: string; name: string; description?: string | null; monthly_price: number; included_services?: Json; allow_fidelity_stamps?: boolean; frequency?: Database['public']['Enums']['vip_frequency']; usage_interval_days?: number | null; barber_id?: string | null; is_active?: boolean; created_at?: string; updated_at?: string }
      >
      monthly_subscriptions: Table<
        { id: string; tenant_id: string; client_name: string; client_phone: string; plan_name: string; cuts_included: number; cuts_remaining: number; price_monthly: number; status: 'active' | 'overdue' | 'cancelled'; cycle_start_date: string; cycle_end_date: string; created_at: string },
        { id?: string; tenant_id: string; client_name: string; client_phone: string; plan_name?: string; cuts_included?: number; cuts_remaining?: number; price_monthly?: number; status?: 'active' | 'overdue' | 'cancelled'; cycle_start_date?: string; cycle_end_date?: string; created_at?: string },
        { id?: string; tenant_id?: string; client_name?: string; client_phone?: string; plan_name?: string; cuts_included?: number; cuts_remaining?: number; price_monthly?: number; status?: 'active' | 'overdue' | 'cancelled'; cycle_start_date?: string; cycle_end_date?: string; created_at?: string }
      >

      appointments: Table<
        { id: string; tenant_id: string; barber_id: string; client_id: string | null; status: Database['public']['Enums']['appointment_status']; starts_at: string; ends_at: string; hold_expires_at: string | null; is_walk_in: boolean; is_quick_sale: boolean; guest_name: string | null; guest_phone: string | null; notes: string | null; total_amount: number; reservation_fee: number; reservation_fee_paid: number; balance_due: number; balance_paid_amount: number; cash_received_by_barber: number; settled_at: string | null; vip_discount_amount: number; fidelity_discount_amount: number; fidelity_card_id: string | null; payment_method: Database['public']['Enums']['payment_method'] | null; payment_status: Database['public']['Enums']['payment_status']; gateway_payment_id: string | null; tracking_token_hash?: string | null; cancelled_at: string | null; cancelled_by: Database['public']['Enums']['user_role'] | null; cancellation_reason: string | null; completed_at: string | null; created_at: string; updated_at: string },
        { id?: string; tenant_id: string; barber_id: string; client_id?: string | null; status?: Database['public']['Enums']['appointment_status']; starts_at: string; ends_at: string; hold_expires_at?: string | null; is_walk_in?: boolean; is_quick_sale?: boolean; guest_name?: string | null; guest_phone?: string | null; notes?: string | null; total_amount?: number; reservation_fee?: number; reservation_fee_paid?: number; balance_paid_amount?: number; cash_received_by_barber?: number; settled_at?: string | null; vip_discount_amount?: number; fidelity_discount_amount?: number; fidelity_card_id?: string | null; payment_method?: Database['public']['Enums']['payment_method'] | null; payment_status?: Database['public']['Enums']['payment_status']; gateway_payment_id?: string | null; tracking_token_hash?: string | null; cancelled_at?: string | null; cancelled_by?: Database['public']['Enums']['user_role'] | null; cancellation_reason?: string | null; completed_at?: string | null; created_at?: string; updated_at?: string },
        Partial<{ id: string; tenant_id: string; barber_id: string; client_id: string | null; status: Database['public']['Enums']['appointment_status']; starts_at: string; ends_at: string; hold_expires_at: string | null; is_walk_in: boolean; is_quick_sale: boolean; guest_name: string | null; guest_phone: string | null; notes: string | null; total_amount: number; reservation_fee: number; reservation_fee_paid: number; balance_due: number; balance_paid_amount: number; cash_received_by_barber: number; settled_at: string | null; vip_discount_amount: number; fidelity_discount_amount: number; fidelity_card_id: string | null; payment_method: Database['public']['Enums']['payment_method'] | null; payment_status: Database['public']['Enums']['payment_status']; gateway_payment_id: string | null; tracking_token_hash: string | null; cancelled_at: string | null; cancelled_by: Database['public']['Enums']['user_role'] | null; cancellation_reason: string | null; completed_at: string | null; created_at: string; updated_at: string }>,
        [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      >
      appointment_services: Table<
        { appointment_id: string; service_id: string; service_name: string; duration_minutes: number; unit_price: number },
        { appointment_id: string; service_id: string; service_name: string; duration_minutes: number; unit_price: number },
        Partial<{ appointment_id: string; service_id: string; service_name: string; duration_minutes: number; unit_price: number }>,
        [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      >
      client_credits: Table<
        { id: string; tenant_id: string; client_id: string; appointment_id: string | null; type: Database['public']['Enums']['credit_type']; amount: number; expires_at: string; used_at: string | null; invalidated_at: string | null; created_at: string },
        { id?: string; tenant_id: string; client_id: string; appointment_id?: string | null; type: Database['public']['Enums']['credit_type']; amount: number; expires_at?: string; used_at?: string | null; invalidated_at?: string | null; created_at?: string }
      >
      fidelity_cards: Table<
        { id: string; tenant_id: string; client_id: string; stamps_count: number; target_stamps: number; reward_type: Database['public']['Enums']['reward_type']; reward_value: number | null; reward_reference_id: string | null; expires_at: string; redeemed_at: string | null; created_at: string; updated_at: string },
        { id?: string; tenant_id: string; client_id: string; stamps_count?: number; target_stamps?: number; reward_type?: Database['public']['Enums']['reward_type']; reward_value?: number | null; reward_reference_id?: string | null; expires_at?: string; redeemed_at?: string | null; created_at?: string; updated_at?: string }
      >
      client_subscriptions: Table<
        { id: string; tenant_id: string; client_id: string; vip_plan_id: string; status: Database['public']['Enums']['subscription_status']; payment_method: Database['public']['Enums']['payment_method']; gateway_subscription_id: string | null; gateway_payment_id: string | null; current_period_start: string; current_period_end: string; next_payment_due: string | null; past_due_since: string | null; cancelled_at: string | null; created_at: string; updated_at: string },
        { id?: string; tenant_id: string; client_id: string; vip_plan_id: string; status?: Database['public']['Enums']['subscription_status']; payment_method: Database['public']['Enums']['payment_method']; gateway_subscription_id?: string | null; gateway_payment_id?: string | null; current_period_start: string; current_period_end: string; next_payment_due?: string | null; past_due_since?: string | null; cancelled_at?: string | null; created_at?: string; updated_at?: string },
        Partial<{ id: string; tenant_id: string; client_id: string; vip_plan_id: string; status: Database['public']['Enums']['subscription_status']; payment_method: Database['public']['Enums']['payment_method']; gateway_subscription_id: string | null; gateway_payment_id: string | null; current_period_start: string; current_period_end: string; next_payment_due: string | null; past_due_since: string | null; cancelled_at: string | null; created_at: string; updated_at: string }>,
        [
          {
            foreignKeyName: "client_subscriptions_vip_plan_id_fkey"
            columns: ["vip_plan_id"]
            isOneToOne: false
            referencedRelation: "vip_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      >
      cash_closings: Table<
        { id: string; tenant_id: string; barber_id: string; period: Database['public']['Enums']['closing_period']; period_start: string; period_end: string; gross_amount: number; services_gross_amount: number; products_gross_amount: number; commission_amount: number; cash_in_hand: number; net_transfer_amount: number; closed_at: string | null; closed_by: string | null; created_at: string },
        { id?: string; tenant_id: string; barber_id: string; period: Database['public']['Enums']['closing_period']; period_start: string; period_end: string; gross_amount?: number; services_gross_amount?: number; products_gross_amount?: number; commission_amount?: number; cash_in_hand?: number; closed_at?: string | null; closed_by?: string | null; created_at?: string }
      >
      commissions: Table<
        { id: string; tenant_id: string; barber_id: string; appointment_id: string | null; product_id: string | null; cash_closing_id: string | null; base_amount: number; rate_percent: number; fixed_amount: number; commission_amount: number; status: Database['public']['Enums']['commission_status']; is_no_show: boolean; created_at: string; paid_at: string | null },
        { id?: string; tenant_id: string; barber_id: string; appointment_id?: string | null; product_id?: string | null; cash_closing_id?: string | null; base_amount: number; rate_percent?: number; fixed_amount?: number; commission_amount: number; status?: Database['public']['Enums']['commission_status']; is_no_show?: boolean; created_at?: string; paid_at?: string | null }
      >
      gallery_photos: Table<
        { id: string; tenant_id: string; barber_id: string | null; client_id: string | null; appointment_id: string | null; storage_path: string; caption: string | null; is_public: boolean; sort_order: number; created_at: string },
        { id?: string; tenant_id: string; barber_id?: string | null; client_id?: string | null; appointment_id?: string | null; storage_path: string; caption?: string | null; is_public?: boolean; sort_order?: number; created_at?: string },
        Partial<{ id: string; tenant_id: string; barber_id: string | null; client_id: string | null; appointment_id: string | null; storage_path: string; caption: string | null; is_public: boolean; sort_order: number; created_at: string }>,
        [
          {
            foreignKeyName: "gallery_photos_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_photos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_photos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          }
        ]
      >
      refund_requests: Table<
        { id: string; tenant_id: string; appointment_id: string; client_id: string | null; amount: number; gateway: Database['public']['Enums']['gateway_provider'] | null; gateway_payment_id: string | null; status: Database['public']['Enums']['refund_status']; reason: string; error_message: string | null; processed_at: string | null; created_at: string; updated_at: string },
        { id?: string; tenant_id: string; appointment_id: string; client_id?: string | null; amount: number; gateway?: Database['public']['Enums']['gateway_provider'] | null; gateway_payment_id?: string | null; status?: Database['public']['Enums']['refund_status']; reason: string; error_message?: string | null; processed_at?: string | null; created_at?: string; updated_at?: string }
      >
      gateway_oauth_states: Table<
        { id: string; tenant_id: string; provider: Database['public']['Enums']['gateway_provider']; state_hash: string; code_verifier_encrypted: Json | null; redirect_uri: string; status: Database['public']['Enums']['oauth_state_status']; expires_at: string; created_by: string; created_at: string },
        { id?: string; tenant_id: string; provider: Database['public']['Enums']['gateway_provider']; state_hash: string; code_verifier_encrypted?: Json | null; redirect_uri: string; status?: Database['public']['Enums']['oauth_state_status']; expires_at?: string; created_by: string; created_at?: string }
      >
      gateway_webhook_events: Table<
        { id: string; provider: Database['public']['Enums']['gateway_provider']; external_event_id: string; appointment_id: string | null; status: Database['public']['Enums']['webhook_status']; payload_hash: string; error_message: string | null; processed_at: string | null; created_at: string },
        { id?: string; provider: Database['public']['Enums']['gateway_provider']; external_event_id: string; appointment_id?: string | null; status?: Database['public']['Enums']['webhook_status']; payload_hash: string; error_message?: string | null; processed_at?: string | null; created_at?: string }
      >
      product_sales: Table<
        { id: string; tenant_id: string; barber_id: string; product_id: string; appointment_id: string | null; counter_sale_id: string | null; quantity: number; unit_price: number; total_amount: number; payment_method: Database['public']['Enums']['payment_method']; sold_at: string; created_at: string },
        { id?: string; tenant_id: string; barber_id: string; product_id: string; appointment_id?: string | null; counter_sale_id?: string | null; quantity: number; unit_price: number; payment_method: Database['public']['Enums']['payment_method']; sold_at?: string; created_at?: string }
      >
      fidelity_stamp_events: Table<
        { id: string; tenant_id: string; client_id: string; appointment_id: string; fidelity_card_id: string; awarded_at: string },
        { id?: string; tenant_id: string; client_id: string; appointment_id: string; fidelity_card_id: string; awarded_at?: string }
      >
      retention_rewards: Table<
        { id: string; tenant_id: string; client_id: string; source: Database['public']['Enums']['retention_reward_source']; reward_type: Database['public']['Enums']['reward_type']; reward_value: number | null; reward_reference_id: string | null; status: Database['public']['Enums']['retention_reward_status']; expires_at: string; redeemed_at: string | null; created_at: string },
        { id?: string; tenant_id: string; client_id: string; source: Database['public']['Enums']['retention_reward_source']; reward_type: Database['public']['Enums']['reward_type']; reward_value?: number | null; reward_reference_id?: string | null; status?: Database['public']['Enums']['retention_reward_status']; expires_at: string; redeemed_at?: string | null; created_at?: string }
      >
      birthday_redemptions: Table<
        { id: string; tenant_id: string; client_id: string; benefit_year: number; reward_id: string; claimed_at: string },
        { id?: string; tenant_id: string; client_id: string; benefit_year: number; reward_id: string; claimed_at?: string }
      >
      counter_sales: Table<
        { id: string; tenant_id: string; barber_id: string; payment_method: Database['public']['Enums']['payment_method']; total_amount: number; cash_received_by_barber: number; sold_at: string; created_by: string; created_at: string },
        { id?: string; tenant_id: string; barber_id: string; payment_method: Database['public']['Enums']['payment_method']; total_amount: number; cash_received_by_barber?: number; sold_at?: string; created_by: string; created_at?: string }
      >
      audit_logs: Table<
        { id: string; tenant_id: string | null; actor_id: string | null; actor_email: string; actor_role: Database['public']['Enums']['user_role']; action: string; category: string; target_id: string | null; details: Json; ip_address: string | null; created_at: string },
        { id?: string; tenant_id?: string | null; actor_id?: string | null; actor_email: string; actor_role: Database['public']['Enums']['user_role']; action: string; category: string; target_id?: string | null; details?: Json; ip_address?: string | null; created_at?: string }
      >
      tenant_referrals: Table<
        { id: string; referrer_tenant_id: string; referred_tenant_id: string | null; referral_code: string; status: 'pending' | 'converted' | 'rewarded'; reward_amount: number; rewarded_at: string | null; created_at: string },
        { id?: string; referrer_tenant_id: string; referred_tenant_id?: string | null; referral_code: string; status?: 'pending' | 'converted' | 'rewarded'; reward_amount?: number; rewarded_at?: string | null; created_at?: string }
      >
      client_referrals: Table<
        { id: string; tenant_id: string; referrer_client_id: string; referred_client_id: string | null; referred_phone: string | null; status: 'pending' | 'completed' | 'rewarded'; reward_type: 'fidelity_stamp' | 'credit_discount'; rewarded_at: string | null; created_at: string },
        { id?: string; tenant_id: string; referrer_client_id: string; referred_client_id?: string | null; referred_phone?: string | null; status?: 'pending' | 'completed' | 'rewarded'; reward_type?: 'fidelity_stamp' | 'credit_discount'; rewarded_at?: string | null; created_at?: string }
      >
      appointment_reviews: Table<
        { id: string; tenant_id: string; appointment_id: string; client_id: string | null; rating: number; tags: string[]; comment: string | null; is_public_shared: boolean; status: 'pending' | 'resolved' | 'acknowledged'; created_at: string },
        { id?: string; tenant_id: string; appointment_id: string; client_id?: string | null; rating: number; tags?: string[]; comment?: string | null; is_public_shared?: boolean; status?: 'pending' | 'resolved' | 'acknowledged'; created_at?: string }
      >
      push_subscriptions: Table<
        { id: string; user_id: string | null; tenant_id: string; endpoint: string; p256dh: string; auth: string; user_type: 'client' | 'barber'; created_at: string },
        { id?: string; user_id?: string | null; tenant_id: string; endpoint: string; p256dh: string; auth: string; user_type: 'client' | 'barber'; created_at?: string }
      >
      service_packages: Table<
        { id: string; tenant_id: string; name: string; description: string | null; price: number; total_credits: number; service_id: string; validity_days: number; is_active: boolean; created_at: string },
        { id?: string; tenant_id: string; name: string; description?: string | null; price: number; total_credits: number; service_id: string; validity_days?: number; is_active?: boolean; created_at?: string }
      >
      client_package_credits: Table<
        { id: string; tenant_id: string; client_id: string; package_id: string; service_id: string; credits_remaining: number; expires_at: string; created_at: string },
        { id?: string; tenant_id: string; client_id: string; package_id: string; service_id: string; credits_remaining: number; expires_at: string; created_at?: string }
      >
      gift_cards: Table<
        { id: string; tenant_id: string; code: string; sender_name: string; recipient_name: string; recipient_phone: string | null; message: string | null; service_id: string | null; amount: number; status: 'pending' | 'paid' | 'redeemed'; redeemed_by_client_id: string | null; redeemed_at: string | null; created_at: string },
        { id?: string; tenant_id: string; code: string; sender_name: string; recipient_name: string; recipient_phone?: string | null; message?: string | null; service_id?: string | null; amount: number; status?: 'pending' | 'paid' | 'redeemed'; redeemed_by_client_id?: string | null; redeemed_at?: string | null; created_at?: string }
      >
      tenant_expenses: Table<
        { id: string; tenant_id: string; category: 'fixed' | 'variable'; description: string; amount: number; due_date: string; paid_at: string | null; is_recurring: boolean; created_at: string },
        { id?: string; tenant_id: string; category: 'fixed' | 'variable'; description: string; amount: number; due_date: string; paid_at?: string | null; is_recurring?: boolean; created_at?: string }
      >
      waitlist: Table<
        {
          id: string
          tenant_id: string
          client_id: string | null
          guest_name: string | null
          guest_phone: string | null
          barber_id: string | null
          requested_date: string
          preferred_shift: 'morning' | 'afternoon' | 'night' | 'any'
          service_ids: string[]
          status: 'waiting' | 'notified' | 'claimed' | 'expired'
          claim_token: string | null
          notified_at: string | null
          expires_at: string | null
          created_at: string
        },
        {
          id?: string
          tenant_id: string
          client_id?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          barber_id?: string | null
          requested_date: string
          preferred_shift?: 'morning' | 'afternoon' | 'night' | 'any'
          service_ids?: string[]
          status?: 'waiting' | 'notified' | 'claimed' | 'expired'
          claim_token?: string | null
          notified_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
      >
      service_consumables: Table<
        {
          id: string
          tenant_id: string
          service_id: string
          product_id: string
          quantity_consumed: number
          created_at: string
        },
        {
          id?: string
          tenant_id: string
          service_id: string
          product_id: string
          quantity_consumed: number
          created_at?: string
        }
      >
      tenant_yield_rules: Table<
        {
          id: string
          tenant_id: string
          name: string
          weekdays: number[]
          starts_at: string
          ends_at: string
          discount_type: 'percent' | 'fixed'
          discount_value: number
          require_full_reservation_fee: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        },
        {
          id?: string
          tenant_id: string
          name: string
          weekdays?: number[]
          starts_at: string
          ends_at: string
          discount_type: 'percent' | 'fixed'
          discount_value?: number
          require_full_reservation_fee?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      >
      tenant_suppliers: Table<
        {
          id: string
          tenant_id: string
          name: string
          contact_name: string | null
          phone: string | null
          whatsapp: string
          email: string | null
          catalog_notes: string | null
          lead_time_days: number
          is_active: boolean
          created_at: string
          updated_at: string
        },
        {
          id?: string
          tenant_id: string
          name: string
          contact_name?: string | null
          phone?: string | null
          whatsapp: string
          email?: string | null
          catalog_notes?: string | null
          lead_time_days?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      >
      purchase_orders: Table<
        {
          id: string
          tenant_id: string
          supplier_id: string | null
          order_number: string
          status: 'draft' | 'sent' | 'received' | 'cancelled'
          items: Json
          total_estimated_cost: number
          notes: string | null
          sent_at: string | null
          received_at: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          tenant_id: string
          supplier_id?: string | null
          order_number: string
          status?: 'draft' | 'sent' | 'received' | 'cancelled'
          items?: Json
          total_estimated_cost?: number
          notes?: string | null
          sent_at?: string | null
          received_at?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      client_visagism_profiles: Table<
        {
          id: string
          tenant_id: string
          client_id: string | null
          face_shape: 'oval' | 'square' | 'round' | 'diamond' | 'heart'
          selfie_url: string | null
          recommended_hair_styles: string[]
          recommended_beard_styles: string[]
          recommendations: Json
          notes: string | null
          created_at: string
        },
        {
          id?: string
          tenant_id: string
          client_id?: string | null
          face_shape: 'oval' | 'square' | 'round' | 'diamond' | 'heart'
          selfie_url?: string | null
          recommended_hair_styles?: string[]
          recommended_beard_styles?: string[]
          recommendations?: Json
          notes?: string | null
          created_at?: string
        }
      >
      marketing_campaigns: Table<
        {
          id: string
          tenant_id: string
          name: string
          target_segment: string
          target_barber_id: string | null
          status: 'draft' | 'scheduled' | 'processing' | 'completed' | 'paused'
          message_template: string
          total_recipients: number
          sent_count: number
          created_at: string
          updated_at: string
        },
        {
          id?: string
          tenant_id: string
          name: string
          target_segment: string
          target_barber_id?: string | null
          status?: 'draft' | 'scheduled' | 'processing' | 'completed' | 'paused'
          message_template: string
          total_recipients?: number
          sent_count?: number
          created_at?: string
          updated_at?: string
        }
      >
      campaign_queue: Table<
        {
          id: string
          campaign_id: string
          client_id: string | null
          phone: string
          client_name: string
          rendered_text: string
          status: 'pending' | 'sent' | 'failed'
          sent_at: string | null
          error_message: string | null
          created_at: string
        },
        {
          id?: string
          campaign_id: string
          client_id?: string | null
          phone: string
          client_name: string
          rendered_text: string
          status?: 'pending' | 'sent' | 'failed'
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
        }
      >
      tenant_accountant_access: Table<
        {
          id: string
          tenant_id: string
          token: string
          pin_code: string | null
          name: string
          expires_at: string | null
          is_active: boolean
          created_at: string
        },
        {
          id?: string
          tenant_id: string
          token: string
          pin_code?: string | null
          name?: string
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
      >
      tenant_pos_terminals: Table<
        {
          id: string
          tenant_id: string
          device_name: string
          provider: 'mercado_pago_point' | 'pagbank_smart' | 'stone_terminal' | 'pos_simulator'
          device_serial_or_id: string
          status: 'online' | 'offline' | 'busy'
          created_at: string
          updated_at: string
        },
        {
          id?: string
          tenant_id: string
          device_name: string
          provider: 'mercado_pago_point' | 'pagbank_smart' | 'stone_terminal' | 'pos_simulator'
          device_serial_or_id: string
          status?: 'online' | 'offline' | 'busy'
          created_at?: string
          updated_at?: string
        }
      >
      pos_payment_intents: Table<
        {
          id: string
          tenant_id: string
          appointment_id: string
          terminal_id: string
          amount: number
          payment_method: string
          status: 'waiting_card' | 'processing' | 'approved' | 'rejected' | 'cancelled'
          external_reference: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          tenant_id: string
          appointment_id: string
          terminal_id: string
          amount: number
          payment_method?: string
          status?: 'waiting_card' | 'processing' | 'approved' | 'rejected' | 'cancelled'
          external_reference?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      barber_time_off: Table<
        {
          id: string
          tenant_id: string
          barber_id: string
          start_date: string
          end_date: string
          reason: 'folga_semanal' | 'ferias' | 'atestado' | 'outros'
          notes: string | null
          approved_by: string | null
          created_at: string
        },
        {
          id?: string
          tenant_id: string
          barber_id: string
          start_date: string
          end_date: string
          reason?: 'folga_semanal' | 'ferias' | 'atestado' | 'outros'
          notes?: string | null
          approved_by?: string | null
          created_at?: string
        }
      >
      client_trust_scores: Table<
        {
          id: string
          tenant_id: string
          client_id: string | null
          phone: string
          client_name: string | null
          score: number
          classification: 'reliable' | 'neutral' | 'high_risk'
          completed_count: number
          late_cancellation_count: number
          no_show_count: number
          consecutive_no_shows: number
          is_blacklisted: boolean
          blacklist_reason: string | null
          blacklisted_at: string | null
          custom_reservation_fee_percent: number | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          tenant_id: string
          client_id?: string | null
          phone: string
          client_name?: string | null
          score?: number
          classification?: 'reliable' | 'neutral' | 'high_risk'
          completed_count?: number
          late_cancellation_count?: number
          no_show_count?: number
          consecutive_no_shows?: number
          is_blacklisted?: boolean
          blacklist_reason?: string | null
          blacklisted_at?: string | null
          custom_reservation_fee_percent?: number | null
          created_at?: string
          updated_at?: string
        }
      >
      whatsapp_bot_sessions: Table<
        {
          id: string
          tenant_id: string
          phone: string
          client_name: string | null
          last_interaction_at: string
          bot_paused_until: string | null
          transferred_to_human: boolean
          transferred_at: string | null
          current_step: string
          metadata: Json
          created_at: string
        },
        {
          id?: string
          tenant_id: string
          phone: string
          client_name?: string | null
          last_interaction_at?: string
          bot_paused_until?: string | null
          transferred_to_human?: boolean
          transferred_at?: string | null
          current_step?: string
          metadata?: Json
          created_at?: string
        }
      >
      service_tier_pricing: Table<
        {
          id: string
          tenant_id: string
          service_id: string
          tier: 'junior' | 'pleno' | 'senior' | 'master'
          custom_price: number
          custom_duration_minutes: number
          created_at: string
          updated_at: string
        },
        {
          id?: string
          tenant_id: string
          service_id: string
          tier: 'junior' | 'pleno' | 'senior' | 'master'
          custom_price: number
          custom_duration_minutes: number
          created_at?: string
          updated_at?: string
        }
      >
      franchise_contracts: Table<
        {
          id: string
          organization_id: string
          tenant_id: string
          royalties_percentage: number
          marketing_fund_percentage: number
          fixed_monthly_fee: number
          due_day: number
          asaas_customer_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        },
        {
          id?: string
          organization_id: string
          tenant_id: string
          royalties_percentage?: number
          marketing_fund_percentage?: number
          fixed_monthly_fee?: number
          due_day?: number
          asaas_customer_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      >
      franchise_settlements: Table<
        {
          id: string
          organization_id: string
          tenant_id: string
          contract_id: string | null
          period_month: number
          period_year: number
          gross_revenue: number
          royalties_amount: number
          marketing_fund_amount: number
          fixed_fee_amount: number
          total_due: number
          asaas_payment_id: string | null
          asaas_invoice_url: string | null
          status: 'pending' | 'invoiced' | 'paid' | 'overdue' | 'waived'
          paid_at: string | null
          created_at: string
        },
        {
          id?: string
          organization_id: string
          tenant_id: string
          contract_id?: string | null
          period_month: number
          period_year: number
          gross_revenue: number
          royalties_amount: number
          marketing_fund_amount: number
          fixed_fee_amount?: number
          total_due: number
          asaas_payment_id?: string | null
          asaas_invoice_url?: string | null
          status?: 'pending' | 'invoiced' | 'paid' | 'overdue' | 'waived'
          paid_at?: string | null
          created_at?: string
        }
      >
      customer_tabs: Table<
        {
          id: string
          tenant_id: string
          client_id: string | null
          client_name: string | null
          guest_phone: string | null
          appointment_id: string | null
          status: 'open' | 'closed' | 'cancelled'
          opened_by: string | null
          total_amount: number
          payment_method: string | null
          notes: string | null
          created_at: string
          closed_at: string | null
        },
        {
          id?: string
          tenant_id: string
          client_id?: string | null
          client_name?: string | null
          guest_phone?: string | null
          appointment_id?: string | null
          status?: 'open' | 'closed' | 'cancelled'
          opened_by?: string | null
          total_amount?: number
          payment_method?: string | null
          notes?: string | null
          created_at?: string
          closed_at?: string | null
        }
      >
      customer_tab_items: Table<
        {
          id: string
          tab_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
          total_price: number
          barber_id: string | null
          added_at: string
        },
        {
          id?: string
          tab_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price: number
          total_price: number
          barber_id?: string | null
          added_at?: string
        }
      >
      electronic_signatures: Table<
        {
          id: string
          tenant_id: string
          document_type: 'image_use_consent' | 'partner_contract' | 'service_waiver' | 'other'
          title: string
          signer_id: string | null
          signer_name: string
          signer_document: string
          signer_email: string | null
          signature_png_base64: string
          sha256_hash: string
          contract_text_snapshot: string
          ip_address: string | null
          user_agent: string | null
          metadata: Json
          created_at: string
        },
        {
          id?: string
          tenant_id: string
          document_type: 'image_use_consent' | 'partner_contract' | 'service_waiver' | 'other'
          title: string
          signer_id?: string | null
          signer_name: string
          signer_document: string
          signer_email?: string | null
          signature_png_base64: string
          sha256_hash: string
          contract_text_snapshot: string
          ip_address?: string | null
          user_agent?: string | null
          metadata?: Json
          created_at?: string
        }
      >
      corporate_agreements: Table<
        {
          id: string
          tenant_id: string
          company_name: string
          cnpj: string
          contact_name: string | null
          contact_email: string
          contact_phone: string | null
          coupon_code: string
          discount_percentage: number
          billing_type: 'direct_discount' | 'postpaid_monthly'
          status: 'active' | 'inactive'
          notes: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          tenant_id: string
          company_name: string
          cnpj: string
          contact_name?: string | null
          contact_email: string
          contact_phone?: string | null
          coupon_code: string
          discount_percentage?: number
          billing_type?: 'direct_discount' | 'postpaid_monthly'
          status?: 'active' | 'inactive'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      corporate_usages: Table<
        {
          id: string
          tenant_id: string
          agreement_id: string
          appointment_id: string | null
          employee_name: string
          employee_email: string | null
          employee_document: string | null
          discount_amount: number
          final_amount: number
          is_billed: boolean
          billed_settlement_id: string | null
          created_at: string
        },
        {
          id?: string
          tenant_id: string
          agreement_id: string
          appointment_id?: string | null
          employee_name: string
          employee_email?: string | null
          employee_document?: string | null
          discount_amount?: number
          final_amount?: number
          is_billed?: boolean
          billed_settlement_id?: string | null
          created_at?: string
        }
      >
      backup_history: Table<
        {
          id: string
          backup_id: string
          file_name: string
          storage_path: string
          file_size_bytes: number
          sha256_checksum: string
          records_count: number
          status: 'success' | 'failed'
          error_message: string | null
          created_at: string
        },
        {
          id?: string
          backup_id: string
          file_name: string
          storage_path: string
          file_size_bytes?: number
          sha256_checksum: string
          records_count?: number
          status?: 'success' | 'failed'
          error_message?: string | null
          created_at?: string
        }
      >
    }
    Views: Record<string, never>
    Functions: {
      resolve_tenant_by_host: {
        Args: { requested_host: string; requested_slug?: string | null }
        Returns: {
          id: string
          slug: string
          status: Database['public']['Enums']['tenant_status']
        }[]
      }
      set_updated_at: { Args: Record<string, never>; Returns: unknown }
      protect_profile_authorization: { Args: Record<string, never>; Returns: unknown }
      validate_appointment: { Args: Record<string, never>; Returns: unknown }
      enforce_plan_barber_limit: { Args: Record<string, never>; Returns: unknown }
      award_fidelity_stamp_internal: { Args: { requested_tenant_id: string; requested_client_id: string; requested_appointment_id: string }; Returns: Json }
      redeem_fidelity_reward_internal: { Args: { requested_tenant_id: string; requested_client_id: string }; Returns: Json }
      register_counter_sale_internal: { Args: { requested_tenant_id: string; requested_barber_id: string; requested_created_by: string; requested_items: Json; requested_payment_method: Database['public']['Enums']['payment_method'] }; Returns: Json }
    }
    Enums: {
      tenant_status: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled'
      appointment_status: 'hold' | 'pending' | 'scheduled' | 'confirmed' | 'arrived' | 'completed' | 'cancelled' | 'no_show' | 'expired'
      payment_method: 'cash' | 'card_machine' | 'pix_tenant' | 'online_gateway' | 'vip' | 'credit' | 'complimentary'
      payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'overdue' | 'cancelled'
      user_role: 'super_admin' | 'owner' | 'barber' | 'receptionist' | 'client'
      closing_period: 'daily' | 'weekly' | 'monthly'
      gateway_provider: 'mercado_pago' | 'asaas' | 'pagseguro' | 'infinitepay'
      subscription_status: 'active' | 'past_due' | 'overdue' | 'suspended' | 'cancelled' | 'expired'
      commission_status: 'pending' | 'payable' | 'paid' | 'cancelled'
      credit_type: 'reservation' | 'cancellation' | 'fidelity' | 'birthday' | 'manual'
      reward_type: 'full_discount' | 'percentage_discount' | 'fixed_discount' | 'free_product' | 'free_service'
      refund_policy: 'gateway_refund' | 'client_credit'
      refund_status: 'pending' | 'processing' | 'completed' | 'failed' | 'manual_required'
      oauth_state_status: 'pending' | 'consumed' | 'expired'
      webhook_status: 'processing' | 'processed' | 'ignored' | 'failed'
      birthday_mode: 'exact_day' | 'birth_month'
      vip_payment_mode: 'recurrent_card' | 'manual_pix'
      vip_frequency: 'weekly' | 'biweekly' | 'unlimited'
      retention_reward_source: 'fidelity' | 'birthday'
      retention_reward_status: 'available' | 'redeemed' | 'expired' | 'cancelled'
    }
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
