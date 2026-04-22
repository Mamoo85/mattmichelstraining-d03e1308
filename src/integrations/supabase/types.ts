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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      _applied_migrations: {
        Row: {
          applied_at: string | null
          id: number
          name: string
        }
        Insert: {
          applied_at?: string | null
          id?: number
          name: string
        }
        Update: {
          applied_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      abandoned_cart_clients: {
        Row: {
          active: boolean | null
          business_name: string
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      activity_feed_notes: {
        Row: {
          activity_id: string
          activity_type: string
          author_id: string
          author_role: string
          created_at: string
          id: string
          is_flagged: boolean
          is_question: boolean
          note: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          activity_type: string
          author_id: string
          author_role?: string
          created_at?: string
          id?: string
          is_flagged?: boolean
          is_question?: boolean
          note: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          activity_type?: string
          author_id?: string
          author_role?: string
          created_at?: string
          id?: string
          is_flagged?: boolean
          is_question?: boolean
          note?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          activity_type: string
          ai_recovery_tips: string | null
          ai_summary: string | null
          created_at: string | null
          description: string
          duration_minutes: number | null
          exercises_mentioned: string[] | null
          id: string
          intensity: string | null
          logged_at: string | null
          user_id: string
          weight_level: string | null
        }
        Insert: {
          activity_type?: string
          ai_recovery_tips?: string | null
          ai_summary?: string | null
          created_at?: string | null
          description: string
          duration_minutes?: number | null
          exercises_mentioned?: string[] | null
          id?: string
          intensity?: string | null
          logged_at?: string | null
          user_id: string
          weight_level?: string | null
        }
        Update: {
          activity_type?: string
          ai_recovery_tips?: string | null
          ai_summary?: string | null
          created_at?: string | null
          description?: string
          duration_minutes?: number | null
          exercises_mentioned?: string[] | null
          id?: string
          intensity?: string | null
          logged_at?: string | null
          user_id?: string
          weight_level?: string | null
        }
        Relationships: []
      }
      ad_campaign_queue: {
        Row: {
          admin_notes: string | null
          campaign_content: string
          created_at: string
          id: string
          keywords: string[] | null
          monthly_budget: number | null
          platform: string
          projected_cac: number | null
          projected_ltv: number | null
          projected_roas: number | null
          reviewed_at: string | null
          service: string
          status: string
          target_audience: string | null
        }
        Insert: {
          admin_notes?: string | null
          campaign_content: string
          created_at?: string
          id?: string
          keywords?: string[] | null
          monthly_budget?: number | null
          platform: string
          projected_cac?: number | null
          projected_ltv?: number | null
          projected_roas?: number | null
          reviewed_at?: string | null
          service: string
          status?: string
          target_audience?: string | null
        }
        Update: {
          admin_notes?: string | null
          campaign_content?: string
          created_at?: string
          id?: string
          keywords?: string[] | null
          monthly_budget?: number | null
          platform?: string
          projected_cac?: number | null
          projected_ltv?: number | null
          projected_roas?: number | null
          reviewed_at?: string | null
          service?: string
          status?: string
          target_audience?: string | null
        }
        Relationships: []
      }
      ad_launch_drafts: {
        Row: {
          business_name: string
          city: string
          contractor_id: string | null
          created_at: string
          google_descriptions: string[] | null
          google_headlines: string[] | null
          google_keywords: string[] | null
          google_status: string | null
          id: string
          landing_url: string | null
          meta_campaign_id: string | null
          meta_daily_budget_cents: number | null
          meta_description: string | null
          meta_headline: string | null
          meta_image_prompt: string | null
          meta_image_url: string | null
          meta_launch_error: string | null
          meta_launched_at: string | null
          meta_primary_text: string | null
          meta_status: string | null
          meta_targeting: Json | null
          notes: string | null
          reviewed_at: string | null
          state: string | null
          status: string
          trade: string
          utm_params: string | null
        }
        Insert: {
          business_name: string
          city: string
          contractor_id?: string | null
          created_at?: string
          google_descriptions?: string[] | null
          google_headlines?: string[] | null
          google_keywords?: string[] | null
          google_status?: string | null
          id?: string
          landing_url?: string | null
          meta_campaign_id?: string | null
          meta_daily_budget_cents?: number | null
          meta_description?: string | null
          meta_headline?: string | null
          meta_image_prompt?: string | null
          meta_image_url?: string | null
          meta_launch_error?: string | null
          meta_launched_at?: string | null
          meta_primary_text?: string | null
          meta_status?: string | null
          meta_targeting?: Json | null
          notes?: string | null
          reviewed_at?: string | null
          state?: string | null
          status?: string
          trade: string
          utm_params?: string | null
        }
        Update: {
          business_name?: string
          city?: string
          contractor_id?: string | null
          created_at?: string
          google_descriptions?: string[] | null
          google_headlines?: string[] | null
          google_keywords?: string[] | null
          google_status?: string | null
          id?: string
          landing_url?: string | null
          meta_campaign_id?: string | null
          meta_daily_budget_cents?: number | null
          meta_description?: string | null
          meta_headline?: string | null
          meta_image_prompt?: string | null
          meta_image_url?: string | null
          meta_launch_error?: string | null
          meta_launched_at?: string | null
          meta_primary_text?: string | null
          meta_status?: string | null
          meta_targeting?: Json | null
          notes?: string | null
          reviewed_at?: string | null
          state?: string | null
          status?: string
          trade?: string
          utm_params?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_launch_drafts_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_spend_allocation: {
        Row: {
          created_at: string
          id: string
          monthly_budget: number | null
          notes: string | null
          percentage_allocation: number | null
          platform: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          monthly_budget?: number | null
          notes?: string | null
          percentage_allocation?: number | null
          platform: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          monthly_budget?: number | null
          notes?: string | null
          percentage_allocation?: number | null
          platform?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_media_files: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          metadata: Json | null
          tags: string[] | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string
          id?: string
          metadata?: Json | null
          tags?: string[] | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          metadata?: Json | null
          tags?: string[] | null
          uploaded_by?: string
        }
        Relationships: []
      }
      admin_trash: {
        Row: {
          deleted_at: string
          deleted_by: string
          expires_at: string
          id: string
          label: string
          original_data: Json
          original_id: string
          original_table: string
        }
        Insert: {
          deleted_at?: string
          deleted_by: string
          expires_at?: string
          id?: string
          label?: string
          original_data?: Json
          original_id: string
          original_table: string
        }
        Update: {
          deleted_at?: string
          deleted_by?: string
          expires_at?: string
          id?: string
          label?: string
          original_data?: Json
          original_id?: string
          original_table?: string
        }
        Relationships: []
      }
      ads_copy_clients: {
        Row: {
          active: boolean | null
          batch_count: number | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          stripe_customer_id: string | null
          target_keywords: string[] | null
        }
        Insert: {
          active?: boolean | null
          batch_count?: number | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
          target_keywords?: string[] | null
        }
        Update: {
          active?: boolean | null
          batch_count?: number | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
          target_keywords?: string[] | null
        }
        Relationships: []
      }
      ag_price_alert_clients: {
        Row: {
          active: boolean | null
          business_name: string | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      agency_candidate_assignments: {
        Row: {
          agency_id: string
          candidate_id: string
          charge_amount_cents: number | null
          charged_at: string | null
          delivered_at: string
          ghost_reason: string | null
          ghosted_at: string | null
          id: string
          interview_booked_at: string | null
          notes: string | null
          pitch_summary: string | null
          placed_at: string | null
          signal_strength: string | null
          status: string
          stripe_charge_id: string | null
          verification_id: string | null
          viewed_at: string | null
        }
        Insert: {
          agency_id: string
          candidate_id: string
          charge_amount_cents?: number | null
          charged_at?: string | null
          delivered_at?: string
          ghost_reason?: string | null
          ghosted_at?: string | null
          id?: string
          interview_booked_at?: string | null
          notes?: string | null
          pitch_summary?: string | null
          placed_at?: string | null
          signal_strength?: string | null
          status?: string
          stripe_charge_id?: string | null
          verification_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          agency_id?: string
          candidate_id?: string
          charge_amount_cents?: number | null
          charged_at?: string | null
          delivered_at?: string
          ghost_reason?: string | null
          ghosted_at?: string | null
          id?: string
          interview_booked_at?: string | null
          notes?: string | null
          pitch_summary?: string | null
          placed_at?: string | null
          signal_strength?: string | null
          status?: string
          stripe_charge_id?: string | null
          verification_id?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_candidate_assignments_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "staffing_agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_candidate_assignments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "hire_alert_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_territory_locks: {
        Row: {
          active: boolean
          agency_id: string
          county: string
          created_at: string
          expires_at: string | null
          id: string
          starts_at: string
          vertical: string
        }
        Insert: {
          active?: boolean
          agency_id: string
          county: string
          created_at?: string
          expires_at?: string | null
          id?: string
          starts_at?: string
          vertical: string
        }
        Update: {
          active?: boolean
          agency_id?: string
          county?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          starts_at?: string
          vertical?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_territory_locks_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "staffing_agency_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_heartbeats: {
        Row: {
          agent_name: string
          id: string
          last_beat: string
          metadata: Json | null
          status: string | null
        }
        Insert: {
          agent_name: string
          id?: string
          last_beat?: string
          metadata?: Json | null
          status?: string | null
        }
        Update: {
          agent_name?: string
          id?: string
          last_beat?: string
          metadata?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      agent_run_log: {
        Row: {
          agent_name: string
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          payload: Json | null
          result_count: number | null
          result_summary: string | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          agent_name: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          result_count?: number | null
          result_summary?: string | null
          status?: string
          triggered_by?: string | null
        }
        Update: {
          agent_name?: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          result_count?: number | null
          result_summary?: string | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      ai_action_queue: {
        Row: {
          action_type: string
          admin_notes: string | null
          ai_result: string
          context: Json
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          admin_notes?: string | null
          ai_result?: string
          context?: Json
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          admin_notes?: string | null
          ai_result?: string
          context?: Json
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      ai_call_log: {
        Row: {
          cache_tier: string
          caller: string
          cost_usd: number | null
          created_at: string
          error_message: string | null
          id: string
          latency_ms: number | null
          model: string
          provider: string
          success: boolean
          task: string
        }
        Insert: {
          cache_tier?: string
          caller: string
          cost_usd?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model: string
          provider: string
          success: boolean
          task: string
        }
        Update: {
          cache_tier?: string
          caller?: string
          cost_usd?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model?: string
          provider?: string
          success?: boolean
          task?: string
        }
        Relationships: []
      }
      ai_marketing_reports: {
        Row: {
          ai_analysis: Json | null
          created_at: string | null
          id: string
          raw_analytics: Json | null
          report_week: string
          status: string
          summary_text: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          created_at?: string | null
          id?: string
          raw_analytics?: Json | null
          report_week: string
          status?: string
          summary_text?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          created_at?: string | null
          id?: string
          raw_analytics?: Json | null
          report_week?: string
          status?: string
          summary_text?: string | null
        }
        Relationships: []
      }
      ai_media_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          error_message: string | null
          id: string
          parameters: Json | null
          prompt: string
          result_path: string | null
          result_url: string | null
          source_file_ids: string[]
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          error_message?: string | null
          id?: string
          parameters?: Json | null
          prompt: string
          result_path?: string | null
          result_url?: string | null
          source_file_ids?: string[]
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          error_message?: string | null
          id?: string
          parameters?: Json | null
          prompt?: string
          result_path?: string | null
          result_url?: string | null
          source_file_ids?: string[]
          status?: string
        }
        Relationships: []
      }
      annual_review_clients: {
        Row: {
          active: boolean | null
          business_name: string
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      api_health_checks: {
        Row: {
          api_name: string
          checked_at: string | null
          error_message: string | null
          id: string
          response_ms: number | null
          status: string
        }
        Insert: {
          api_name: string
          checked_at?: string | null
          error_message?: string | null
          id?: string
          response_ms?: number | null
          status?: string
        }
        Update: {
          api_name?: string
          checked_at?: string | null
          error_message?: string | null
          id?: string
          response_ms?: number | null
          status?: string
        }
        Relationships: []
      }
      apify_run_batches: {
        Row: {
          alerts_sent: number | null
          batch_id: string
          candidates_found: number | null
          created_at: string | null
          id: string
          indeed_done: boolean | null
          indeed_run_id: string | null
          linkedin_done: boolean | null
          linkedin_run_id: string | null
          miosha_done: boolean | null
          miosha_run_id: string | null
          run_at: string | null
        }
        Insert: {
          alerts_sent?: number | null
          batch_id: string
          candidates_found?: number | null
          created_at?: string | null
          id?: string
          indeed_done?: boolean | null
          indeed_run_id?: string | null
          linkedin_done?: boolean | null
          linkedin_run_id?: string | null
          miosha_done?: boolean | null
          miosha_run_id?: string | null
          run_at?: string | null
        }
        Update: {
          alerts_sent?: number | null
          batch_id?: string
          candidates_found?: number | null
          created_at?: string | null
          id?: string
          indeed_done?: boolean | null
          indeed_run_id?: string | null
          linkedin_done?: boolean | null
          linkedin_run_id?: string | null
          miosha_done?: boolean | null
          miosha_run_id?: string | null
          run_at?: string | null
        }
        Relationships: []
      }
      appointment_reminders: {
        Row: {
          active: boolean | null
          business_name: string
          client_id: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          phone: string | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          client_id: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          phone?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          client_id?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          phone?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      b2b_clients: {
        Row: {
          business_name: string
          city: string | null
          created_at: string
          email: string
          id: string
          industry: string | null
          notes: string | null
          owner_name: string | null
          phone: string | null
          source: string | null
          state: string | null
          stripe_customer_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          business_name: string
          city?: string | null
          created_at?: string
          email: string
          id?: string
          industry?: string | null
          notes?: string | null
          owner_name?: string | null
          phone?: string | null
          source?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          business_name?: string
          city?: string | null
          created_at?: string
          email?: string
          id?: string
          industry?: string | null
          notes?: string | null
          owner_name?: string | null
          phone?: string | null
          source?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      b2b_referral_conversions: {
        Row: {
          client_email: string
          commission_amount: number
          created_at: string
          id: string
          paid_at: string | null
          partner_id: string
          service_type: string
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          client_email: string
          commission_amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          partner_id: string
          service_type: string
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          client_email?: string
          commission_amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          partner_id?: string
          service_type?: string
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_referral_conversions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "b2b_referral_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_referral_partners: {
        Row: {
          commission_type: string
          commission_value: number
          created_at: string
          email: string
          id: string
          name: string
          payout_handle: string | null
          payout_threshold: number
          referral_code: string
          status: string
          total_earned: number
        }
        Insert: {
          commission_type?: string
          commission_value?: number
          created_at?: string
          email: string
          id?: string
          name: string
          payout_handle?: string | null
          payout_threshold?: number
          referral_code: string
          status?: string
          total_earned?: number
        }
        Update: {
          commission_type?: string
          commission_value?: number
          created_at?: string
          email?: string
          id?: string
          name?: string
          payout_handle?: string | null
          payout_threshold?: number
          referral_code?: string
          status?: string
          total_earned?: number
        }
        Relationships: []
      }
      battlecard_clients: {
        Row: {
          active: boolean | null
          business_name: string
          competitor_names: string[] | null
          competitor_urls: string[] | null
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          phone: string | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          competitor_names?: string[] | null
          competitor_urls?: string[] | null
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          phone?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          competitor_names?: string[] | null
          competitor_urls?: string[] | null
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          phone?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      birthday_campaign_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
          twilio_number: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          twilio_number?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          twilio_number?: string | null
        }
        Relationships: []
      }
      blind_teaser_dispatches: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          candidate_ids: string[]
          city_summary: string | null
          created_at: string
          dispatched_at: string | null
          email_html: string
          id: string
          paid_unlocks: number | null
          recipient_count: number | null
          status: string
          subject: string
          trade_summary: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          candidate_ids: string[]
          city_summary?: string | null
          created_at?: string
          dispatched_at?: string | null
          email_html: string
          id?: string
          paid_unlocks?: number | null
          recipient_count?: number | null
          status?: string
          subject: string
          trade_summary?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          candidate_ids?: string[]
          city_summary?: string | null
          created_at?: string
          dispatched_at?: string | null
          email_html?: string
          id?: string
          paid_unlocks?: number | null
          recipient_count?: number | null
          status?: string
          subject?: string
          trade_summary?: string | null
        }
        Relationships: []
      }
      blog_post_clients: {
        Row: {
          active: boolean | null
          auto_publish: boolean | null
          business_name: string
          cms_app_password_enc: string | null
          cms_type: string | null
          cms_url: string | null
          cms_username_enc: string | null
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          post_count: number | null
          stripe_customer_id: string | null
          target_keywords: string[] | null
        }
        Insert: {
          active?: boolean | null
          auto_publish?: boolean | null
          business_name: string
          cms_app_password_enc?: string | null
          cms_type?: string | null
          cms_url?: string | null
          cms_username_enc?: string | null
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          post_count?: number | null
          stripe_customer_id?: string | null
          target_keywords?: string[] | null
        }
        Update: {
          active?: boolean | null
          auto_publish?: boolean | null
          business_name?: string
          cms_app_password_enc?: string | null
          cms_type?: string | null
          cms_url?: string | null
          cms_username_enc?: string | null
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          post_count?: number | null
          stripe_customer_id?: string | null
          target_keywords?: string[] | null
        }
        Relationships: []
      }
      business_listings: {
        Row: {
          business_name: string
          city: string | null
          created_at: string | null
          description: string | null
          email: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          is_featured: boolean | null
          logo_url: string | null
          owner_name: string | null
          phone: string | null
          source_id: string | null
          source_table: string | null
          state: string | null
          stripe_customer_id: string | null
          tier: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          business_name: string
          city?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          logo_url?: string | null
          owner_name?: string | null
          phone?: string | null
          source_id?: string | null
          source_table?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          tier?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          business_name?: string
          city?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          logo_url?: string | null
          owner_name?: string | null
          phone?: string | null
          source_id?: string | null
          source_table?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          tier?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      business_strategy: {
        Row: {
          competitive_advantages: string[] | null
          created_at: string
          id: string
          key_risks: string[] | null
          mission_statement: string | null
          monthly_overhead_target: number | null
          monthly_revenue_target: number | null
          primary_targets: string[] | null
          quarterly_goals: Json | null
          secondary_targets: string[] | null
          updated_at: string
        }
        Insert: {
          competitive_advantages?: string[] | null
          created_at?: string
          id?: string
          key_risks?: string[] | null
          mission_statement?: string | null
          monthly_overhead_target?: number | null
          monthly_revenue_target?: number | null
          primary_targets?: string[] | null
          quarterly_goals?: Json | null
          secondary_targets?: string[] | null
          updated_at?: string
        }
        Update: {
          competitive_advantages?: string[] | null
          created_at?: string
          id?: string
          key_risks?: string[] | null
          mission_statement?: string | null
          monthly_overhead_target?: number | null
          monthly_revenue_target?: number | null
          primary_targets?: string[] | null
          quarterly_goals?: Json | null
          secondary_targets?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      call_outreach_log: {
        Row: {
          call_date: string
          created_at: string
          decision_maker: string | null
          id: string
          notes: string | null
          outcome: string
          signal_id: string | null
          target_company: string
          target_phone: string | null
        }
        Insert: {
          call_date?: string
          created_at?: string
          decision_maker?: string | null
          id?: string
          notes?: string | null
          outcome?: string
          signal_id?: string | null
          target_company: string
          target_phone?: string | null
        }
        Update: {
          call_date?: string
          created_at?: string
          decision_maker?: string | null
          id?: string
          notes?: string | null
          outcome?: string
          signal_id?: string | null
          target_company?: string
          target_phone?: string | null
        }
        Relationships: []
      }
      call_summaries: {
        Row: {
          callback_needed: boolean | null
          caller_name: string | null
          caller_phone: string | null
          client_id: string | null
          created_at: string | null
          id: string
          intent: string | null
          summary: string | null
          urgency: string | null
        }
        Insert: {
          callback_needed?: boolean | null
          caller_name?: string | null
          caller_phone?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          summary?: string | null
          urgency?: string | null
        }
        Update: {
          callback_needed?: boolean | null
          caller_name?: string | null
          caller_phone?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          summary?: string | null
          urgency?: string | null
        }
        Relationships: []
      }
      campaign_copy_variants: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          id: string
          selected: boolean | null
          sms_body: string
          variant_label: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          selected?: boolean | null
          sms_body: string
          variant_label: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          id?: string
          selected?: boolean | null
          sms_body?: string
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_copy_variants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "dead_lead_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_enrichment_log: {
        Row: {
          candidate_id: string
          cost_estimate: number | null
          created_at: string | null
          error_message: string | null
          hit_fields: string[] | null
          id: string
          raw_response: Json | null
          source: string
          stage: string
          success: boolean | null
        }
        Insert: {
          candidate_id: string
          cost_estimate?: number | null
          created_at?: string | null
          error_message?: string | null
          hit_fields?: string[] | null
          id?: string
          raw_response?: Json | null
          source: string
          stage: string
          success?: boolean | null
        }
        Update: {
          candidate_id?: string
          cost_estimate?: number | null
          created_at?: string | null
          error_message?: string | null
          hit_fields?: string[] | null
          id?: string
          raw_response?: Json | null
          source?: string
          stage?: string
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_enrichment_log_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "hire_alert_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      capture_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          processed: boolean
          source_url: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          processed?: boolean
          source_url?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          processed?: boolean
          source_url?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capture_submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_entries: {
        Row: {
          id: string
          logged_at: string
          participant_id: string
          user_id: string
          value: number
        }
        Insert: {
          id?: string
          logged_at?: string
          participant_id: string
          user_id: string
          value?: number
        }
        Update: {
          id?: string
          logged_at?: string
          participant_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_entries_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "challenge_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          current_value: number
          id: string
          is_public: boolean
          joined_at: string
          monthly_challenge_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          current_value?: number
          id?: string
          is_public?: boolean
          joined_at?: string
          monthly_challenge_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          current_value?: number
          id?: string
          is_public?: boolean
          joined_at?: string
          monthly_challenge_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_monthly_challenge_id_fkey"
            columns: ["monthly_challenge_id"]
            isOneToOne: false
            referencedRelation: "monthly_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_clients: {
        Row: {
          active: boolean | null
          business_name: string
          chat_count: number | null
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_active_at: string | null
          stripe_customer_id: string | null
          website_url: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          chat_count?: number | null
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_active_at?: string | null
          stripe_customer_id?: string | null
          website_url?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          chat_count?: number | null
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_active_at?: string | null
          stripe_customer_id?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      citation_monitor_clients: {
        Row: {
          active: boolean | null
          business_name: string | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      client_addons: {
        Row: {
          activated_at: string
          cancelled_at: string | null
          id: string
          lead_id: string | null
          price_cents: number
          service_key: string
          service_name: string
          status: string
          stripe_subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          activated_at?: string
          cancelled_at?: string | null
          id?: string
          lead_id?: string | null
          price_cents?: number
          service_key: string
          service_name: string
          status?: string
          stripe_subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          activated_at?: string
          cancelled_at?: string | null
          id?: string
          lead_id?: string | null
          price_cents?: number
          service_key?: string
          service_name?: string
          status?: string
          stripe_subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_addons_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "web_design_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assessments: {
        Row: {
          admin_user_id: string
          ai_findings: Json | null
          client_user_id: string
          created_at: string
          draft_program: Json | null
          id: string
          media_url: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          ai_findings?: Json | null
          client_user_id: string
          created_at?: string
          draft_program?: Json | null
          id?: string
          media_url: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          ai_findings?: Json | null
          client_user_id?: string
          created_at?: string
          draft_program?: Json | null
          id?: string
          media_url?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_ranking_snapshots: {
        Row: {
          checked_at: string | null
          client_id: string | null
          id: string
          keyword: string
          local_pack: boolean | null
          position: number | null
        }
        Insert: {
          checked_at?: string | null
          client_id?: string | null
          id?: string
          keyword: string
          local_pack?: boolean | null
          position?: number | null
        }
        Update: {
          checked_at?: string | null
          client_id?: string | null
          id?: string
          keyword?: string
          local_pack?: boolean | null
          position?: number | null
        }
        Relationships: []
      }
      client_report_clients: {
        Row: {
          active: boolean | null
          business_name: string
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      client_roi_monthly: {
        Row: {
          candidates_contacted: number | null
          candidates_hired: number | null
          candidates_surfaced: number | null
          client_id: string | null
          created_at: string
          digest_sent_at: string | null
          estimated_fee_revenue: number | null
          id: string
          month_start: string
          roi_multiplier: number | null
          subscription_cost: number | null
        }
        Insert: {
          candidates_contacted?: number | null
          candidates_hired?: number | null
          candidates_surfaced?: number | null
          client_id?: string | null
          created_at?: string
          digest_sent_at?: string | null
          estimated_fee_revenue?: number | null
          id?: string
          month_start: string
          roi_multiplier?: number | null
          subscription_cost?: number | null
        }
        Update: {
          candidates_contacted?: number | null
          candidates_hired?: number | null
          candidates_surfaced?: number | null
          client_id?: string | null
          created_at?: string
          digest_sent_at?: string | null
          estimated_fee_revenue?: number | null
          id?: string
          month_start?: string
          roi_multiplier?: number | null
          subscription_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_roi_monthly_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "hire_alert_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_ai_drafts: {
        Row: {
          admin_edit: string | null
          ai_answer: string
          created_at: string | null
          id: string
          question: string
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_edit?: string | null
          ai_answer: string
          created_at?: string | null
          id?: string
          question: string
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_edit?: string | null
          ai_answer?: string
          created_at?: string | null
          id?: string
          question?: string
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_direct_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_id: string
          sender_role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_id: string
          sender_role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_id?: string
          sender_role?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_notes: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          note: string
          progress_log_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          note: string
          progress_log_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          note?: string
          progress_log_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_notes_progress_log_id_fkey"
            columns: ["progress_log_id"]
            isOneToOne: false
            referencedRelation: "progress_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_profiles: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          max_athletes: number
          school_name: string
          sport: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          max_athletes?: number
          school_name?: string
          sport?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          max_athletes?: number
          school_name?: string
          sport?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coaching_documents: {
        Row: {
          content: string
          created_at: string | null
          id: string
          search_vector: unknown
          title: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          search_vector?: unknown
          title?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          search_vector?: unknown
          title?: string | null
        }
        Relationships: []
      }
      collections_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      collections_contacts: {
        Row: {
          amount_owed: number | null
          client_id: string
          created_at: string | null
          days_overdue: number | null
          debtor_email: string | null
          debtor_name: string
          debtor_phone: string | null
          escalation_level: number | null
          id: string
          last_sent_at: string | null
        }
        Insert: {
          amount_owed?: number | null
          client_id: string
          created_at?: string | null
          days_overdue?: number | null
          debtor_email?: string | null
          debtor_name: string
          debtor_phone?: string | null
          escalation_level?: number | null
          id?: string
          last_sent_at?: string | null
        }
        Update: {
          amount_owed?: number | null
          client_id?: string
          created_at?: string | null
          days_overdue?: number | null
          debtor_email?: string | null
          debtor_name?: string
          debtor_phone?: string | null
          escalation_level?: number | null
          id?: string
          last_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collections_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "collections_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      community_workouts: {
        Row: {
          created_at: string
          creator_name: string
          description: string | null
          exercises: Json
          id: string
          is_public: boolean
          likes_count: number
          source_type: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creator_name?: string
          description?: string | null
          exercises?: Json
          id?: string
          is_public?: boolean
          likes_count?: number
          source_type?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          creator_name?: string
          description?: string | null
          exercises?: Json
          id?: string
          is_public?: boolean
          likes_count?: number
          source_type?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      companies_watchlist: {
        Row: {
          client_id: string
          company_name: string
          created_at: string
          id: string
          notes: string | null
        }
        Insert: {
          client_id: string
          company_name: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Update: {
          client_id?: string
          company_name?: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      competitor_alerts: {
        Row: {
          alert_type: string
          created_at: string
          details: Json | null
          id: string
          monitor_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          details?: Json | null
          id?: string
          monitor_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          monitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_alerts_monitor_id_fkey"
            columns: ["monitor_id"]
            isOneToOne: false
            referencedRelation: "competitor_monitors"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_monitors: {
        Row: {
          client_id: string
          client_table: string
          competitor_name: string
          created_at: string
          google_business_url: string | null
          id: string
          last_avg_rating: number | null
          last_review_count: number | null
          last_scanned_at: string | null
          license_number: string | null
        }
        Insert: {
          client_id: string
          client_table?: string
          competitor_name: string
          created_at?: string
          google_business_url?: string | null
          id?: string
          last_avg_rating?: number | null
          last_review_count?: number | null
          last_scanned_at?: string | null
          license_number?: string | null
        }
        Update: {
          client_id?: string
          client_table?: string
          competitor_name?: string
          created_at?: string
          google_business_url?: string | null
          id?: string
          last_avg_rating?: number | null
          last_review_count?: number | null
          last_scanned_at?: string | null
          license_number?: string | null
        }
        Relationships: []
      }
      competitor_pricing_changes: {
        Row: {
          client_id: string | null
          created_at: string | null
          diff_summary: string | null
          id: string
          new_hash: string | null
          notified: boolean | null
          old_hash: string | null
          url_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          diff_summary?: string | null
          id?: string
          new_hash?: string | null
          notified?: boolean | null
          old_hash?: string | null
          url_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          diff_summary?: string | null
          id?: string
          new_hash?: string | null
          notified?: boolean | null
          old_hash?: string | null
          url_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_pricing_changes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "competitor_pricing_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_pricing_changes_url_id_fkey"
            columns: ["url_id"]
            isOneToOne: false
            referencedRelation: "competitor_pricing_urls"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_pricing_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
        }
        Relationships: []
      }
      competitor_pricing_urls: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          label: string | null
          last_checked_at: string | null
          last_hash: string | null
          url: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
          last_checked_at?: string | null
          last_hash?: string | null
          url: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
          last_checked_at?: string | null
          last_hash?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_pricing_urls_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "competitor_pricing_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_review_alerts: {
        Row: {
          client_id: string
          competitor_name: string
          competitor_place_id: string | null
          created_at: string | null
          id: string
          outreach_phone: string | null
          outreach_sent: boolean | null
          outreach_sent_at: string | null
          platform: string | null
          review_text: string | null
          reviewer_name: string | null
          star_rating: number | null
        }
        Insert: {
          client_id: string
          competitor_name: string
          competitor_place_id?: string | null
          created_at?: string | null
          id?: string
          outreach_phone?: string | null
          outreach_sent?: boolean | null
          outreach_sent_at?: string | null
          platform?: string | null
          review_text?: string | null
          reviewer_name?: string | null
          star_rating?: number | null
        }
        Update: {
          client_id?: string
          competitor_name?: string
          competitor_place_id?: string | null
          created_at?: string | null
          id?: string
          outreach_phone?: string | null
          outreach_sent?: boolean | null
          outreach_sent_at?: string | null
          platform?: string | null
          review_text?: string | null
          reviewer_name?: string | null
          star_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_review_alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "field_crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_threat_log: {
        Row: {
          alerted_at: string | null
          client_id: string | null
          client_position: number | null
          competitor: string | null
          competitor_position: number | null
          id: string
          keyword: string
        }
        Insert: {
          alerted_at?: string | null
          client_id?: string | null
          client_position?: number | null
          competitor?: string | null
          competitor_position?: number | null
          id?: string
          keyword: string
        }
        Update: {
          alerted_at?: string | null
          client_id?: string | null
          client_position?: number | null
          competitor?: string | null
          competitor_position?: number | null
          id?: string
          keyword?: string
        }
        Relationships: []
      }
      competitor_watch_clients: {
        Row: {
          active: boolean | null
          business_name: string
          competitor_urls: string[] | null
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_report_at: string | null
          report_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          competitor_urls?: string[] | null
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_report_at?: string | null
          report_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          competitor_urls?: string[] | null
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_report_at?: string | null
          report_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      compliance_blocks: {
        Row: {
          created_at: string
          id: string
          phone: string
          product: string | null
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          phone: string
          product?: string | null
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string
          product?: string | null
          reason?: string
        }
        Relationships: []
      }
      content_queue: {
        Row: {
          caption: string
          content_type: string
          created_at: string | null
          hashtags: string | null
          id: string
          status: string | null
        }
        Insert: {
          caption: string
          content_type: string
          created_at?: string | null
          hashtags?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          caption?: string
          content_type?: string
          created_at?: string | null
          hashtags?: string | null
          id?: string
          status?: string | null
        }
        Relationships: []
      }
      contractor_ad_budget_log: {
        Row: {
          agent: string
          contractor_id: string
          created_at: string
          id: string
          metadata: Json | null
          new_budget: number
          old_budget: number | null
          reason: string
        }
        Insert: {
          agent?: string
          contractor_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_budget: number
          old_budget?: number | null
          reason: string
        }
        Update: {
          agent?: string
          contractor_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_budget?: number
          old_budget?: number | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_ad_budget_log_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_ad_spend: {
        Row: {
          contractor_id: string
          created_at: string
          id: string
          leads_delivered: number
          month: string
          notes: string | null
          recommended_budget_next_30d: number | null
          spend_usd: number
          updated_at: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          id?: string
          leads_delivered?: number
          month: string
          notes?: string | null
          recommended_budget_next_30d?: number | null
          spend_usd?: number
          updated_at?: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          id?: string
          leads_delivered?: number
          month?: string
          notes?: string | null
          recommended_budget_next_30d?: number | null
          spend_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_ad_spend_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_clients: {
        Row: {
          active: boolean | null
          average_ticket_value: number
          business_name: string
          city: string | null
          created_at: string | null
          dead_lead_billing_active: boolean | null
          email: string
          free_dead_leads_quota: number
          free_dead_leads_used: number
          google_review_link: string | null
          id: string
          industry: string | null
          last_lead_at: string | null
          last_roi_sms_sent_at: string | null
          lead_count: number | null
          name: string | null
          onboarded_at: string | null
          phone: string | null
          refund_credits_cents: number
          roi_token: string | null
          service_area: string | null
          state: string | null
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          stripe_subscription_id: string | null
          trade: string | null
        }
        Insert: {
          active?: boolean | null
          average_ticket_value?: number
          business_name: string
          city?: string | null
          created_at?: string | null
          dead_lead_billing_active?: boolean | null
          email: string
          free_dead_leads_quota?: number
          free_dead_leads_used?: number
          google_review_link?: string | null
          id?: string
          industry?: string | null
          last_lead_at?: string | null
          last_roi_sms_sent_at?: string | null
          lead_count?: number | null
          name?: string | null
          onboarded_at?: string | null
          phone?: string | null
          refund_credits_cents?: number
          roi_token?: string | null
          service_area?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_subscription_id?: string | null
          trade?: string | null
        }
        Update: {
          active?: boolean | null
          average_ticket_value?: number
          business_name?: string
          city?: string | null
          created_at?: string | null
          dead_lead_billing_active?: boolean | null
          email?: string
          free_dead_leads_quota?: number
          free_dead_leads_used?: number
          google_review_link?: string | null
          id?: string
          industry?: string | null
          last_lead_at?: string | null
          last_roi_sms_sent_at?: string | null
          lead_count?: number | null
          name?: string | null
          onboarded_at?: string | null
          phone?: string | null
          refund_credits_cents?: number
          roi_token?: string | null
          service_area?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_subscription_id?: string | null
          trade?: string | null
        }
        Relationships: []
      }
      contractor_lead_boosts: {
        Row: {
          activated_at: string | null
          boost_amount: number
          boost_type: string
          contractor_id: string
          created_at: string
          fee_amount: number
          id: string
          net_ad_spend: number
          status: string
          stripe_charge_id: string | null
          stripe_session_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          activated_at?: string | null
          boost_amount: number
          boost_type?: string
          contractor_id: string
          created_at?: string
          fee_amount: number
          id?: string
          net_ad_spend: number
          status?: string
          stripe_charge_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          activated_at?: string | null
          boost_amount?: number
          boost_type?: string
          contractor_id?: string
          created_at?: string
          fee_amount?: number
          id?: string
          net_ad_spend?: number
          status?: string
          stripe_charge_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_lead_boosts_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_lead_purchases: {
        Row: {
          amount_cents: number
          city: string | null
          contractor_email: string | null
          contractor_id: string
          created_at: string
          id: string
          lead_id: string | null
          refunded_at: string | null
          stripe_session_id: string | null
          trade: string | null
          unreachable_attempts: number
        }
        Insert: {
          amount_cents?: number
          city?: string | null
          contractor_email?: string | null
          contractor_id: string
          created_at?: string
          id?: string
          lead_id?: string | null
          refunded_at?: string | null
          stripe_session_id?: string | null
          trade?: string | null
          unreachable_attempts?: number
        }
        Update: {
          amount_cents?: number
          city?: string | null
          contractor_email?: string | null
          contractor_id?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          refunded_at?: string | null
          stripe_session_id?: string | null
          trade?: string | null
          unreachable_attempts?: number
        }
        Relationships: [
          {
            foreignKeyName: "contractor_lead_purchases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "contractor_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_lead_sites: {
        Row: {
          active: boolean | null
          active_contractor_id: string | null
          city: string
          created_at: string | null
          facebook_page_id: string | null
          id: string
          slug: string
          state: string
          trade: string
        }
        Insert: {
          active?: boolean | null
          active_contractor_id?: string | null
          city: string
          created_at?: string | null
          facebook_page_id?: string | null
          id?: string
          slug: string
          state?: string
          trade: string
        }
        Update: {
          active?: boolean | null
          active_contractor_id?: string | null
          city?: string
          created_at?: string | null
          facebook_page_id?: string | null
          id?: string
          slug?: string
          state?: string
          trade?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_lead_sites_active_contractor_id_fkey"
            columns: ["active_contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_lead_views: {
        Row: {
          city: string | null
          contractor_id: string
          created_at: string
          id: string
          lead_id: string | null
          reason: string | null
          trade: string | null
        }
        Insert: {
          city?: string | null
          contractor_id: string
          created_at?: string
          id?: string
          lead_id?: string | null
          reason?: string | null
          trade?: string | null
        }
        Update: {
          city?: string | null
          contractor_id?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          reason?: string | null
          trade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_lead_views_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "contractor_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_leads: {
        Row: {
          ai_summary: string | null
          attempt_count: number | null
          bidding_mode: boolean | null
          checkout_locked_by: string | null
          claimed_at: string | null
          claimed_by: string | null
          client_id: string | null
          contact_preference: string
          created_at: string | null
          email: string | null
          id: string
          is_aged: boolean
          is_demo_record: boolean | null
          lock_expires_at: string | null
          message: string | null
          name: string
          notified_at: string | null
          paid_by_contractor_id: string | null
          payment_amount_cents: number | null
          payment_session_id: string | null
          phone: string
          phone_verified: boolean | null
          project_type: string | null
          quality_score: number | null
          refunded_at: string | null
          site_id: string | null
          source: string | null
          status: string | null
        }
        Insert: {
          ai_summary?: string | null
          attempt_count?: number | null
          bidding_mode?: boolean | null
          checkout_locked_by?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          client_id?: string | null
          contact_preference?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_aged?: boolean
          is_demo_record?: boolean | null
          lock_expires_at?: string | null
          message?: string | null
          name: string
          notified_at?: string | null
          paid_by_contractor_id?: string | null
          payment_amount_cents?: number | null
          payment_session_id?: string | null
          phone: string
          phone_verified?: boolean | null
          project_type?: string | null
          quality_score?: number | null
          refunded_at?: string | null
          site_id?: string | null
          source?: string | null
          status?: string | null
        }
        Update: {
          ai_summary?: string | null
          attempt_count?: number | null
          bidding_mode?: boolean | null
          checkout_locked_by?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          client_id?: string | null
          contact_preference?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_aged?: boolean
          is_demo_record?: boolean | null
          lock_expires_at?: string | null
          message?: string | null
          name?: string
          notified_at?: string | null
          paid_by_contractor_id?: string | null
          payment_amount_cents?: number | null
          payment_session_id?: string | null
          phone?: string
          phone_verified?: boolean | null
          project_type?: string | null
          quality_score?: number | null
          refunded_at?: string | null
          site_id?: string | null
          source?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contractor_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_leads_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "contractor_lead_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_provisioning_audit: {
        Row: {
          business_name: string | null
          contractor_email: string | null
          contractor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          outcome: string
          reason: string | null
          stripe_customer_id: string | null
          stripe_event_id: string | null
          stripe_event_type: string | null
          stripe_session_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          business_name?: string | null
          contractor_email?: string | null
          contractor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          outcome: string
          reason?: string | null
          stripe_customer_id?: string | null
          stripe_event_id?: string | null
          stripe_event_type?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          business_name?: string | null
          contractor_email?: string | null
          contractor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          outcome?: string
          reason?: string | null
          stripe_customer_id?: string | null
          stripe_event_id?: string | null
          stripe_event_type?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      contractor_referrals: {
        Row: {
          converted_at: string | null
          created_at: string
          credit_amount_cents: number
          id: string
          referral_code: string
          referred_contractor_id: string | null
          referred_email: string | null
          referrer_contractor_id: string
          status: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          credit_amount_cents?: number
          id?: string
          referral_code: string
          referred_contractor_id?: string | null
          referred_email?: string | null
          referrer_contractor_id: string
          status?: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          credit_amount_cents?: number
          id?: string
          referral_code?: string
          referred_contractor_id?: string | null
          referred_email?: string | null
          referrer_contractor_id?: string
          status?: string
        }
        Relationships: []
      }
      contractor_welcome_log: {
        Row: {
          attempted_by: string
          body_preview: string | null
          contractor_id: string
          created_at: string
          error_message: string | null
          id: string
          message_index: number
          recipient_phone: string | null
          stale_alerted: boolean
          status: string
          twilio_error_code: string | null
          twilio_sid: string | null
          twilio_status: string | null
          updated_at: string
        }
        Insert: {
          attempted_by?: string
          body_preview?: string | null
          contractor_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_index: number
          recipient_phone?: string | null
          stale_alerted?: boolean
          status?: string
          twilio_error_code?: string | null
          twilio_sid?: string | null
          twilio_status?: string | null
          updated_at?: string
        }
        Update: {
          attempted_by?: string
          body_preview?: string | null
          contractor_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_index?: number
          recipient_phone?: string | null
          stale_alerted?: boolean
          status?: string
          twilio_error_code?: string | null
          twilio_sid?: string | null
          twilio_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_visitor_events: {
        Row: {
          city: string | null
          client_id: string
          company_name: string | null
          country: string | null
          created_at: string | null
          enrichment_data: Json | null
          id: string
          ip_address: string | null
          is_business: boolean | null
          isp: string | null
          last_seen_at: string | null
          lead_auto_created: boolean | null
          org: string | null
          page_visited: string | null
          pipeline_lead_id: string | null
          referrer: string | null
          region: string | null
          visit_count: number | null
          visitor_script_key: string
        }
        Insert: {
          city?: string | null
          client_id: string
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          enrichment_data?: Json | null
          id?: string
          ip_address?: string | null
          is_business?: boolean | null
          isp?: string | null
          last_seen_at?: string | null
          lead_auto_created?: boolean | null
          org?: string | null
          page_visited?: string | null
          pipeline_lead_id?: string | null
          referrer?: string | null
          region?: string | null
          visit_count?: number | null
          visitor_script_key: string
        }
        Update: {
          city?: string | null
          client_id?: string
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          enrichment_data?: Json | null
          id?: string
          ip_address?: string | null
          is_business?: boolean | null
          isp?: string | null
          last_seen_at?: string | null
          lead_auto_created?: boolean | null
          org?: string | null
          page_visited?: string | null
          pipeline_lead_id?: string | null
          referrer?: string | null
          region?: string | null
          visit_count?: number | null
          visitor_script_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_visitor_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "field_crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_job_health: {
        Row: {
          consecutive_failures: number
          expected_interval_minutes: number | null
          jobname: string
          last_error: string | null
          last_failure_at: string | null
          last_success_at: string | null
          next_run_at: string | null
          stale_after_minutes: number | null
          total_runs: number
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          expected_interval_minutes?: number | null
          jobname: string
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          next_run_at?: string | null
          stale_after_minutes?: number | null
          total_runs?: number
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          expected_interval_minutes?: number | null
          jobname?: string
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          next_run_at?: string | null
          stale_after_minutes?: number | null
          total_runs?: number
          updated_at?: string
        }
        Relationships: []
      }
      cron_schedule_audit: {
        Row: {
          attempted_at: string
          attempted_by: string | null
          command: string | null
          error_message: string | null
          error_rule: string | null
          id: string
          jobname: string
          mode: string
          outcome: string
          schedule: string | null
        }
        Insert: {
          attempted_at?: string
          attempted_by?: string | null
          command?: string | null
          error_message?: string | null
          error_rule?: string | null
          id?: string
          jobname: string
          mode?: string
          outcome: string
          schedule?: string | null
        }
        Update: {
          attempted_at?: string
          attempted_by?: string | null
          command?: string | null
          error_message?: string | null
          error_rule?: string | null
          id?: string
          jobname?: string
          mode?: string
          outcome?: string
          schedule?: string | null
        }
        Relationships: []
      }
      cron_schedule_history: {
        Row: {
          active: boolean
          command: string
          id: string
          jobname: string
          replaced_at: string
          replaced_by: string
          schedule: string
        }
        Insert: {
          active?: boolean
          command: string
          id?: string
          jobname: string
          replaced_at?: string
          replaced_by?: string
          schedule: string
        }
        Update: {
          active?: boolean
          command?: string
          id?: string
          jobname?: string
          replaced_at?: string
          replaced_by?: string
          schedule?: string
        }
        Relationships: []
      }
      cron_sentinel_alerts: {
        Row: {
          checked_at: string
          failure_details: Json
          failures: number
          full_report: Json
          id: string
          notified_admin: boolean
          status: string
          total_checks: number
          trigger_source: string | null
        }
        Insert: {
          checked_at?: string
          failure_details?: Json
          failures?: number
          full_report?: Json
          id?: string
          notified_admin?: boolean
          status: string
          total_checks?: number
          trigger_source?: string | null
        }
        Update: {
          checked_at?: string
          failure_details?: Json
          failures?: number
          full_report?: Json
          id?: string
          notified_admin?: boolean
          status?: string
          total_checks?: number
          trigger_source?: string | null
        }
        Relationships: []
      }
      cron_sentinel_snoozes: {
        Row: {
          created_at: string
          created_by: string | null
          cron_name: string
          reason: string | null
          snoozed_until: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cron_name: string
          reason?: string | null
          snoozed_until: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cron_name?: string
          reason?: string | null
          snoozed_until?: string
        }
        Relationships: []
      }
      cross_product_signals: {
        Row: {
          county: string | null
          created_at: string
          employer_name: string | null
          id: string
          pitch_angle: string | null
          routed_to: string | null
          signal_type: string
          source_id: string | null
          source_table: string | null
          status: string | null
          trade: string | null
        }
        Insert: {
          county?: string | null
          created_at?: string
          employer_name?: string | null
          id?: string
          pitch_angle?: string | null
          routed_to?: string | null
          signal_type: string
          source_id?: string | null
          source_table?: string | null
          status?: string | null
          trade?: string | null
        }
        Update: {
          county?: string | null
          created_at?: string
          employer_name?: string | null
          id?: string
          pitch_angle?: string | null
          routed_to?: string | null
          signal_type?: string
          source_id?: string | null
          source_table?: string | null
          status?: string | null
          trade?: string | null
        }
        Relationships: []
      }
      cross_sell_queue: {
        Row: {
          business_name: string | null
          created_at: string | null
          email: string
          id: string
          send_at: string
          sent: boolean | null
          stripe_payment_id: string | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          send_at: string
          sent?: boolean | null
          stripe_payment_id?: string | null
        }
        Update: {
          business_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          send_at?: string
          sent?: boolean | null
          stripe_payment_id?: string | null
        }
        Relationships: []
      }
      custom_program_requests: {
        Row: {
          additional_notes: string | null
          admin_notes: string | null
          age: string | null
          created_at: string
          days_per_week: string | null
          equipment: string | null
          experience: string | null
          generated_program_id: string | null
          goals: string | null
          id: string
          injuries: string | null
          name: string
          reviewed_at: string | null
          sport: string | null
          status: string
          user_id: string
        }
        Insert: {
          additional_notes?: string | null
          admin_notes?: string | null
          age?: string | null
          created_at?: string
          days_per_week?: string | null
          equipment?: string | null
          experience?: string | null
          generated_program_id?: string | null
          goals?: string | null
          id?: string
          injuries?: string | null
          name: string
          reviewed_at?: string | null
          sport?: string | null
          status?: string
          user_id: string
        }
        Update: {
          additional_notes?: string | null
          admin_notes?: string | null
          age?: string | null
          created_at?: string
          days_per_week?: string | null
          equipment?: string | null
          experience?: string | null
          generated_program_id?: string | null
          goals?: string | null
          id?: string
          injuries?: string | null
          name?: string
          reviewed_at?: string | null
          sport?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_program_requests_generated_program_id_fkey"
            columns: ["generated_program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_program_requests_generated_program_id_fkey"
            columns: ["generated_program_id"]
            isOneToOne: false
            referencedRelation: "training_programs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          metric_date: string
          metric_name: string
          metric_value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_date: string
          metric_name: string
          metric_value: number
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_date?: string
          metric_name?: string
          metric_value?: number
        }
        Relationships: []
      }
      daily_text_targets: {
        Row: {
          business_name: string
          city: string | null
          created_at: string
          google_reviews: number | null
          id: string
          phone: string | null
          sent_at: string | null
          status: string
          suggested_text: string | null
          trade: string | null
          website_url: string | null
        }
        Insert: {
          business_name: string
          city?: string | null
          created_at?: string
          google_reviews?: number | null
          id?: string
          phone?: string | null
          sent_at?: string | null
          status?: string
          suggested_text?: string | null
          trade?: string | null
          website_url?: string | null
        }
        Update: {
          business_name?: string
          city?: string | null
          created_at?: string
          google_reviews?: number | null
          id?: string
          phone?: string | null
          sent_at?: string | null
          status?: string
          suggested_text?: string | null
          trade?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      daily_workouts: {
        Row: {
          created_at: string
          description: string
          exercises: Json
          id: string
          is_active: boolean
          sort_order: number
          target_audience: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          exercises?: Json
          id?: string
          is_active?: boolean
          sort_order?: number
          target_audience?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          exercises?: Json
          id?: string
          is_active?: boolean
          sort_order?: number
          target_audience?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      dark_web_monitor_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          last_sent_at: string | null
          monitored_domain: string
          plan_type: string | null
          send_count: number | null
          stripe_customer_id: string | null
          subscription_status: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          last_sent_at?: string | null
          monitored_domain: string
          plan_type?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          last_sent_at?: string | null
          monitored_domain?: string
          plan_type?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
        }
        Relationships: []
      }
      dark_web_monitor_findings: {
        Row: {
          breach_date: string | null
          breach_name: string | null
          client_id: string | null
          created_at: string | null
          data_classes: string[] | null
          domain: string | null
          email_found: string | null
          id: string
          notified: boolean | null
          severity: string | null
        }
        Insert: {
          breach_date?: string | null
          breach_name?: string | null
          client_id?: string | null
          created_at?: string | null
          data_classes?: string[] | null
          domain?: string | null
          email_found?: string | null
          id?: string
          notified?: boolean | null
          severity?: string | null
        }
        Update: {
          breach_date?: string | null
          breach_name?: string | null
          client_id?: string | null
          created_at?: string | null
          data_classes?: string[] | null
          domain?: string | null
          email_found?: string | null
          id?: string
          notified?: boolean | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dark_web_monitor_findings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "dark_web_monitor_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      data_source_endpoints: {
        Row: {
          backup_url: string | null
          created_at: string
          fallback_url: string | null
          id: string
          last_drift_at: string | null
          last_verified_at: string | null
          notes: string | null
          primary_url: string
          source_name: string
          status: string
          updated_at: string
        }
        Insert: {
          backup_url?: string | null
          created_at?: string
          fallback_url?: string | null
          id?: string
          last_drift_at?: string | null
          last_verified_at?: string | null
          notes?: string | null
          primary_url: string
          source_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          backup_url?: string | null
          created_at?: string
          fallback_url?: string | null
          id?: string
          last_drift_at?: string | null
          last_verified_at?: string | null
          notes?: string | null
          primary_url?: string
          source_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      dead_lead_campaigns: {
        Row: {
          campaign_copy_variants: Json | null
          completed_at: string | null
          contractor_id: string
          created_at: string
          id: string
          is_demo_record: boolean | null
          is_free_trial: boolean
          name: string
          pause_reason: string | null
          paused_at: string | null
          positive_count: number
          replied_count: number
          status: string
          total_contacts: number
          trade: string | null
          updated_at: string
        }
        Insert: {
          campaign_copy_variants?: Json | null
          completed_at?: string | null
          contractor_id: string
          created_at?: string
          id?: string
          is_demo_record?: boolean | null
          is_free_trial?: boolean
          name?: string
          pause_reason?: string | null
          paused_at?: string | null
          positive_count?: number
          replied_count?: number
          status?: string
          total_contacts?: number
          trade?: string | null
          updated_at?: string
        }
        Update: {
          campaign_copy_variants?: Json | null
          completed_at?: string | null
          contractor_id?: string
          created_at?: string
          id?: string
          is_demo_record?: boolean | null
          is_free_trial?: boolean
          name?: string
          pause_reason?: string | null
          paused_at?: string | null
          positive_count?: number
          replied_count?: number
          status?: string
          total_contacts?: number
          trade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dead_lead_campaigns_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      dead_lead_charges: {
        Row: {
          amount_cents: number
          campaign_id: string | null
          contact_id: string | null
          contractor_id: string
          created_at: string
          id: string
          status: string
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_cents?: number
          campaign_id?: string | null
          contact_id?: string | null
          contractor_id: string
          created_at?: string
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_cents?: number
          campaign_id?: string | null
          contact_id?: string | null
          contractor_id?: string
          created_at?: string
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dead_lead_charges_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "dead_lead_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_lead_charges_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "dead_lead_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_lead_charges_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      dead_lead_contacts: {
        Row: {
          campaign_id: string
          contractor_notified_at: string | null
          created_at: string
          drip_step: number
          drip1_sent: boolean
          drip1_sent_at: string | null
          drip2_sent: boolean
          drip2_sent_at: string | null
          drip3_sent: boolean
          drip3_sent_at: string | null
          email: string | null
          id: string
          is_demo_record: boolean | null
          last_contact_date: string | null
          name: string
          original_service: string | null
          phone: string
          replied_at: string | null
          reply_sentiment: string | null
          reply_text: string | null
          requires_human: boolean
          status: string
        }
        Insert: {
          campaign_id: string
          contractor_notified_at?: string | null
          created_at?: string
          drip_step?: number
          drip1_sent?: boolean
          drip1_sent_at?: string | null
          drip2_sent?: boolean
          drip2_sent_at?: string | null
          drip3_sent?: boolean
          drip3_sent_at?: string | null
          email?: string | null
          id?: string
          is_demo_record?: boolean | null
          last_contact_date?: string | null
          name: string
          original_service?: string | null
          phone: string
          replied_at?: string | null
          reply_sentiment?: string | null
          reply_text?: string | null
          requires_human?: boolean
          status?: string
        }
        Update: {
          campaign_id?: string
          contractor_notified_at?: string | null
          created_at?: string
          drip_step?: number
          drip1_sent?: boolean
          drip1_sent_at?: string | null
          drip2_sent?: boolean
          drip2_sent_at?: string | null
          drip3_sent?: boolean
          drip3_sent_at?: string | null
          email?: string | null
          id?: string
          is_demo_record?: boolean | null
          last_contact_date?: string | null
          name?: string
          original_service?: string | null
          phone?: string
          replied_at?: string | null
          reply_sentiment?: string | null
          reply_text?: string | null
          requires_human?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dead_lead_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "dead_lead_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_failures: {
        Row: {
          created_at: string | null
          customer_email: string | null
          error_message: string | null
          function_name: string
          id: string
          metadata: Json | null
          order_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          error_message?: string | null
          function_name: string
          id?: string
          metadata?: Json | null
          order_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          error_message?: string | null
          function_name?: string
          id?: string
          metadata?: Json | null
          order_id?: string | null
        }
        Relationships: []
      }
      demand_radar_runs: {
        Row: {
          duration_ms: number | null
          errors: string | null
          id: string
          run_at: string
          signals_found: number
          signals_new: number
          source: string
          status: string
        }
        Insert: {
          duration_ms?: number | null
          errors?: string | null
          id?: string
          run_at?: string
          signals_found?: number
          signals_new?: number
          source: string
          status?: string
        }
        Update: {
          duration_ms?: number | null
          errors?: string | null
          id?: string
          run_at?: string
          signals_found?: number
          signals_new?: number
          source?: string
          status?: string
        }
        Relationships: []
      }
      demand_radar_signal_actions: {
        Row: {
          action: string
          client_id: string
          created_at: string
          id: string
          notes: string | null
          signal_id: string
        }
        Insert: {
          action?: string
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          signal_id: string
        }
        Update: {
          action?: string
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          signal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_radar_signal_actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "growth_radar_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_radar_signal_actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "industry_pulse_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_radar_signal_actions_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "growth_radar_signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_radar_signal_actions_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "industry_pulse_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_radar_signals: {
        Row: {
          company_name: string | null
          confidence: number | null
          county: string | null
          created_at: string | null
          cross_referenced: boolean | null
          detected_at: string | null
          expansion_type: string | null
          hiring_count: number | null
          id: string
          industry: string | null
          location: string | null
          predicted_needs: string[] | null
          recommended_pitch: string | null
          signal_type: string | null
          source_urls: string[] | null
          vertical: string | null
          zip: string | null
        }
        Insert: {
          company_name?: string | null
          confidence?: number | null
          county?: string | null
          created_at?: string | null
          cross_referenced?: boolean | null
          detected_at?: string | null
          expansion_type?: string | null
          hiring_count?: number | null
          id?: string
          industry?: string | null
          location?: string | null
          predicted_needs?: string[] | null
          recommended_pitch?: string | null
          signal_type?: string | null
          source_urls?: string[] | null
          vertical?: string | null
          zip?: string | null
        }
        Update: {
          company_name?: string | null
          confidence?: number | null
          county?: string | null
          created_at?: string | null
          cross_referenced?: boolean | null
          detected_at?: string | null
          expansion_type?: string | null
          hiring_count?: number | null
          id?: string
          industry?: string | null
          location?: string | null
          predicted_needs?: string[] | null
          recommended_pitch?: string | null
          signal_type?: string | null
          source_urls?: string[] | null
          vertical?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      direct_mail_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          mail_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          mail_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          mail_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      directory_submitter_clients: {
        Row: {
          active: boolean | null
          address: string | null
          audit_count: number | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_audit_at: string | null
          phone: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          audit_count?: number | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_audit_at?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          audit_count?: number | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_audit_at?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      dol_labor_snapshots: {
        Row: {
          area_code: string
          area_name: string | null
          created_at: string
          duration_ms: number | null
          id: string
          rows: Json
          shortage_signals: Json
        }
        Insert: {
          area_code: string
          area_name?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          rows?: Json
          shortage_signals?: Json
        }
        Update: {
          area_code?: string
          area_name?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          rows?: Json
          shortage_signals?: Json
        }
        Relationships: []
      }
      dol_oes_wages: {
        Row: {
          created_at: string
          data_year: number | null
          id: string
          median_annual_wage: number | null
          median_hourly_wage: number | null
          msa: string
          occupation_code: string | null
          trade: string
        }
        Insert: {
          created_at?: string
          data_year?: number | null
          id?: string
          median_annual_wage?: number | null
          median_hourly_wage?: number | null
          msa: string
          occupation_code?: string | null
          trade: string
        }
        Update: {
          created_at?: string
          data_year?: number | null
          id?: string
          median_annual_wage?: number | null
          median_hourly_wage?: number | null
          msa?: string
          occupation_code?: string | null
          trade?: string
        }
        Relationships: []
      }
      dol_rapids_completions: {
        Row: {
          apprentice_name: string
          candidate_id: string | null
          completion_date: string | null
          county: string | null
          created_at: string
          id: string
          occupation_code: string | null
          promoted_to_candidate: boolean | null
          raw_data: Json | null
          sponsor_name: string | null
          state: string | null
          trade: string | null
        }
        Insert: {
          apprentice_name: string
          candidate_id?: string | null
          completion_date?: string | null
          county?: string | null
          created_at?: string
          id?: string
          occupation_code?: string | null
          promoted_to_candidate?: boolean | null
          raw_data?: Json | null
          sponsor_name?: string | null
          state?: string | null
          trade?: string | null
        }
        Update: {
          apprentice_name?: string
          candidate_id?: string | null
          completion_date?: string | null
          county?: string | null
          created_at?: string
          id?: string
          occupation_code?: string | null
          promoted_to_candidate?: boolean | null
          raw_data?: Json | null
          sponsor_name?: string | null
          state?: string | null
          trade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dol_rapids_completions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "hire_alert_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      dol_whisard_violations: {
        Row: {
          bw_atp_amt: number | null
          case_id: string | null
          city: string | null
          created_at: string
          ee_violtd_cnt: number | null
          employer_name: string
          employer_name_normalized: string
          findings_end_date: string | null
          findings_start_date: string | null
          id: string
          raw_data: Json | null
          state: string | null
          violation_count: number | null
        }
        Insert: {
          bw_atp_amt?: number | null
          case_id?: string | null
          city?: string | null
          created_at?: string
          ee_violtd_cnt?: number | null
          employer_name: string
          employer_name_normalized: string
          findings_end_date?: string | null
          findings_start_date?: string | null
          id?: string
          raw_data?: Json | null
          state?: string | null
          violation_count?: number | null
        }
        Update: {
          bw_atp_amt?: number | null
          case_id?: string | null
          city?: string | null
          created_at?: string
          ee_violtd_cnt?: number | null
          employer_name?: string
          employer_name_normalized?: string
          findings_end_date?: string | null
          findings_start_date?: string | null
          id?: string
          raw_data?: Json | null
          state?: string | null
          violation_count?: number | null
        }
        Relationships: []
      }
      dossier_outreach_log: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          reply_received_at: string | null
          sent_at: string | null
          signal_company: string
          signal_id: string | null
          status: string
          target_company: string
          target_contact_name: string | null
          target_email: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          reply_received_at?: string | null
          sent_at?: string | null
          signal_company: string
          signal_id?: string | null
          status?: string
          target_company: string
          target_contact_name?: string | null
          target_email?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          reply_received_at?: string | null
          sent_at?: string | null
          signal_company?: string
          signal_id?: string | null
          status?: string
          target_company?: string
          target_contact_name?: string | null
          target_email?: string | null
        }
        Relationships: []
      }
      drip_conversions: {
        Row: {
          business_name: string | null
          converted_at: string | null
          drip_step_converted: string | null
          email: string
          id: string
          industry: string | null
          metadata: Json | null
          revenue_amount: number | null
          service_interested: string | null
          source: string | null
          stripe_checkout_completed: boolean | null
        }
        Insert: {
          business_name?: string | null
          converted_at?: string | null
          drip_step_converted?: string | null
          email: string
          id?: string
          industry?: string | null
          metadata?: Json | null
          revenue_amount?: number | null
          service_interested?: string | null
          source?: string | null
          stripe_checkout_completed?: boolean | null
        }
        Update: {
          business_name?: string | null
          converted_at?: string | null
          drip_step_converted?: string | null
          email?: string
          id?: string
          industry?: string | null
          metadata?: Json | null
          revenue_amount?: number | null
          service_interested?: string | null
          source?: string | null
          stripe_checkout_completed?: boolean | null
        }
        Relationships: []
      }
      email_reply_drafts: {
        Row: {
          cancelled: boolean | null
          category: string | null
          created_at: string | null
          draft_body: string
          draft_subject: string | null
          id: string
          lead_email: string
          send_after: string
          sent: boolean | null
        }
        Insert: {
          cancelled?: boolean | null
          category?: string | null
          created_at?: string | null
          draft_body: string
          draft_subject?: string | null
          id?: string
          lead_email: string
          send_after: string
          sent?: boolean | null
        }
        Update: {
          cancelled?: boolean | null
          category?: string | null
          created_at?: string | null
          draft_body?: string
          draft_subject?: string | null
          id?: string
          lead_email?: string
          send_after?: string
          sent?: boolean | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      enrichment_jitter_log: {
        Row: {
          created_at: string
          id: string
          jitter_seconds: number
          jittered_at: string
          proxy_pool: string | null
          scheduled_at: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          jitter_seconds: number
          jittered_at: string
          proxy_pool?: string | null
          scheduled_at: string
          source: string
        }
        Update: {
          created_at?: string
          id?: string
          jitter_seconds?: number
          jittered_at?: string
          proxy_pool?: string | null
          scheduled_at?: string
          source?: string
        }
        Relationships: []
      }
      enrichment_provider_routes: {
        Row: {
          call_order: number
          created_at: string
          enabled: boolean
          id: string
          min_score: number | null
          provider: string
          requires_field: string | null
          short_circuit_on: string[] | null
          vertical: string
        }
        Insert: {
          call_order: number
          created_at?: string
          enabled?: boolean
          id?: string
          min_score?: number | null
          provider: string
          requires_field?: string | null
          short_circuit_on?: string[] | null
          vertical: string
        }
        Update: {
          call_order?: number
          created_at?: string
          enabled?: boolean
          id?: string
          min_score?: number | null
          provider?: string
          requires_field?: string | null
          short_circuit_on?: string[] | null
          vertical?: string
        }
        Relationships: []
      }
      enrichment_source_budgets: {
        Row: {
          calls_today: number
          cost_per_call: number
          daily_call_cap: number
          daily_cap_usd: number
          enabled: boolean
          notes: string | null
          paused_until: string | null
          reset_at: string
          source: string
          spent_today_usd: number
        }
        Insert: {
          calls_today?: number
          cost_per_call?: number
          daily_call_cap?: number
          daily_cap_usd: number
          enabled?: boolean
          notes?: string | null
          paused_until?: string | null
          reset_at?: string
          source: string
          spent_today_usd?: number
        }
        Update: {
          calls_today?: number
          cost_per_call?: number
          daily_call_cap?: number
          daily_cap_usd?: number
          enabled?: boolean
          notes?: string | null
          paused_until?: string | null
          reset_at?: string
          source?: string
          spent_today_usd?: number
        }
        Relationships: []
      }
      enrichment_stage_state: {
        Row: {
          candidate_id: string
          completed_stages: string[]
          current_stage: string
          failed_stages: string[]
          finished_at: string | null
          last_advanced_at: string
          merged_payload: Json
          started_at: string
          total_cost_usd: number
        }
        Insert: {
          candidate_id: string
          completed_stages?: string[]
          current_stage?: string
          failed_stages?: string[]
          finished_at?: string | null
          last_advanced_at?: string
          merged_payload?: Json
          started_at?: string
          total_cost_usd?: number
        }
        Update: {
          candidate_id?: string
          completed_stages?: string[]
          current_stage?: string
          failed_stages?: string[]
          finished_at?: string | null
          last_advanced_at?: string
          merged_payload?: Json
          started_at?: string
          total_cost_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_stage_state_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "hire_alert_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          alerted_admin: boolean
          created_at: string
          error_message: string | null
          function_name: string | null
          http_status: number | null
          id: string
          payload: Json | null
          recipient: string | null
          severity: string
          source: string
        }
        Insert: {
          alerted_admin?: boolean
          created_at?: string
          error_message?: string | null
          function_name?: string | null
          http_status?: number | null
          id?: string
          payload?: Json | null
          recipient?: string | null
          severity?: string
          source: string
        }
        Update: {
          alerted_admin?: boolean
          created_at?: string
          error_message?: string | null
          function_name?: string | null
          http_status?: number | null
          id?: string
          payload?: Json | null
          recipient?: string | null
          severity?: string
          source?: string
        }
        Relationships: []
      }
      estimate_generator_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          estimate_count: number | null
          id: string
          industry: string | null
          last_sent_at: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          estimate_count?: number | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          estimate_count?: number | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      exercise_library: {
        Row: {
          barbell_alternative_id: string | null
          client_type: string[]
          created_at: string
          equipment_needed: string
          fix_it_protocol: string[]
          focus_area: string[]
          id: string
          image_url: string | null
          is_fix_it: boolean
          level: string
          sport: string[]
          the_why: string
          title: string
          video_url: string | null
        }
        Insert: {
          barbell_alternative_id?: string | null
          client_type?: string[]
          created_at?: string
          equipment_needed?: string
          fix_it_protocol?: string[]
          focus_area?: string[]
          id?: string
          image_url?: string | null
          is_fix_it?: boolean
          level?: string
          sport?: string[]
          the_why?: string
          title: string
          video_url?: string | null
        }
        Update: {
          barbell_alternative_id?: string | null
          client_type?: string[]
          created_at?: string
          equipment_needed?: string
          fix_it_protocol?: string[]
          focus_area?: string[]
          id?: string
          image_url?: string | null
          is_fix_it?: boolean
          level?: string
          sport?: string[]
          the_why?: string
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_library_barbell_alternative_id_fkey"
            columns: ["barbell_alternative_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
        ]
      }
      exit_intent_leads: {
        Row: {
          created_at: string | null
          email: string
          id: string
          url: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          url?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          url?: string | null
        }
        Relationships: []
      }
      family_subscription_items: {
        Row: {
          created_at: string
          id: string
          member_user_id: string
          parent_user_id: string
          price_id: string
          stripe_subscription_id: string
          stripe_subscription_item_id: string
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_user_id: string
          parent_user_id: string
          price_id: string
          stripe_subscription_id: string
          stripe_subscription_item_id: string
          tier?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_user_id?: string
          parent_user_id?: string
          price_id?: string
          stripe_subscription_id?: string
          stripe_subscription_item_id?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      faq_refresh_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_refreshed_at: string | null
          refresh_count: number | null
          stripe_customer_id: string | null
          website_url: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_refreshed_at?: string | null
          refresh_count?: number | null
          stripe_customer_id?: string | null
          website_url?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_refreshed_at?: string | null
          refresh_count?: number | null
          stripe_customer_id?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      fax_campaigns: {
        Row: {
          audience_type: string | null
          county: string | null
          created_at: string
          id: string
          last_error: string | null
          message_html: string
          name: string
          phaxio_batch_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          target_segment: string
          total_cost: number | null
          total_sent: number | null
        }
        Insert: {
          audience_type?: string | null
          county?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          message_html: string
          name: string
          phaxio_batch_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          target_segment: string
          total_cost?: number | null
          total_sent?: number | null
        }
        Update: {
          audience_type?: string | null
          county?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          message_html?: string
          name?: string
          phaxio_batch_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          target_segment?: string
          total_cost?: number | null
          total_sent?: number | null
        }
        Relationships: []
      }
      fax_conversions: {
        Row: {
          audience_type: string | null
          business_name: string | null
          campaign_id: string | null
          created_at: string
          email: string | null
          event: string
          id: string
          notes: string | null
          product_key: string | null
          prospect_id: string | null
          referrer: string | null
          user_agent: string | null
          utm_campaign: string | null
        }
        Insert: {
          audience_type?: string | null
          business_name?: string | null
          campaign_id?: string | null
          created_at?: string
          email?: string | null
          event: string
          id?: string
          notes?: string | null
          product_key?: string | null
          prospect_id?: string | null
          referrer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
        }
        Update: {
          audience_type?: string | null
          business_name?: string | null
          campaign_id?: string | null
          created_at?: string
          email?: string | null
          event?: string
          id?: string
          notes?: string | null
          product_key?: string | null
          prospect_id?: string | null
          referrer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fax_conversions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "fax_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fax_conversions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "fax_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      fax_opt_outs: {
        Row: {
          fax_number: string
          id: string
          notes: string | null
          opted_out_at: string
          source: string | null
        }
        Insert: {
          fax_number: string
          id?: string
          notes?: string | null
          opted_out_at?: string
          source?: string | null
        }
        Update: {
          fax_number?: string
          id?: string
          notes?: string | null
          opted_out_at?: string
          source?: string | null
        }
        Relationships: []
      }
      fax_prospects: {
        Row: {
          address: string | null
          audience_type: string | null
          business_name: string
          city: string | null
          contact_name: string | null
          county: string | null
          created_at: string
          fax_number: string
          fax_send_id: string | null
          fax_sent_at: string | null
          id: string
          notes: string | null
          segment: string
          source: string
          source_url: string | null
          state: string | null
          verified_public: boolean | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          audience_type?: string | null
          business_name: string
          city?: string | null
          contact_name?: string | null
          county?: string | null
          created_at?: string
          fax_number: string
          fax_send_id?: string | null
          fax_sent_at?: string | null
          id?: string
          notes?: string | null
          segment: string
          source: string
          source_url?: string | null
          state?: string | null
          verified_public?: boolean | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          audience_type?: string | null
          business_name?: string
          city?: string | null
          contact_name?: string | null
          county?: string | null
          created_at?: string
          fax_number?: string
          fax_send_id?: string | null
          fax_sent_at?: string | null
          id?: string
          notes?: string | null
          segment?: string
          source?: string
          source_url?: string | null
          state?: string | null
          verified_public?: boolean | null
          zip?: string | null
        }
        Relationships: []
      }
      fax_send_log: {
        Row: {
          audience_type: string | null
          business_name: string | null
          campaign_id: string | null
          cost: number | null
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          fax_number: string
          id: string
          phaxio_id: string | null
          phaxio_status: string | null
          prospect_id: string | null
          sent_at: string
          status: string
        }
        Insert: {
          audience_type?: string | null
          business_name?: string | null
          campaign_id?: string | null
          cost?: number | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          fax_number: string
          id?: string
          phaxio_id?: string | null
          phaxio_status?: string | null
          prospect_id?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          audience_type?: string | null
          business_name?: string | null
          campaign_id?: string | null
          cost?: number | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          fax_number?: string
          id?: string
          phaxio_id?: string | null
          phaxio_status?: string | null
          prospect_id?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fax_send_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "fax_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fax_send_log_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "fax_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      field_crm_clients: {
        Row: {
          business_name: string
          created_at: string | null
          dispatch_token: string
          email: string | null
          google_review_url: string | null
          id: string
          industry: string | null
          monthly_price: number | null
          owner_name: string | null
          phone: string | null
          plan: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          visitor_script_key: string | null
          website: string | null
        }
        Insert: {
          business_name: string
          created_at?: string | null
          dispatch_token?: string
          email?: string | null
          google_review_url?: string | null
          id?: string
          industry?: string | null
          monthly_price?: number | null
          owner_name?: string | null
          phone?: string | null
          plan?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          visitor_script_key?: string | null
          website?: string | null
        }
        Update: {
          business_name?: string
          created_at?: string | null
          dispatch_token?: string
          email?: string | null
          google_review_url?: string | null
          id?: string
          industry?: string | null
          monthly_price?: number | null
          owner_name?: string | null
          phone?: string | null
          plan?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          visitor_script_key?: string | null
          website?: string | null
        }
        Relationships: []
      }
      field_service_assets: {
        Row: {
          active: boolean
          asset_type: string | null
          client_id: string
          created_at: string
          customer_id: string | null
          id: string
          install_date: string | null
          last_service_at: string | null
          location_notes: string | null
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          serial_number: string | null
        }
        Insert: {
          active?: boolean
          asset_type?: string | null
          client_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          install_date?: string | null
          last_service_at?: string | null
          location_notes?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          serial_number?: string | null
        }
        Update: {
          active?: boolean
          asset_type?: string | null
          client_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          install_date?: string | null
          last_service_at?: string | null
          location_notes?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          serial_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_service_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "field_crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_service_assets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "field_service_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      field_service_contracts: {
        Row: {
          active: boolean
          asset_id: string | null
          assigned_tech_id: string | null
          client_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          frequency: string
          id: string
          next_due_date: string
          title: string
        }
        Insert: {
          active?: boolean
          asset_id?: string | null
          assigned_tech_id?: string | null
          client_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          frequency?: string
          id?: string
          next_due_date: string
          title: string
        }
        Update: {
          active?: boolean
          asset_id?: string | null
          assigned_tech_id?: string | null
          client_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          frequency?: string
          id?: string
          next_due_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_service_contracts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "field_service_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_service_contracts_assigned_tech_id_fkey"
            columns: ["assigned_tech_id"]
            isOneToOne: false
            referencedRelation: "field_service_techs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_service_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "field_crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_service_contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "field_service_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      field_service_customers: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          client_id: string
          company_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          client_id: string
          company_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          client_id?: string
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_service_customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "field_crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      field_service_jobs: {
        Row: {
          asset_id: string | null
          assigned_tech_id: string | null
          client_id: string
          completed_at: string | null
          created_at: string
          customer_contact_phone: string | null
          customer_id: string | null
          customer_notified_at: string | null
          description: string | null
          estimated_duration_minutes: number | null
          id: string
          notes: string | null
          priority: string
          referral_asked_at: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          signature_url: string | null
          started_at: string | null
          status: string
          title: string
        }
        Insert: {
          asset_id?: string | null
          assigned_tech_id?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string
          customer_contact_phone?: string | null
          customer_id?: string | null
          customer_notified_at?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          notes?: string | null
          priority?: string
          referral_asked_at?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          signature_url?: string | null
          started_at?: string | null
          status?: string
          title: string
        }
        Update: {
          asset_id?: string | null
          assigned_tech_id?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string
          customer_contact_phone?: string | null
          customer_id?: string | null
          customer_notified_at?: string | null
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          notes?: string | null
          priority?: string
          referral_asked_at?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          signature_url?: string | null
          started_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_service_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "field_service_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_service_jobs_assigned_tech_id_fkey"
            columns: ["assigned_tech_id"]
            isOneToOne: false
            referencedRelation: "field_service_techs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_service_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "field_crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_service_jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "field_service_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      field_service_techs: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          id: string
          name: string
          phone: string | null
          pin: string | null
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          pin?: string | null
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          pin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_service_techs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "field_crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      fitness_report_clients: {
        Row: {
          active: boolean | null
          business_name: string | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      focus_logs: {
        Row: {
          created_at: string
          focus_id: string
          id: string
          logged_date: string
          metric_value: number
          user_id: string
        }
        Insert: {
          created_at?: string
          focus_id: string
          id?: string
          logged_date?: string
          metric_value?: number
          user_id: string
        }
        Update: {
          created_at?: string
          focus_id?: string
          id?: string
          logged_date?: string
          metric_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_logs_focus_id_fkey"
            columns: ["focus_id"]
            isOneToOne: false
            referencedRelation: "monthly_focus"
            referencedColumns: ["id"]
          },
        ]
      }
      franchise_analyzer_clients: {
        Row: {
          active: boolean | null
          business_name: string | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      free_generation_log: {
        Row: {
          created_at: string
          id: string
          ip_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      free_tool_leads: {
        Row: {
          created_at: string
          email: string
          id: string
          input_url: string | null
          results_summary: Json | null
          tool_used: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          input_url?: string | null
          results_summary?: Json | null
          tool_used: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          input_url?: string | null
          results_summary?: Json | null
          tool_used?: string
        }
        Relationships: []
      }
      gbp_saas_clients: {
        Row: {
          active: boolean | null
          business_name: string
          content_avoid: string | null
          content_focus: string | null
          created_at: string | null
          email: string
          gbp_account_id: string | null
          id: string
          industry: string | null
          last_posted_at: string | null
          plan: string | null
          post_count: number | null
          post_tone: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          content_avoid?: string | null
          content_focus?: string | null
          created_at?: string | null
          email: string
          gbp_account_id?: string | null
          id?: string
          industry?: string | null
          last_posted_at?: string | null
          plan?: string | null
          post_count?: number | null
          post_tone?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          content_avoid?: string | null
          content_focus?: string | null
          created_at?: string | null
          email?: string
          gbp_account_id?: string | null
          id?: string
          industry?: string | null
          last_posted_at?: string | null
          plan?: string | null
          post_count?: number | null
          post_tone?: string | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      generated_content_drafts: {
        Row: {
          body: string | null
          client_id: string | null
          created_at: string | null
          id: string
          industry: string | null
          status: string | null
          title: string
        }
        Insert: {
          body?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          status?: string | null
          title: string
        }
        Update: {
          body?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      generated_sites: {
        Row: {
          address: string | null
          business_name: string
          color_scheme: Json
          created_at: string
          email: string | null
          id: string
          is_published: boolean
          lead_id: string | null
          logo_url: string | null
          phone: string | null
          published_at: string | null
          sections: Json
          slug: string
          template_key: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_name: string
          color_scheme?: Json
          created_at?: string
          email?: string | null
          id?: string
          is_published?: boolean
          lead_id?: string | null
          logo_url?: string | null
          phone?: string | null
          published_at?: string | null
          sections?: Json
          slug: string
          template_key?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_name?: string
          color_scheme?: Json
          created_at?: string
          email?: string | null
          id?: string
          is_published?: boolean
          lead_id?: string | null
          logo_url?: string | null
          phone?: string | null
          published_at?: string | null
          sections?: Json
          slug?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_sites_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "web_design_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          original_amount: number
          purchaser_id: string
          recipient_email: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          remaining_balance: number
          stripe_session_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          original_amount: number
          purchaser_id: string
          recipient_email?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          remaining_balance: number
          stripe_session_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          original_amount?: number
          purchaser_id?: string
          recipient_email?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          remaining_balance?: number
          stripe_session_id?: string | null
        }
        Relationships: []
      }
      gifted_products: {
        Row: {
          gift_type: string
          gifted_at: string
          gifted_by: string
          id: string
          notes: string | null
          product_id: string | null
          promotion_id: string | null
          user_id: string
        }
        Insert: {
          gift_type?: string
          gifted_at?: string
          gifted_by: string
          id?: string
          notes?: string | null
          product_id?: string | null
          promotion_id?: string | null
          user_id: string
        }
        Update: {
          gift_type?: string
          gifted_at?: string
          gifted_by?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          promotion_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gifted_products_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      gifted_sessions: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          giver_user_id: string
          id: string
          receiver_email: string
          status: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          giver_user_id: string
          id?: string
          receiver_email: string
          status?: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          giver_user_id?: string
          id?: string
          receiver_email?: string
          status?: string
        }
        Relationships: []
      }
      google_qa_clients: {
        Row: {
          active: boolean | null
          answer_count: number | null
          business_name: string
          created_at: string | null
          email: string
          gbp_url: string | null
          id: string
          industry: string | null
          last_sent_at: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          answer_count?: number | null
          business_name: string
          created_at?: string | null
          email: string
          gbp_url?: string | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          answer_count?: number | null
          business_name?: string
          created_at?: string | null
          email?: string
          gbp_url?: string | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      gov_contract_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          customer_name: string | null
          email: string
          id: string
          keywords: string | null
          last_sent_at: string | null
          max_contract_value: number | null
          min_contract_value: number | null
          naics_codes: string | null
          preferred_states: string | null
          set_aside_types: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          customer_name?: string | null
          email: string
          id?: string
          keywords?: string | null
          last_sent_at?: string | null
          max_contract_value?: number | null
          min_contract_value?: number | null
          naics_codes?: string | null
          preferred_states?: string | null
          set_aside_types?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          customer_name?: string | null
          email?: string
          id?: string
          keywords?: string | null
          last_sent_at?: string | null
          max_contract_value?: number | null
          min_contract_value?: number | null
          naics_codes?: string | null
          preferred_states?: string | null
          set_aside_types?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
        }
        Relationships: []
      }
      gov_contract_opportunities: {
        Row: {
          agency: string | null
          ai_score: number | null
          ai_summary: string | null
          client_id: string | null
          created_at: string | null
          id: string
          naics_code: string | null
          notice_id: string | null
          notified: boolean | null
          posted_date: string | null
          response_deadline: string | null
          set_aside: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          agency?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          naics_code?: string | null
          notice_id?: string | null
          notified?: boolean | null
          posted_date?: string | null
          response_deadline?: string | null
          set_aside?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          agency?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          naics_code?: string | null
          notice_id?: string | null
          notified?: boolean | null
          posted_date?: string | null
          response_deadline?: string | null
          set_aside?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gov_contract_opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "gov_contract_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      gov_meeting_tracker_clients: {
        Row: {
          active: boolean | null
          business_name: string | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      grant_discovery_clients: {
        Row: {
          active: boolean | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          org_name: string | null
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          org_name?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          org_name?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      grant_finder_clients: {
        Row: {
          active: boolean | null
          annual_revenue: string | null
          business_name: string
          created_at: string | null
          email: string
          employee_count: number | null
          id: string
          industry: string | null
          last_sent_at: string | null
          location: string | null
          phone: string | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          annual_revenue?: string | null
          business_name: string
          created_at?: string | null
          email: string
          employee_count?: number | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          location?: string | null
          phone?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          annual_revenue?: string | null
          business_name?: string
          created_at?: string | null
          email?: string
          employee_count?: number | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          location?: string | null
          phone?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      handbook_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          employee_count: number | null
          id: string
          industry: string | null
          last_sent_at: string | null
          phone: string | null
          send_count: number | null
          state: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          employee_count?: number | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          phone?: string | null
          send_count?: number | null
          state?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          employee_count?: number | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          phone?: string | null
          send_count?: number | null
          state?: string | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      high_volume_buyer_clients: {
        Row: {
          active: boolean | null
          business_name: string
          contact_name: string | null
          created_at: string
          digest_count: number | null
          email: string
          id: string
          last_digest_sent_at: string | null
          min_permit_count: number | null
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          target_counties: string[] | null
          target_trades: string[] | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          business_name: string
          contact_name?: string | null
          created_at?: string
          digest_count?: number | null
          email: string
          id?: string
          last_digest_sent_at?: string | null
          min_permit_count?: number | null
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          target_counties?: string[] | null
          target_trades?: string[] | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          business_name?: string
          contact_name?: string | null
          created_at?: string
          digest_count?: number | null
          email?: string
          id?: string
          last_digest_sent_at?: string | null
          min_permit_count?: number | null
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          target_counties?: string[] | null
          target_trades?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      high_volume_buyer_digests: {
        Row: {
          buyer_count: number | null
          client_id: string | null
          id: string
          payload: Json | null
          sent_at: string
          total_permit_value: number | null
        }
        Insert: {
          buyer_count?: number | null
          client_id?: string | null
          id?: string
          payload?: Json | null
          sent_at?: string
          total_permit_value?: number | null
        }
        Update: {
          buyer_count?: number | null
          client_id?: string | null
          id?: string
          payload?: Json | null
          sent_at?: string
          total_permit_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "high_volume_buyer_digests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "high_volume_buyer_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      hire_alert_candidates: {
        Row: {
          alerted_at: string | null
          availability_score: number | null
          availability_signal: string | null
          available_until: string | null
          city: string | null
          client_id: string | null
          corroboration_score: number | null
          created_at: string | null
          cross_referenced: boolean | null
          current_employer: string | null
          current_title: string | null
          cyber_hygiene_score: number | null
          data_completeness: number | null
          do_not_contact: boolean
          do_not_contact_at: string | null
          email: string | null
          embedding: string | null
          employer_domain_breached_recently: boolean | null
          employer_headcount_delta: number | null
          enriched_at: string | null
          enrichment_status: string | null
          facebook_url: string | null
          first_eligible_at: string | null
          first_seen_at: string | null
          flight_risk: string | null
          flight_risk_proof: string | null
          freshness_score: number | null
          full_name: string | null
          hiring_recommendation: string | null
          id: string
          is_company_name: boolean | null
          is_demo_record: boolean | null
          job_stability_index: number | null
          last_dispatched_at: string | null
          last_seen_at: string | null
          lat: number | null
          license_expiry: string | null
          license_issued_at: string | null
          license_number: string | null
          license_type: string | null
          linkedin_url: string | null
          lng: number | null
          metro: string | null
          name: string
          password_compromised: boolean | null
          personal_email_primary: boolean | null
          phone: string | null
          profile_photo_url: string | null
          qualifications_summary: string | null
          raw_data: Json | null
          score: number | null
          score_reason: string | null
          search_vector: unknown
          social_profiles: Json | null
          source: string | null
          source_count: number | null
          state: string | null
          status: string | null
          trade: string | null
          urgency_score: number | null
          years_experience: number | null
          zip: string | null
        }
        Insert: {
          alerted_at?: string | null
          availability_score?: number | null
          availability_signal?: string | null
          available_until?: string | null
          city?: string | null
          client_id?: string | null
          corroboration_score?: number | null
          created_at?: string | null
          cross_referenced?: boolean | null
          current_employer?: string | null
          current_title?: string | null
          cyber_hygiene_score?: number | null
          data_completeness?: number | null
          do_not_contact?: boolean
          do_not_contact_at?: string | null
          email?: string | null
          embedding?: string | null
          employer_domain_breached_recently?: boolean | null
          employer_headcount_delta?: number | null
          enriched_at?: string | null
          enrichment_status?: string | null
          facebook_url?: string | null
          first_eligible_at?: string | null
          first_seen_at?: string | null
          flight_risk?: string | null
          flight_risk_proof?: string | null
          freshness_score?: number | null
          full_name?: string | null
          hiring_recommendation?: string | null
          id?: string
          is_company_name?: boolean | null
          is_demo_record?: boolean | null
          job_stability_index?: number | null
          last_dispatched_at?: string | null
          last_seen_at?: string | null
          lat?: number | null
          license_expiry?: string | null
          license_issued_at?: string | null
          license_number?: string | null
          license_type?: string | null
          linkedin_url?: string | null
          lng?: number | null
          metro?: string | null
          name: string
          password_compromised?: boolean | null
          personal_email_primary?: boolean | null
          phone?: string | null
          profile_photo_url?: string | null
          qualifications_summary?: string | null
          raw_data?: Json | null
          score?: number | null
          score_reason?: string | null
          search_vector?: unknown
          social_profiles?: Json | null
          source?: string | null
          source_count?: number | null
          state?: string | null
          status?: string | null
          trade?: string | null
          urgency_score?: number | null
          years_experience?: number | null
          zip?: string | null
        }
        Update: {
          alerted_at?: string | null
          availability_score?: number | null
          availability_signal?: string | null
          available_until?: string | null
          city?: string | null
          client_id?: string | null
          corroboration_score?: number | null
          created_at?: string | null
          cross_referenced?: boolean | null
          current_employer?: string | null
          current_title?: string | null
          cyber_hygiene_score?: number | null
          data_completeness?: number | null
          do_not_contact?: boolean
          do_not_contact_at?: string | null
          email?: string | null
          embedding?: string | null
          employer_domain_breached_recently?: boolean | null
          employer_headcount_delta?: number | null
          enriched_at?: string | null
          enrichment_status?: string | null
          facebook_url?: string | null
          first_eligible_at?: string | null
          first_seen_at?: string | null
          flight_risk?: string | null
          flight_risk_proof?: string | null
          freshness_score?: number | null
          full_name?: string | null
          hiring_recommendation?: string | null
          id?: string
          is_company_name?: boolean | null
          is_demo_record?: boolean | null
          job_stability_index?: number | null
          last_dispatched_at?: string | null
          last_seen_at?: string | null
          lat?: number | null
          license_expiry?: string | null
          license_issued_at?: string | null
          license_number?: string | null
          license_type?: string | null
          linkedin_url?: string | null
          lng?: number | null
          metro?: string | null
          name?: string
          password_compromised?: boolean | null
          personal_email_primary?: boolean | null
          phone?: string | null
          profile_photo_url?: string | null
          qualifications_summary?: string | null
          raw_data?: Json | null
          score?: number | null
          score_reason?: string | null
          search_vector?: unknown
          social_profiles?: Json | null
          source?: string | null
          source_count?: number | null
          state?: string | null
          status?: string | null
          trade?: string | null
          urgency_score?: number | null
          years_experience?: number | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hire_alert_candidates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "hire_alert_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      hire_alert_client_candidates: {
        Row: {
          alert_type: string
          alerted_at: string
          candidate_id: string
          claim_expires_at: string | null
          claim_lock_token: string | null
          claimed_at: string | null
          client_action: string | null
          client_id: string
          contacted_at: string | null
          hired_revenue_estimate: number | null
          id: string
          interview_scheduled_at: string | null
          pipeline_stage: string
        }
        Insert: {
          alert_type?: string
          alerted_at?: string
          candidate_id: string
          claim_expires_at?: string | null
          claim_lock_token?: string | null
          claimed_at?: string | null
          client_action?: string | null
          client_id: string
          contacted_at?: string | null
          hired_revenue_estimate?: number | null
          id?: string
          interview_scheduled_at?: string | null
          pipeline_stage?: string
        }
        Update: {
          alert_type?: string
          alerted_at?: string
          candidate_id?: string
          claim_expires_at?: string | null
          claim_lock_token?: string | null
          claimed_at?: string | null
          client_action?: string | null
          client_id?: string
          contacted_at?: string | null
          hired_revenue_estimate?: number | null
          id?: string
          interview_scheduled_at?: string | null
          pipeline_stage?: string
        }
        Relationships: []
      }
      hire_alert_clients: {
        Row: {
          active: boolean | null
          agency_priority: boolean
          booking_link: string | null
          company_name: string
          created_at: string | null
          dashboard_token: string | null
          fielddesk_cross_sell_sent: boolean | null
          id: string
          notify_email: boolean | null
          notify_sms: boolean | null
          owner_email: string
          owner_name: string | null
          owner_phone: string | null
          plan: string | null
          pricing_tier: string | null
          referral_code: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          target_metro: string | null
          target_roles: string[] | null
          target_state: string | null
          target_zip_codes: string[] | null
          target_zip_prefixes: string[] | null
          territory_counties: string[] | null
          tos_accepted_at: string | null
          tos_version: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          trial_status: string | null
        }
        Insert: {
          active?: boolean | null
          agency_priority?: boolean
          booking_link?: string | null
          company_name: string
          created_at?: string | null
          dashboard_token?: string | null
          fielddesk_cross_sell_sent?: boolean | null
          id?: string
          notify_email?: boolean | null
          notify_sms?: boolean | null
          owner_email: string
          owner_name?: string | null
          owner_phone?: string | null
          plan?: string | null
          pricing_tier?: string | null
          referral_code?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          target_metro?: string | null
          target_roles?: string[] | null
          target_state?: string | null
          target_zip_codes?: string[] | null
          target_zip_prefixes?: string[] | null
          territory_counties?: string[] | null
          tos_accepted_at?: string | null
          tos_version?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          trial_status?: string | null
        }
        Update: {
          active?: boolean | null
          agency_priority?: boolean
          booking_link?: string | null
          company_name?: string
          created_at?: string | null
          dashboard_token?: string | null
          fielddesk_cross_sell_sent?: boolean | null
          id?: string
          notify_email?: boolean | null
          notify_sms?: boolean | null
          owner_email?: string
          owner_name?: string | null
          owner_phone?: string | null
          plan?: string | null
          pricing_tier?: string | null
          referral_code?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          target_metro?: string | null
          target_roles?: string[] | null
          target_state?: string | null
          target_zip_codes?: string[] | null
          target_zip_prefixes?: string[] | null
          territory_counties?: string[] | null
          tos_accepted_at?: string | null
          tos_version?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          trial_status?: string | null
        }
        Relationships: []
      }
      hire_alert_runs: {
        Row: {
          alerts_sent: number | null
          candidates_alerted: number | null
          candidates_found: number | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          errors: Json | null
          id: string
          lara_status: string | null
          new_candidates: number | null
          run_at: string | null
          source: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          alerts_sent?: number | null
          candidates_alerted?: number | null
          candidates_found?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          errors?: Json | null
          id?: string
          lara_status?: string | null
          new_candidates?: number | null
          run_at?: string | null
          source?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          alerts_sent?: number | null
          candidates_alerted?: number | null
          candidates_found?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          errors?: Json | null
          id?: string
          lara_status?: string | null
          new_candidates?: number | null
          run_at?: string | null
          source?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      hire_alert_scanner_checkpoints: {
        Row: {
          error_message: string | null
          last_completed_at: string | null
          last_count: number | null
          last_cursor: Json | null
          last_error: string | null
          last_started_at: string | null
          source: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          error_message?: string | null
          last_completed_at?: string | null
          last_count?: number | null
          last_cursor?: Json | null
          last_error?: string | null
          last_started_at?: string | null
          source: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          error_message?: string | null
          last_completed_at?: string | null
          last_count?: number | null
          last_cursor?: Json | null
          last_error?: string | null
          last_started_at?: string | null
          source?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hiring_assistant_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      hoa_secretary_clients: {
        Row: {
          active: boolean | null
          contact_name: string | null
          created_at: string | null
          email: string
          hoa_name: string | null
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          hoa_name?: string | null
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          hoa_name?: string | null
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      hoa_violation_clients: {
        Row: {
          active: boolean | null
          contact_name: string | null
          created_at: string | null
          email: string
          hoa_name: string | null
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          hoa_name?: string | null
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          hoa_name?: string | null
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      holiday_sms_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
          twilio_number: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          twilio_number?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          twilio_number?: string | null
        }
        Relationships: []
      }
      holiday_sms_contacts: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          last_sent_at: string | null
          name: string | null
          opted_in: boolean | null
          phone: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          last_sent_at?: string | null
          name?: string | null
          opted_in?: boolean | null
          phone: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          last_sent_at?: string | null
          name?: string | null
          opted_in?: boolean | null
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "holiday_sms_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "holiday_sms_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      in_person_invite_tokens: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_used: boolean
          label: string | null
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_used?: boolean
          label?: string | null
          token: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_used?: boolean
          label?: string | null
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      industry_pulse_client_actions: {
        Row: {
          action: string
          client_id: string
          company_name: string
          created_at: string
          deal_value: number | null
          id: string
          note: string | null
          signal_id: string
        }
        Insert: {
          action: string
          client_id: string
          company_name: string
          created_at?: string
          deal_value?: number | null
          id?: string
          note?: string | null
          signal_id: string
        }
        Update: {
          action?: string
          client_id?: string
          company_name?: string
          created_at?: string
          deal_value?: number | null
          id?: string
          note?: string | null
          signal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "industry_pulse_client_actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "growth_radar_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "industry_pulse_client_actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "industry_pulse_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      industry_pulse_clients: {
        Row: {
          active: boolean | null
          buyer_type: string
          company_name: string
          confidence_min: number | null
          confidence_threshold: number
          contact_name: string | null
          created_at: string | null
          dashboard_token: string | null
          email: string
          id: string
          is_test_account: boolean
          last_alerted_at: string | null
          phone: string | null
          plan: string | null
          pricing_tier: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          target_industries: string[] | null
          target_roles: string[] | null
          territory_counties: string[] | null
          updated_at: string | null
          vendor_fit_input: string | null
          vertical: string | null
          webhook_url: string | null
        }
        Insert: {
          active?: boolean | null
          buyer_type?: string
          company_name: string
          confidence_min?: number | null
          confidence_threshold?: number
          contact_name?: string | null
          created_at?: string | null
          dashboard_token?: string | null
          email: string
          id?: string
          is_test_account?: boolean
          last_alerted_at?: string | null
          phone?: string | null
          plan?: string | null
          pricing_tier?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          target_industries?: string[] | null
          target_roles?: string[] | null
          territory_counties?: string[] | null
          updated_at?: string | null
          vendor_fit_input?: string | null
          vertical?: string | null
          webhook_url?: string | null
        }
        Update: {
          active?: boolean | null
          buyer_type?: string
          company_name?: string
          confidence_min?: number | null
          confidence_threshold?: number
          contact_name?: string | null
          created_at?: string | null
          dashboard_token?: string | null
          email?: string
          id?: string
          is_test_account?: boolean
          last_alerted_at?: string | null
          phone?: string | null
          plan?: string | null
          pricing_tier?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          target_industries?: string[] | null
          target_roles?: string[] | null
          territory_counties?: string[] | null
          updated_at?: string | null
          vendor_fit_input?: string | null
          vertical?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      industry_pulse_signals: {
        Row: {
          client_tag: string | null
          company_name: string
          confidence: number | null
          county: string | null
          created_at: string | null
          cross_referenced: boolean | null
          decision_makers: Json | null
          decision_makers_enriched_at: string | null
          detected_at: string | null
          embedding: string | null
          expansion_type: string | null
          hiring_count: number | null
          hiring_roles: string[] | null
          id: string
          industry: string | null
          location: string | null
          predicted_needs: string[] | null
          recommended_pitch: string | null
          search_vector: unknown
          sector: string | null
          signal_type: string | null
          source_urls: string[] | null
          spend_window: string | null
          target_buyer_type: string | null
          vendor_fit_score: number | null
          vertical: string | null
        }
        Insert: {
          client_tag?: string | null
          company_name: string
          confidence?: number | null
          county?: string | null
          created_at?: string | null
          cross_referenced?: boolean | null
          decision_makers?: Json | null
          decision_makers_enriched_at?: string | null
          detected_at?: string | null
          embedding?: string | null
          expansion_type?: string | null
          hiring_count?: number | null
          hiring_roles?: string[] | null
          id?: string
          industry?: string | null
          location?: string | null
          predicted_needs?: string[] | null
          recommended_pitch?: string | null
          search_vector?: unknown
          sector?: string | null
          signal_type?: string | null
          source_urls?: string[] | null
          spend_window?: string | null
          target_buyer_type?: string | null
          vendor_fit_score?: number | null
          vertical?: string | null
        }
        Update: {
          client_tag?: string | null
          company_name?: string
          confidence?: number | null
          county?: string | null
          created_at?: string | null
          cross_referenced?: boolean | null
          decision_makers?: Json | null
          decision_makers_enriched_at?: string | null
          detected_at?: string | null
          embedding?: string | null
          expansion_type?: string | null
          hiring_count?: number | null
          hiring_roles?: string[] | null
          id?: string
          industry?: string | null
          location?: string | null
          predicted_needs?: string[] | null
          recommended_pitch?: string | null
          search_vector?: unknown
          sector?: string | null
          signal_type?: string | null
          source_urls?: string[] | null
          spend_window?: string | null
          target_buyer_type?: string | null
          vendor_fit_score?: number | null
          vertical?: string | null
        }
        Relationships: []
      }
      instagram_posts: {
        Row: {
          active: boolean | null
          caption: string | null
          created_at: string | null
          id: string
          image_url: string
          likes_count: number | null
          post_url: string
          posted_at: string | null
        }
        Insert: {
          active?: boolean | null
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url: string
          likes_count?: number | null
          post_url: string
          posted_at?: string | null
        }
        Update: {
          active?: boolean | null
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url?: string
          likes_count?: number | null
          post_url?: string
          posted_at?: string | null
        }
        Relationships: []
      }
      insurance_drip_clients: {
        Row: {
          active: boolean | null
          business_name: string | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      intake_assessments: {
        Row: {
          age: number | null
          created_at: string
          daily_activity: string | null
          equipment_access: string | null
          goals: string | null
          height: string | null
          id: string
          injury_history: string
          posture_photos: string[] | null
          squat_video: string | null
          status: string
          updated_at: string
          user_id: string
          weight: string | null
        }
        Insert: {
          age?: number | null
          created_at?: string
          daily_activity?: string | null
          equipment_access?: string | null
          goals?: string | null
          height?: string | null
          id?: string
          injury_history: string
          posture_photos?: string[] | null
          squat_video?: string | null
          status?: string
          updated_at?: string
          user_id: string
          weight?: string | null
        }
        Update: {
          age?: number | null
          created_at?: string
          daily_activity?: string | null
          equipment_access?: string | null
          goals?: string | null
          height?: string | null
          id?: string
          injury_history?: string
          posture_photos?: string[] | null
          squat_video?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          weight?: string | null
        }
        Relationships: []
      }
      inventory_alert_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          avg_daily_usage: number | null
          client_id: string
          created_at: string | null
          current_stock: number | null
          id: string
          item_name: string
          last_alerted_at: string | null
          par_level: number | null
        }
        Insert: {
          avg_daily_usage?: number | null
          client_id: string
          created_at?: string | null
          current_stock?: number | null
          id?: string
          item_name: string
          last_alerted_at?: string | null
          par_level?: number | null
        }
        Update: {
          avg_daily_usage?: number | null
          client_id?: string
          created_at?: string | null
          current_stock?: number | null
          id?: string
          item_name?: string
          last_alerted_at?: string | null
          par_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "inventory_alert_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      job_notes: {
        Row: {
          created_at: string
          id: string
          job_id: string
          note: string
          tech_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          note: string
          tech_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          note?: string
          tech_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "field_service_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_notes_tech_id_fkey"
            columns: ["tech_id"]
            isOneToOne: false
            referencedRelation: "field_service_techs"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_email_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          report_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          report_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          report_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      landlord_letter_clients: {
        Row: {
          active: boolean | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      lara_health_log: {
        Row: {
          candidates_from_fallback: number | null
          checked_at: string
          error_message: string | null
          fallback_activated: boolean | null
          fallback_sources: string[] | null
          http_status: number | null
          id: string
          response_bytes: number | null
          response_time_ms: number | null
          status: string
        }
        Insert: {
          candidates_from_fallback?: number | null
          checked_at?: string
          error_message?: string | null
          fallback_activated?: boolean | null
          fallback_sources?: string[] | null
          http_status?: number | null
          id?: string
          response_bytes?: number | null
          response_time_ms?: number | null
          status: string
        }
        Update: {
          candidates_from_fallback?: number | null
          checked_at?: string
          error_message?: string | null
          fallback_activated?: boolean | null
          fallback_sources?: string[] | null
          http_status?: number | null
          id?: string
          response_bytes?: number | null
          response_time_ms?: number | null
          status?: string
        }
        Relationships: []
      }
      lara_prefix_cursors: {
        Row: {
          last_id: number
          prefix: string
          updated_at: string
        }
        Insert: {
          last_id?: number
          prefix: string
          updated_at?: string
        }
        Update: {
          last_id?: number
          prefix?: string
          updated_at?: string
        }
        Relationships: []
      }
      lara_val_cursor: {
        Row: {
          id: number
          last_val_id: number
          updated_at: string
        }
        Insert: {
          id: number
          last_val_id?: number
          updated_at?: string
        }
        Update: {
          id?: number
          last_val_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          lead_id: string
          lead_table: string
          metadata: Json | null
          type: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          lead_id: string
          lead_table?: string
          metadata?: Json | null
          type: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string
          lead_table?: string
          metadata?: Json | null
          type?: string
        }
        Relationships: []
      }
      lead_credit_packs: {
        Row: {
          activated_at: string | null
          contractor_id: string
          created_at: string
          credits_remaining: number
          id: string
          pack_size: number
          price_cents: number
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          activated_at?: string | null
          contractor_id: string
          created_at?: string
          credits_remaining: number
          id?: string
          pack_size: number
          price_cents: number
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          activated_at?: string | null
          contractor_id?: string
          created_at?: string
          credits_remaining?: number
          id?: string
          pack_size?: number
          price_cents?: number
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: []
      }
      learn_articles: {
        Row: {
          author: string
          body: string
          category: string
          cover_image_url: string | null
          created_at: string
          id: string
          is_published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string
          body?: string
          category?: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          body?: string
          category?: string
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          content: string
          created_at: string | null
          document_type: string
          id: string
          last_reviewed_at: string | null
          next_review_at: string | null
          status: string | null
          title: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          content: string
          created_at?: string | null
          document_type: string
          id?: string
          last_reviewed_at?: string | null
          next_review_at?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          content?: string
          created_at?: string | null
          document_type?: string
          id?: string
          last_reviewed_at?: string | null
          next_review_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      lift_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          progress_log_id: string
          sender_id: string
          sender_role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          progress_log_id: string
          sender_id: string
          sender_role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          progress_log_id?: string
          sender_id?: string
          sender_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lift_messages_progress_log_id_fkey"
            columns: ["progress_log_id"]
            isOneToOne: false
            referencedRelation: "progress_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      lift_videos: {
        Row: {
          admin_notes: string | null
          ai_analysis: string | null
          created_at: string
          id: string
          progress_log_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["lift_video_status"]
          user_id: string
          video_path: string
        }
        Insert: {
          admin_notes?: string | null
          ai_analysis?: string | null
          created_at?: string
          id?: string
          progress_log_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["lift_video_status"]
          user_id: string
          video_path: string
        }
        Update: {
          admin_notes?: string | null
          ai_analysis?: string | null
          created_at?: string
          id?: string
          progress_log_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["lift_video_status"]
          user_id?: string
          video_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "lift_videos_progress_log_id_fkey"
            columns: ["progress_log_id"]
            isOneToOne: false
            referencedRelation: "progress_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_ghostwriting_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          linkedin_url: string | null
          post_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          linkedin_url?: string | null
          post_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          linkedin_url?: string | null
          post_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      linkedin_outreach_clients: {
        Row: {
          active: boolean | null
          business_name: string
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      llm_response_cache: {
        Row: {
          content_type: string
          created_at: string
          expires_at: string
          hit_count: number
          id: string
          last_hit_at: string
          model: string
          model_family: string
          prompt_embedding: string | null
          prompt_hash: string
          prompt_preview: string | null
          response: Json
        }
        Insert: {
          content_type?: string
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          last_hit_at?: string
          model: string
          model_family?: string
          prompt_embedding?: string | null
          prompt_hash: string
          prompt_preview?: string | null
          response: Json
        }
        Update: {
          content_type?: string
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          last_hit_at?: string
          model?: string
          model_family?: string
          prompt_embedding?: string | null
          prompt_hash?: string
          prompt_preview?: string | null
          response?: Json
        }
        Relationships: []
      }
      local_seo_clients: {
        Row: {
          active: boolean | null
          business_name: string
          city: string | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_generated_at: string | null
          page_count: number | null
          phone: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          city?: string | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_generated_at?: string | null
          page_count?: number | null
          phone?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          city?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_generated_at?: string | null
          page_count?: number | null
          phone?: string | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      logged_exercises: {
        Row: {
          client_notes: string | null
          coach_reply: string | null
          created_at: string
          exercise_id: string
          flag_for_coach: boolean
          id: string
          log_id: string
          sets_reps_weight: Json
          video_url: string | null
        }
        Insert: {
          client_notes?: string | null
          coach_reply?: string | null
          created_at?: string
          exercise_id: string
          flag_for_coach?: boolean
          id?: string
          log_id: string
          sets_reps_weight?: Json
          video_url?: string | null
        }
        Update: {
          client_notes?: string | null
          coach_reply?: string | null
          created_at?: string
          exercise_id?: string
          flag_for_coach?: boolean
          id?: string
          log_id?: string
          sets_reps_weight?: Json
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logged_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logged_exercises_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      market_intel_clients: {
        Row: {
          active: boolean | null
          business_name: string
          competitors: string[] | null
          created_at: string | null
          email: string
          focus_topics: string[] | null
          id: string
          industry: string | null
          last_sent_at: string | null
          location: string | null
          phone: string | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          competitors?: string[] | null
          created_at?: string | null
          email: string
          focus_topics?: string[] | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          location?: string | null
          phone?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          competitors?: string[] | null
          created_at?: string | null
          email?: string
          focus_topics?: string[] | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          location?: string | null
          phone?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      marketing_drafts: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          body: string
          created_at: string
          draft_type: string
          generated_by: string
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body: string
          created_at?: string
          draft_type?: string
          generated_by?: string
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          created_at?: string
          draft_type?: string
          generated_by?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_leads: {
        Row: {
          business_name: string | null
          created_at: string
          drip_completed: boolean | null
          drip_last_sent_at: string | null
          drip_step: number | null
          email: string
          first_name: string | null
          id: string
          industry: string | null
          phone: string | null
          service_interested: string | null
          source: string
          updated_at: string
          utm_source: string | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          drip_completed?: boolean | null
          drip_last_sent_at?: string | null
          drip_step?: number | null
          email: string
          first_name?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          service_interested?: string | null
          source?: string
          updated_at?: string
          utm_source?: string | null
        }
        Update: {
          business_name?: string | null
          created_at?: string
          drip_completed?: boolean | null
          drip_last_sent_at?: string | null
          drip_step?: number | null
          email?: string
          first_name?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          service_interested?: string | null
          source?: string
          updated_at?: string
          utm_source?: string | null
        }
        Relationships: []
      }
      master_templates: {
        Row: {
          ai_findings: Json | null
          created_at: string
          created_by: string
          equipment: string[]
          experience_level: string
          id: string
          primary_focus: string
          program: Json
          program_duration: string
          title: string
        }
        Insert: {
          ai_findings?: Json | null
          created_at?: string
          created_by: string
          equipment?: string[]
          experience_level: string
          id?: string
          primary_focus: string
          program: Json
          program_duration: string
          title: string
        }
        Update: {
          ai_findings?: Json | null
          created_at?: string
          created_by?: string
          equipment?: string[]
          experience_level?: string
          id?: string
          primary_focus?: string
          program?: Json
          program_duration?: string
          title?: string
        }
        Relationships: []
      }
      matt_jokes: {
        Row: {
          attribution: string
          category: string
          created_at: string
          id: string
          joke_text: string
          use_in_emails: boolean
          use_in_sites: boolean
        }
        Insert: {
          attribution?: string
          category?: string
          created_at?: string
          id?: string
          joke_text: string
          use_in_emails?: boolean
          use_in_sites?: boolean
        }
        Update: {
          attribution?: string
          category?: string
          created_at?: string
          id?: string
          joke_text?: string
          use_in_emails?: boolean
          use_in_sites?: boolean
        }
        Relationships: []
      }
      meeting_prep_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          prep_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          prep_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          prep_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      menu_engineering_clients: {
        Row: {
          active: boolean | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          restaurant_name: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          restaurant_name?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          restaurant_name?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      micro_saas_tools: {
        Row: {
          category: string
          core_pain_point: string
          created_at: string
          features_json: Json
          h1_headline: string
          id: string
          is_active: boolean
          monthly_price: number
          seo_meta_description: string
          seo_meta_title: string
          slug: string
          stripe_checkout_url: string | null
          stripe_price_id: string | null
          target_audience: string
        }
        Insert: {
          category?: string
          core_pain_point?: string
          created_at?: string
          features_json?: Json
          h1_headline: string
          id?: string
          is_active?: boolean
          monthly_price?: number
          seo_meta_description: string
          seo_meta_title: string
          slug: string
          stripe_checkout_url?: string | null
          stripe_price_id?: string | null
          target_audience?: string
        }
        Update: {
          category?: string
          core_pain_point?: string
          created_at?: string
          features_json?: Json
          h1_headline?: string
          id?: string
          is_active?: boolean
          monthly_price?: number
          seo_meta_description?: string
          seo_meta_title?: string
          slug?: string
          stripe_checkout_url?: string | null
          stripe_price_id?: string | null
          target_audience?: string
        }
        Relationships: []
      }
      missed_call_clients: {
        Row: {
          active: boolean | null
          bundled_from: string | null
          business_name: string
          created_at: string | null
          custom_message: string | null
          email: string
          id: string
          last_triggered_at: string | null
          phone: string | null
          setup_token: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          bundled_from?: string | null
          business_name: string
          created_at?: string | null
          custom_message?: string | null
          email: string
          id?: string
          last_triggered_at?: string | null
          phone?: string | null
          setup_token?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          bundled_from?: string | null
          business_name?: string
          created_at?: string | null
          custom_message?: string | null
          email?: string
          id?: string
          last_triggered_at?: string | null
          phone?: string | null
          setup_token?: string | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      monthly_challenges: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_active: boolean
          metric_label: string
          month: number
          title: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_active?: boolean
          metric_label?: string
          month: number
          title: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_active?: boolean
          metric_label?: string
          month?: number
          title?: string
          year?: number
        }
        Relationships: []
      }
      monthly_focus: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          biomechanics: string[] | null
          challenge_metric: string | null
          common_mistakes: string[] | null
          created_at: string
          exercises: string[]
          id: string
          matt_quote: string
          metric_label: string
          month: number
          reasoning: string
          status: string
          target_goal: number
          title: string
          topic: string
          year: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          biomechanics?: string[] | null
          challenge_metric?: string | null
          common_mistakes?: string[] | null
          created_at?: string
          exercises?: string[]
          id?: string
          matt_quote?: string
          metric_label?: string
          month: number
          reasoning?: string
          status?: string
          target_goal?: number
          title: string
          topic?: string
          year: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          biomechanics?: string[] | null
          challenge_metric?: string | null
          common_mistakes?: string[] | null
          created_at?: string
          exercises?: string[]
          id?: string
          matt_quote?: string
          metric_label?: string
          month?: number
          reasoning?: string
          status?: string
          target_goal?: number
          title?: string
          topic?: string
          year?: number
        }
        Relationships: []
      }
      new_mover_clients: {
        Row: {
          active: boolean | null
          business_name: string
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      newsletter_sends: {
        Row: {
          body: string
          id: string
          recipient_count: number
          sent_at: string
          sent_by: string | null
          subject: string
          template_name: string | null
        }
        Insert: {
          body: string
          id?: string
          recipient_count?: number
          sent_at?: string
          sent_by?: string | null
          subject: string
          template_name?: string | null
        }
        Update: {
          body?: string
          id?: string
          recipient_count?: number
          sent_at?: string
          sent_by?: string | null
          subject?: string
          template_name?: string | null
        }
        Relationships: []
      }
      newsletter_service_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
          subscriber_list: string[] | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          subscriber_list?: string[] | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          subscriber_list?: string[] | null
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          is_active: boolean
          source: string
          subscribed_at: string
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          is_active?: boolean
          source?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          is_active?: boolean
          source?: string
          subscribed_at?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_deleted: boolean
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_read?: boolean
          link?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_logs: {
        Row: {
          created_at: string
          food_items: Json
          id: string
          image_url: string | null
          logged_at: string
          meal_label: string | null
          notes: string | null
          total_calories: number
          total_carbs_g: number
          total_fat_g: number
          total_fiber_g: number
          total_protein_g: number
          user_id: string
        }
        Insert: {
          created_at?: string
          food_items?: Json
          id?: string
          image_url?: string | null
          logged_at?: string
          meal_label?: string | null
          notes?: string | null
          total_calories?: number
          total_carbs_g?: number
          total_fat_g?: number
          total_fiber_g?: number
          total_protein_g?: number
          user_id: string
        }
        Update: {
          created_at?: string
          food_items?: Json
          id?: string
          image_url?: string | null
          logged_at?: string
          meal_label?: string | null
          notes?: string | null
          total_calories?: number
          total_carbs_g?: number
          total_fat_g?: number
          total_fiber_g?: number
          total_protein_g?: number
          user_id?: string
        }
        Relationships: []
      }
      obituary_clients: {
        Row: {
          active: boolean | null
          contact_name: string | null
          created_at: string | null
          email: string
          funeral_home_name: string | null
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          funeral_home_name?: string | null
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          funeral_home_name?: string | null
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      onboarding_agent_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          onboard_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          onboard_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          onboard_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      osha_compliance_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          employee_count: number | null
          id: string
          industry: string | null
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          employee_count?: number | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          employee_count?: number | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      outreach_blocklist: {
        Row: {
          blocked_until: string | null
          business_name: string | null
          created_at: string
          domain: string | null
          email: string | null
          id: string
          phone: string | null
          reason: string
          source_agent: string | null
          source_table: string | null
          updated_at: string
        }
        Insert: {
          blocked_until?: string | null
          business_name?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          reason: string
          source_agent?: string | null
          source_table?: string | null
          updated_at?: string
        }
        Update: {
          blocked_until?: string | null
          business_name?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          reason?: string
          source_agent?: string | null
          source_table?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      outreach_cooldowns: {
        Row: {
          created_at: string | null
          id: string
          last_agent: string
          last_contacted_at: string | null
          prospect_email: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_agent: string
          last_contacted_at?: string | null
          prospect_email: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_agent?: string
          last_contacted_at?: string | null
          prospect_email?: string
        }
        Relationships: []
      }
      outreach_leads: {
        Row: {
          ai_drafted_at: string | null
          ai_drafted_pitch: string | null
          ai_drafted_subject: string | null
          business_name: string
          channel: string | null
          city: string | null
          company_name: string | null
          created_at: string | null
          custom_flaw: string | null
          drip_campaign_status: Json | null
          email: string | null
          first_name: string | null
          id: string
          industry: string | null
          job_title: string | null
          last_contact_date: string | null
          last_name: string | null
          lead_score: number | null
          lead_score_indicators: string[] | null
          notes: string | null
          offer_pitched: string | null
          owner_name: string | null
          phone: string | null
          sms_2_sent: boolean
          sms_2_sent_at: string | null
          sms_sent: boolean
          sms_sent_at: string | null
          status: string | null
          target_service: string | null
          validated_email: string | null
          website: string | null
          website_status: string | null
        }
        Insert: {
          ai_drafted_at?: string | null
          ai_drafted_pitch?: string | null
          ai_drafted_subject?: string | null
          business_name: string
          channel?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          custom_flaw?: string | null
          drip_campaign_status?: Json | null
          email?: string | null
          first_name?: string | null
          id?: string
          industry?: string | null
          job_title?: string | null
          last_contact_date?: string | null
          last_name?: string | null
          lead_score?: number | null
          lead_score_indicators?: string[] | null
          notes?: string | null
          offer_pitched?: string | null
          owner_name?: string | null
          phone?: string | null
          sms_2_sent?: boolean
          sms_2_sent_at?: string | null
          sms_sent?: boolean
          sms_sent_at?: string | null
          status?: string | null
          target_service?: string | null
          validated_email?: string | null
          website?: string | null
          website_status?: string | null
        }
        Update: {
          ai_drafted_at?: string | null
          ai_drafted_pitch?: string | null
          ai_drafted_subject?: string | null
          business_name?: string
          channel?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          custom_flaw?: string | null
          drip_campaign_status?: Json | null
          email?: string | null
          first_name?: string | null
          id?: string
          industry?: string | null
          job_title?: string | null
          last_contact_date?: string | null
          last_name?: string | null
          lead_score?: number | null
          lead_score_indicators?: string[] | null
          notes?: string | null
          offer_pitched?: string | null
          owner_name?: string | null
          phone?: string | null
          sms_2_sent?: boolean
          sms_2_sent_at?: string | null
          sms_sent?: boolean
          sms_sent_at?: string | null
          status?: string | null
          target_service?: string | null
          validated_email?: string | null
          website?: string | null
          website_status?: string | null
        }
        Relationships: []
      }
      parent_child_links: {
        Row: {
          child_user_id: string
          created_at: string
          id: string
          parent_user_id: string
        }
        Insert: {
          child_user_id: string
          created_at?: string
          id?: string
          parent_user_id: string
        }
        Update: {
          child_user_id?: string
          created_at?: string
          id?: string
          parent_user_id?: string
        }
        Relationships: []
      }
      parent_inbox: {
        Row: {
          admin_reply: string | null
          body: string
          child_user_id: string | null
          created_at: string
          id: string
          is_deleted: boolean
          is_read: boolean
          is_urgent: boolean
          parent_email: string
          parent_name: string | null
          replied_at: string | null
          sentiment: string
          subject: string
          urgent_reason: string | null
        }
        Insert: {
          admin_reply?: string | null
          body: string
          child_user_id?: string | null
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_read?: boolean
          is_urgent?: boolean
          parent_email: string
          parent_name?: string | null
          replied_at?: string | null
          sentiment?: string
          subject?: string
          urgent_reason?: string | null
        }
        Update: {
          admin_reply?: string | null
          body?: string
          child_user_id?: string | null
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_read?: boolean
          is_urgent?: boolean
          parent_email?: string
          parent_name?: string | null
          replied_at?: string | null
          sentiment?: string
          subject?: string
          urgent_reason?: string | null
        }
        Relationships: []
      }
      parent_invite_tokens: {
        Row: {
          child_name: string | null
          created_at: string
          id: string
          is_used: boolean
          parent_user_id: string
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          child_name?: string | null
          created_at?: string
          id?: string
          is_used?: boolean
          parent_user_id: string
          token: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          child_name?: string | null
          created_at?: string
          id?: string
          is_used?: boolean
          parent_user_id?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      payment_chaser_clients: {
        Row: {
          active: boolean | null
          business_name: string
          chase_count: number | null
          created_at: string | null
          email: string
          id: string
          industry: string | null
          phone: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          chase_count?: number | null
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          chase_count?: number | null
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      pdl_negative_cache: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          lookup_key: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          lookup_key: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          lookup_key?: string
          reason?: string | null
        }
        Relationships: []
      }
      permit_contractor_signals: {
        Row: {
          avg_permit_value: number | null
          computed_at: string
          contractor_name: string
          contractor_name_normalized: string
          contractor_status: string | null
          county: string | null
          growth_trajectory: string | null
          id: string
          last_permit_at: string | null
          permit_velocity_score: number | null
          permits_30d: number | null
          permits_60d: number | null
          permits_90d: number | null
          trade_mix: Json | null
          weather_reactive: boolean | null
        }
        Insert: {
          avg_permit_value?: number | null
          computed_at?: string
          contractor_name: string
          contractor_name_normalized: string
          contractor_status?: string | null
          county?: string | null
          growth_trajectory?: string | null
          id?: string
          last_permit_at?: string | null
          permit_velocity_score?: number | null
          permits_30d?: number | null
          permits_60d?: number | null
          permits_90d?: number | null
          trade_mix?: Json | null
          weather_reactive?: boolean | null
        }
        Update: {
          avg_permit_value?: number | null
          computed_at?: string
          contractor_name?: string
          contractor_name_normalized?: string
          contractor_status?: string | null
          county?: string | null
          growth_trajectory?: string | null
          id?: string
          last_permit_at?: string | null
          permit_velocity_score?: number | null
          permits_30d?: number | null
          permits_60d?: number | null
          permits_90d?: number | null
          trade_mix?: Json | null
          weather_reactive?: boolean | null
        }
        Relationships: []
      }
      permit_monitor_clients: {
        Row: {
          active: boolean | null
          business_name: string
          city: string | null
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          permits: Json | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          city?: string | null
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          permits?: Json | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          city?: string | null
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          permits?: Json | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      permit_to_category_map: {
        Row: {
          created_at: string
          id: string
          permit_keyword: string
          supply_category: string
          trade: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          permit_keyword: string
          supply_category: string
          trade?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          permit_keyword?: string
          supply_category?: string
          trade?: string | null
        }
        Relationships: []
      }
      pet_memorial_submissions: {
        Row: {
          created_at: string | null
          customer_email: string
          customer_name: string | null
          favorite_memories: string | null
          id: string
          memorial_html: string | null
          personality_traits: string | null
          pet_name: string
          pet_species: string | null
          poem: string | null
          status: string | null
          stripe_session_id: string | null
          tribute: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email: string
          customer_name?: string | null
          favorite_memories?: string | null
          id?: string
          memorial_html?: string | null
          personality_traits?: string | null
          pet_name: string
          pet_species?: string | null
          poem?: string | null
          status?: string | null
          stripe_session_id?: string | null
          tribute?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string
          customer_name?: string | null
          favorite_memories?: string | null
          id?: string
          memorial_html?: string | null
          personality_traits?: string | null
          pet_name?: string
          pet_species?: string | null
          poem?: string | null
          status?: string | null
          stripe_session_id?: string | null
          tribute?: string | null
        }
        Relationships: []
      }
      phone_answering_clients: {
        Row: {
          active: boolean | null
          business_name: string
          call_count: number | null
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_call_at: string | null
          stripe_customer_id: string | null
          twilio_number: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          call_count?: number | null
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_call_at?: string | null
          stripe_customer_id?: string | null
          twilio_number?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          call_count?: number | null
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_call_at?: string | null
          stripe_customer_id?: string | null
          twilio_number?: string | null
        }
        Relationships: []
      }
      podcast_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          email: string
          episode_count: number | null
          id: string
          last_checked_at: string | null
          last_episode_guid: string | null
          podcast_name: string | null
          podcast_niche: string | null
          rss_feed_url: string | null
          rss_url: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
          target_audience: string | null
          tone: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          email: string
          episode_count?: number | null
          id?: string
          last_checked_at?: string | null
          last_episode_guid?: string | null
          podcast_name?: string | null
          podcast_niche?: string | null
          rss_feed_url?: string | null
          rss_url?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          target_audience?: string | null
          tone?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          email?: string
          episode_count?: number | null
          id?: string
          last_checked_at?: string | null
          last_episode_guid?: string | null
          podcast_name?: string | null
          podcast_niche?: string | null
          rss_feed_url?: string | null
          rss_url?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          target_audience?: string | null
          tone?: string | null
        }
        Relationships: []
      }
      podcast_episodes: {
        Row: {
          client_id: string | null
          content_pieces: Json | null
          created_at: string | null
          episode_title: string | null
          episode_url: string | null
          id: string
          notified: boolean | null
          published_at: string | null
        }
        Insert: {
          client_id?: string | null
          content_pieces?: Json | null
          created_at?: string | null
          episode_title?: string | null
          episode_url?: string | null
          id?: string
          notified?: boolean | null
          published_at?: string | null
        }
        Update: {
          client_id?: string | null
          content_pieces?: Json | null
          created_at?: string | null
          episode_title?: string | null
          episode_url?: string | null
          id?: string
          notified?: boolean | null
          published_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "podcast_episodes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "podcast_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_pitch_clients: {
        Row: {
          active: boolean | null
          business_name: string
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          action: string
          created_at: string
          description: string
          id: string
          points: number
          reference_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string
          id?: string
          points: number
          reference_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          id?: string
          points?: number
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      postcard_campaigns: {
        Row: {
          audience_type: string | null
          conversion_count: number | null
          copy_back: string
          copy_front: string
          county: string
          created_at: string
          delivered_count: number
          id: string
          last_error: string | null
          lob_batch_id: string | null
          prospect_count: number | null
          qr_url: string
          returned_count: number
          sent_count: number | null
          status: string
          total_cost_cents: number
          updated_at: string
        }
        Insert: {
          audience_type?: string | null
          conversion_count?: number | null
          copy_back: string
          copy_front: string
          county: string
          created_at?: string
          delivered_count?: number
          id?: string
          last_error?: string | null
          lob_batch_id?: string | null
          prospect_count?: number | null
          qr_url: string
          returned_count?: number
          sent_count?: number | null
          status?: string
          total_cost_cents?: number
          updated_at?: string
        }
        Update: {
          audience_type?: string | null
          conversion_count?: number | null
          copy_back?: string
          copy_front?: string
          county?: string
          created_at?: string
          delivered_count?: number
          id?: string
          last_error?: string | null
          lob_batch_id?: string | null
          prospect_count?: number | null
          qr_url?: string
          returned_count?: number
          sent_count?: number | null
          status?: string
          total_cost_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      postcard_conversions: {
        Row: {
          audience_type: string | null
          campaign_id: string | null
          county: string | null
          created_at: string
          event: string
          id: string
          product_key: string | null
          prospect_id: string | null
          referrer: string | null
          stripe_session_id: string | null
          user_agent: string | null
        }
        Insert: {
          audience_type?: string | null
          campaign_id?: string | null
          county?: string | null
          created_at?: string
          event?: string
          id?: string
          product_key?: string | null
          prospect_id?: string | null
          referrer?: string | null
          stripe_session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          audience_type?: string | null
          campaign_id?: string | null
          county?: string | null
          created_at?: string
          event?: string
          id?: string
          product_key?: string | null
          prospect_id?: string | null
          referrer?: string | null
          stripe_session_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "postcard_conversions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "postcard_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "postcard_conversions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "postcard_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      postcard_prospects: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_name: string
          city: string | null
          converted_at: string | null
          county: string | null
          created_at: string
          email: string | null
          id: string
          license_count: number | null
          license_types: string[] | null
          newest_license_date: string | null
          owner_name: string | null
          phone: string | null
          postcard_batch_id: string | null
          postcard_sent_at: string | null
          source: string | null
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_name: string
          city?: string | null
          converted_at?: string | null
          county?: string | null
          created_at?: string
          email?: string | null
          id?: string
          license_count?: number | null
          license_types?: string[] | null
          newest_license_date?: string | null
          owner_name?: string | null
          phone?: string | null
          postcard_batch_id?: string | null
          postcard_sent_at?: string | null
          source?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_name?: string
          city?: string | null
          converted_at?: string | null
          county?: string | null
          created_at?: string
          email?: string | null
          id?: string
          license_count?: number | null
          license_types?: string[] | null
          newest_license_date?: string | null
          owner_name?: string | null
          phone?: string | null
          postcard_batch_id?: string | null
          postcard_sent_at?: string | null
          source?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
      postcard_send_log: {
        Row: {
          address_line1: string | null
          business_name: string | null
          campaign_id: string | null
          city: string | null
          cost_cents: number | null
          delivered_at: string | null
          delivery_status: string | null
          expected_delivery_date: string | null
          id: string
          lob_id: string | null
          prospect_id: string | null
          sent_at: string | null
          state: string | null
          status: string | null
          tracking_events: Json | null
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          business_name?: string | null
          campaign_id?: string | null
          city?: string | null
          cost_cents?: number | null
          delivered_at?: string | null
          delivery_status?: string | null
          expected_delivery_date?: string | null
          id?: string
          lob_id?: string | null
          prospect_id?: string | null
          sent_at?: string | null
          state?: string | null
          status?: string | null
          tracking_events?: Json | null
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          business_name?: string | null
          campaign_id?: string | null
          city?: string | null
          cost_cents?: number | null
          delivered_at?: string | null
          delivery_status?: string | null
          expected_delivery_date?: string | null
          id?: string
          lob_id?: string | null
          prospect_id?: string | null
          sent_at?: string | null
          state?: string | null
          status?: string | null
          tracking_events?: Json | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "postcard_send_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "postcard_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      posture_requests: {
        Row: {
          analysis: string | null
          created_at: string
          front_photo_url: string | null
          id: string
          promo_code: string | null
          side_photo_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: string | null
          created_at?: string
          front_photo_url?: string | null
          id?: string
          promo_code?: string | null
          side_photo_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: string | null
          created_at?: string
          front_photo_url?: string | null
          id?: string
          promo_code?: string | null
          side_photo_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pr_submissions: {
        Row: {
          admin_notes: string | null
          exercise_name: string
          id: string
          media_consent: boolean
          rep_max: number
          reps: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          user_id: string
          video_path: string
          weight: number
        }
        Insert: {
          admin_notes?: string | null
          exercise_name: string
          id?: string
          media_consent?: boolean
          rep_max?: number
          reps?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          user_id: string
          video_path: string
          weight: number
        }
        Update: {
          admin_notes?: string | null
          exercise_name?: string
          id?: string
          media_consent?: boolean
          rep_max?: number
          reps?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          user_id?: string
          video_path?: string
          weight?: number
        }
        Relationships: []
      }
      press_release_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          release_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          release_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          release_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      price_intelligence_clients: {
        Row: {
          active: boolean | null
          business_name: string | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      price_monitor_clients: {
        Row: {
          active: boolean | null
          business_name: string
          competitor_urls: string[] | null
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_report_at: string | null
          report_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          competitor_urls?: string[] | null
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_report_at?: string | null
          report_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          competitor_urls?: string[] | null
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_report_at?: string | null
          report_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      processed_stripe_events: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string
        }
        Relationships: []
      }
      product_wiki: {
        Row: {
          active_hooks_count: number | null
          agent_connections: string[] | null
          category: Database["public"]["Enums"]["wiki_category"]
          client_description: string | null
          created_at: string
          description: string | null
          dev_hours_spent: number | null
          id: string
          last_updated: string
          monthly_operating_cost: number | null
          printable_steps: Json | null
          priority_rank: number | null
          product_name: string
          tech_stack: string[] | null
          updated_by: string | null
        }
        Insert: {
          active_hooks_count?: number | null
          agent_connections?: string[] | null
          category?: Database["public"]["Enums"]["wiki_category"]
          client_description?: string | null
          created_at?: string
          description?: string | null
          dev_hours_spent?: number | null
          id?: string
          last_updated?: string
          monthly_operating_cost?: number | null
          printable_steps?: Json | null
          priority_rank?: number | null
          product_name: string
          tech_stack?: string[] | null
          updated_by?: string | null
        }
        Update: {
          active_hooks_count?: number | null
          agent_connections?: string[] | null
          category?: Database["public"]["Enums"]["wiki_category"]
          client_description?: string | null
          created_at?: string
          description?: string | null
          dev_hours_spent?: number | null
          id?: string
          last_updated?: string
          monthly_operating_cost?: number | null
          printable_steps?: Json | null
          priority_rank?: number | null
          product_name?: string
          tech_stack?: string[] | null
          updated_by?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string
          external_url: string | null
          id: string
          image_url: string | null
          is_live: boolean
          metadata: Json
          name: string
          price: number
          product_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          external_url?: string | null
          id?: string
          image_url?: string | null
          is_live?: boolean
          metadata?: Json
          name: string
          price?: number
          product_type?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          external_url?: string | null
          id?: string
          image_url?: string | null
          is_live?: boolean
          metadata?: Json
          name?: string
          price?: number
          product_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_role: string
          athlete_name: string | null
          auto_regulate: boolean
          avatar_url: string | null
          created_at: string
          daily_calorie_goal: number | null
          daily_carbs_goal: number | null
          daily_fat_goal: number | null
          daily_protein_goal: number | null
          date_of_birth: string | null
          email: string | null
          free_program_redeemed: boolean
          full_name: string | null
          id: string
          invite_card_dismissed: boolean | null
          is_in_person: boolean
          is_pro: boolean
          is_public_profile: boolean | null
          is_vip: boolean
          random_alias: string | null
          referral_count: number | null
          stripe_customer_id: string | null
          subscription_tier: string
          trial_path: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_role?: string
          athlete_name?: string | null
          auto_regulate?: boolean
          avatar_url?: string | null
          created_at?: string
          daily_calorie_goal?: number | null
          daily_carbs_goal?: number | null
          daily_fat_goal?: number | null
          daily_protein_goal?: number | null
          date_of_birth?: string | null
          email?: string | null
          free_program_redeemed?: boolean
          full_name?: string | null
          id?: string
          invite_card_dismissed?: boolean | null
          is_in_person?: boolean
          is_pro?: boolean
          is_public_profile?: boolean | null
          is_vip?: boolean
          random_alias?: string | null
          referral_count?: number | null
          stripe_customer_id?: string | null
          subscription_tier?: string
          trial_path?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_role?: string
          athlete_name?: string | null
          auto_regulate?: boolean
          avatar_url?: string | null
          created_at?: string
          daily_calorie_goal?: number | null
          daily_carbs_goal?: number | null
          daily_fat_goal?: number | null
          daily_protein_goal?: number | null
          date_of_birth?: string | null
          email?: string | null
          free_program_redeemed?: boolean
          full_name?: string | null
          id?: string
          invite_card_dismissed?: boolean | null
          is_in_person?: boolean
          is_pro?: boolean
          is_public_profile?: boolean | null
          is_vip?: boolean
          random_alias?: string | null
          referral_count?: number | null
          stripe_customer_id?: string | null
          subscription_tier?: string
          trial_path?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      program_messages: {
        Row: {
          coach_reply: string | null
          created_at: string
          day_number: number
          exercise_name: string
          id: string
          is_read: boolean
          message: string
          program_id: string
          user_id: string
          video_url: string | null
          week_number: number
        }
        Insert: {
          coach_reply?: string | null
          created_at?: string
          day_number?: number
          exercise_name?: string
          id?: string
          is_read?: boolean
          message: string
          program_id: string
          user_id: string
          video_url?: string | null
          week_number?: number
        }
        Update: {
          coach_reply?: string | null
          created_at?: string
          day_number?: number
          exercise_name?: string
          id?: string
          is_read?: boolean
          message?: string
          program_id?: string
          user_id?: string
          video_url?: string | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_messages_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_messages_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      program_workouts: {
        Row: {
          coach_instructions: string
          created_at: string
          day_number: number
          exercise_id: string
          id: string
          prescribed_sets_reps: string
          program_id: string
          sort_order: number
          week_number: number
        }
        Insert: {
          coach_instructions?: string
          created_at?: string
          day_number?: number
          exercise_id: string
          id?: string
          prescribed_sets_reps?: string
          program_id: string
          sort_order?: number
          week_number?: number
        }
        Update: {
          coach_instructions?: string
          created_at?: string
          day_number?: number
          exercise_id?: string
          id?: string
          prescribed_sets_reps?: string
          program_id?: string
          sort_order?: number
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_workouts_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_workouts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_workouts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_logs: {
        Row: {
          estimated_1rm: number | null
          exercise_name: string
          id: string
          logged_at: string
          reps: number
          user_id: string
          weight: number
        }
        Insert: {
          estimated_1rm?: number | null
          exercise_name: string
          id?: string
          logged_at?: string
          reps?: number
          user_id: string
          weight: number
        }
        Update: {
          estimated_1rm?: number | null
          exercise_name?: string
          id?: string
          logged_at?: string
          reps?: number
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      promo_planner_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          plan_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          plan_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          plan_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          applies_to: string
          code: string
          created_at: string
          current_uses: number
          description: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          specific_product_id: string | null
        }
        Insert: {
          applies_to?: string
          code: string
          created_at?: string
          current_uses?: number
          description?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          specific_product_id?: string | null
        }
        Update: {
          applies_to?: string
          code?: string
          created_at?: string
          current_uses?: number
          description?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          specific_product_id?: string | null
        }
        Relationships: []
      }
      proposal_generator_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          proposal_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          proposal_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          proposal_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      prospect_businesses: {
        Row: {
          address: string | null
          business_name: string
          city: string | null
          created_at: string | null
          decision_maker_name: string | null
          decision_maker_title: string | null
          direct_phone: string | null
          email: string | null
          enriched_at: string | null
          enrichment_data: Json | null
          enrichment_source: string | null
          enrichment_status: string | null
          google_place_id: string | null
          has_website: boolean | null
          id: string
          industry: string | null
          notes: string | null
          outreach_status: string | null
          phone: string | null
          rating: number | null
          review_count: number | null
          source: string | null
          state: string | null
          tier: string | null
          updated_at: string | null
          verified_email: boolean | null
          website: string | null
        }
        Insert: {
          address?: string | null
          business_name: string
          city?: string | null
          created_at?: string | null
          decision_maker_name?: string | null
          decision_maker_title?: string | null
          direct_phone?: string | null
          email?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          enrichment_source?: string | null
          enrichment_status?: string | null
          google_place_id?: string | null
          has_website?: boolean | null
          id?: string
          industry?: string | null
          notes?: string | null
          outreach_status?: string | null
          phone?: string | null
          rating?: number | null
          review_count?: number | null
          source?: string | null
          state?: string | null
          tier?: string | null
          updated_at?: string | null
          verified_email?: boolean | null
          website?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string
          city?: string | null
          created_at?: string | null
          decision_maker_name?: string | null
          decision_maker_title?: string | null
          direct_phone?: string | null
          email?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          enrichment_source?: string | null
          enrichment_status?: string | null
          google_place_id?: string | null
          has_website?: boolean | null
          id?: string
          industry?: string | null
          notes?: string | null
          outreach_status?: string | null
          phone?: string | null
          rating?: number | null
          review_count?: number | null
          source?: string | null
          state?: string | null
          tier?: string | null
          updated_at?: string | null
          verified_email?: boolean | null
          website?: string | null
        }
        Relationships: []
      }
      prospect_email_log: {
        Row: {
          business_name: string | null
          clicked_at: string | null
          drip_step: number | null
          id: string
          opened_at: string | null
          pipeline_lead_id: string | null
          recipient_email: string
          resend_id: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
        }
        Insert: {
          business_name?: string | null
          clicked_at?: string | null
          drip_step?: number | null
          id?: string
          opened_at?: string | null
          pipeline_lead_id?: string | null
          recipient_email: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Update: {
          business_name?: string | null
          clicked_at?: string | null
          drip_step?: number | null
          id?: string
          opened_at?: string | null
          pipeline_lead_id?: string | null
          recipient_email?: string
          resend_id?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_email_log_pipeline_lead_id_fkey"
            columns: ["pipeline_lead_id"]
            isOneToOne: false
            referencedRelation: "prospect_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_nudges: {
        Row: {
          account_created_at: string | null
          business: string | null
          city: string | null
          clicked_at: string | null
          created_at: string
          id: string
          last_nudge_error: string | null
          last_nudge_sid: string | null
          last_nudge_status: string | null
          link_token: string
          name: string | null
          notes: string | null
          nudge_count: number
          nudge_retry_count: number
          nudge_sent_at: string | null
          paid_at: string | null
          phone: string
          profile_completed_at: string | null
          signup_started_at: string | null
          status: string
          trade: string | null
        }
        Insert: {
          account_created_at?: string | null
          business?: string | null
          city?: string | null
          clicked_at?: string | null
          created_at?: string
          id?: string
          last_nudge_error?: string | null
          last_nudge_sid?: string | null
          last_nudge_status?: string | null
          link_token?: string
          name?: string | null
          notes?: string | null
          nudge_count?: number
          nudge_retry_count?: number
          nudge_sent_at?: string | null
          paid_at?: string | null
          phone: string
          profile_completed_at?: string | null
          signup_started_at?: string | null
          status?: string
          trade?: string | null
        }
        Update: {
          account_created_at?: string | null
          business?: string | null
          city?: string | null
          clicked_at?: string | null
          created_at?: string
          id?: string
          last_nudge_error?: string | null
          last_nudge_sid?: string | null
          last_nudge_status?: string | null
          link_token?: string
          name?: string | null
          notes?: string | null
          nudge_count?: number
          nudge_retry_count?: number
          nudge_sent_at?: string | null
          paid_at?: string | null
          phone?: string
          profile_completed_at?: string | null
          signup_started_at?: string | null
          status?: string
          trade?: string | null
        }
        Relationships: []
      }
      prospect_outreach: {
        Row: {
          business_name: string | null
          email: string | null
          id: string
          industry: string | null
          outreach_type: string | null
          prospect_id: string | null
          replied_at: string | null
          sent_at: string | null
          status: string | null
          subject: string | null
        }
        Insert: {
          business_name?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          outreach_type?: string | null
          prospect_id?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Update: {
          business_name?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          outreach_type?: string | null
          prospect_id?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_outreach_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospect_businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_pipeline: {
        Row: {
          breach_count: number | null
          business_name: string
          city: string | null
          close_probability: number | null
          contact_name: string | null
          core_service: string | null
          created_at: string | null
          deal_value: number | null
          deep_research: Json | null
          drip_body: string | null
          drip_status: string | null
          drip_step: number | null
          drip_subject: string | null
          email: string | null
          gap_analysis: string | null
          gbp_claimed: boolean | null
          google_place_id: string | null
          google_rating: number | null
          has_facebook: boolean | null
          has_instagram: boolean | null
          id: string
          industry: string | null
          last_activity_at: string | null
          last_drip_at: string | null
          lead_score: number | null
          n8n_sent_at: string | null
          next_action: string | null
          next_action_date: string | null
          pain_points: Json | null
          phone: string | null
          pipeline_stage: string
          recent_activity: string | null
          reply_received_at: string | null
          review_count: number | null
          source: string | null
          specific_site_flaw: string | null
          state: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          breach_count?: number | null
          business_name: string
          city?: string | null
          close_probability?: number | null
          contact_name?: string | null
          core_service?: string | null
          created_at?: string | null
          deal_value?: number | null
          deep_research?: Json | null
          drip_body?: string | null
          drip_status?: string | null
          drip_step?: number | null
          drip_subject?: string | null
          email?: string | null
          gap_analysis?: string | null
          gbp_claimed?: boolean | null
          google_place_id?: string | null
          google_rating?: number | null
          has_facebook?: boolean | null
          has_instagram?: boolean | null
          id?: string
          industry?: string | null
          last_activity_at?: string | null
          last_drip_at?: string | null
          lead_score?: number | null
          n8n_sent_at?: string | null
          next_action?: string | null
          next_action_date?: string | null
          pain_points?: Json | null
          phone?: string | null
          pipeline_stage?: string
          recent_activity?: string | null
          reply_received_at?: string | null
          review_count?: number | null
          source?: string | null
          specific_site_flaw?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          breach_count?: number | null
          business_name?: string
          city?: string | null
          close_probability?: number | null
          contact_name?: string | null
          core_service?: string | null
          created_at?: string | null
          deal_value?: number | null
          deep_research?: Json | null
          drip_body?: string | null
          drip_status?: string | null
          drip_step?: number | null
          drip_subject?: string | null
          email?: string | null
          gap_analysis?: string | null
          gbp_claimed?: boolean | null
          google_place_id?: string | null
          google_rating?: number | null
          has_facebook?: boolean | null
          has_instagram?: boolean | null
          id?: string
          industry?: string | null
          last_activity_at?: string | null
          last_drip_at?: string | null
          lead_score?: number | null
          n8n_sent_at?: string | null
          next_action?: string | null
          next_action_date?: string | null
          pain_points?: Json | null
          phone?: string | null
          pipeline_stage?: string
          recent_activity?: string | null
          reply_received_at?: string | null
          review_count?: number | null
          source?: string | null
          specific_site_flaw?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      prospect_pool: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          audience_type: string
          business_name: string
          channel_hint: string
          city: string | null
          cms_staffing_rating: number | null
          contact_name: string | null
          county: string | null
          created_at: string
          email: string | null
          fax_number: string | null
          has_active_job_postings: boolean | null
          has_demand_signal: boolean | null
          id: string
          intel_notes: Json | null
          last_sent_at: string | null
          lead_score: number | null
          meta: Json | null
          phone: string | null
          recent_federal_contract: boolean | null
          score_breakdown: Json | null
          scored_at: string | null
          send_count: number | null
          source: string
          source_id: string | null
          source_url: string | null
          state: string | null
          status: string | null
          updated_at: string
          verified_address: boolean | null
          verified_fax: boolean | null
          website: string | null
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          audience_type: string
          business_name: string
          channel_hint?: string
          city?: string | null
          cms_staffing_rating?: number | null
          contact_name?: string | null
          county?: string | null
          created_at?: string
          email?: string | null
          fax_number?: string | null
          has_active_job_postings?: boolean | null
          has_demand_signal?: boolean | null
          id?: string
          intel_notes?: Json | null
          last_sent_at?: string | null
          lead_score?: number | null
          meta?: Json | null
          phone?: string | null
          recent_federal_contract?: boolean | null
          score_breakdown?: Json | null
          scored_at?: string | null
          send_count?: number | null
          source: string
          source_id?: string | null
          source_url?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string
          verified_address?: boolean | null
          verified_fax?: boolean | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          audience_type?: string
          business_name?: string
          channel_hint?: string
          city?: string | null
          cms_staffing_rating?: number | null
          contact_name?: string | null
          county?: string | null
          created_at?: string
          email?: string | null
          fax_number?: string | null
          has_active_job_postings?: boolean | null
          has_demand_signal?: boolean | null
          id?: string
          intel_notes?: Json | null
          last_sent_at?: string | null
          lead_score?: number | null
          meta?: Json | null
          phone?: string | null
          recent_federal_contract?: boolean | null
          score_breakdown?: Json | null
          scored_at?: string | null
          send_count?: number | null
          source?: string
          source_id?: string | null
          source_url?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string
          verified_address?: boolean | null
          verified_fax?: boolean | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      protocol_exercise_flags: {
        Row: {
          admin_response: string | null
          created_at: string
          id: string
          protocol_exercise_id: string
          question: string
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          id?: string
          protocol_exercise_id: string
          question: string
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          id?: string
          protocol_exercise_id?: string
          question?: string
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_exercise_flags_protocol_exercise_id_fkey"
            columns: ["protocol_exercise_id"]
            isOneToOne: false
            referencedRelation: "protocol_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_exercises: {
        Row: {
          coach_notes: string | null
          created_at: string
          exercise_library_id: string | null
          exercise_name: string
          id: string
          image_url: string | null
          notes: string | null
          protocol_id: string
          reps: string | null
          rpe: number | null
          sets: number | null
          sort_order: number
          weight: number | null
        }
        Insert: {
          coach_notes?: string | null
          created_at?: string
          exercise_library_id?: string | null
          exercise_name: string
          id?: string
          image_url?: string | null
          notes?: string | null
          protocol_id: string
          reps?: string | null
          rpe?: number | null
          sets?: number | null
          sort_order?: number
          weight?: number | null
        }
        Update: {
          coach_notes?: string | null
          created_at?: string
          exercise_library_id?: string | null
          exercise_name?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          protocol_id?: string
          reps?: string | null
          rpe?: number | null
          sets?: number | null
          sort_order?: number
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "protocol_exercises_exercise_library_id_fkey"
            columns: ["exercise_library_id"]
            isOneToOne: false
            referencedRelation: "exercise_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_exercises_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      protocols: {
        Row: {
          created_at: string
          description: string | null
          gift_message: string | null
          gifted_to: string | null
          id: string
          is_default: boolean
          is_template: boolean
          source_template_id: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          gift_message?: string | null
          gifted_to?: string | null
          id?: string
          is_default?: boolean
          is_template?: boolean
          source_template_id?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          gift_message?: string | null
          gifted_to?: string | null
          id?: string
          is_default?: boolean
          is_template?: boolean
          source_template_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "protocols_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      purchased_guides: {
        Row: {
          guide_id: string
          id: string
          purchased_at: string | null
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          guide_id: string
          id?: string
          purchased_at?: string | null
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          guide_id?: string
          id?: string
          purchased_at?: string | null
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchased_guides_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "sport_guides"
            referencedColumns: ["id"]
          },
        ]
      }
      purchased_programs: {
        Row: {
          exercises: Json
          id: string
          is_active: boolean
          notes_from_matt: string | null
          program_title: string
          program_type: string
          purchased_at: string
          sport: string | null
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          exercises?: Json
          id?: string
          is_active?: boolean
          notes_from_matt?: string | null
          program_title: string
          program_type?: string
          purchased_at?: string
          sport?: string | null
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          exercises?: Json
          id?: string
          is_active?: boolean
          notes_from_matt?: string | null
          program_title?: string
          program_type?: string
          purchased_at?: string
          sport?: string | null
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quote_followup_clients: {
        Row: {
          active: boolean | null
          bundled_from: string | null
          business_name: string
          created_at: string | null
          email: string
          followup_count: number | null
          id: string
          industry: string | null
          last_sent_at: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          bundled_from?: string | null
          business_name: string
          created_at?: string | null
          email: string
          followup_count?: number | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          bundled_from?: string | null
          business_name?: string
          created_at?: string | null
          email?: string
          followup_count?: number | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      radar_annual_subscriptions: {
        Row: {
          active: boolean
          amount_paid_cents: number | null
          client_id: string
          id: string
          months_included: number | null
          product: string
          renews_at: string | null
          starts_at: string
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean
          amount_paid_cents?: number | null
          client_id: string
          id?: string
          months_included?: number | null
          product: string
          renews_at?: string | null
          starts_at?: string
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean
          amount_paid_cents?: number | null
          client_id?: string
          id?: string
          months_included?: number | null
          product?: string
          renews_at?: string | null
          starts_at?: string
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      radar_auto_response_templates: {
        Row: {
          active: boolean
          contractor_id: string
          created_at: string
          id: string
          template_body: string
          trade: string | null
        }
        Insert: {
          active?: boolean
          contractor_id: string
          created_at?: string
          id?: string
          template_body: string
          trade?: string | null
        }
        Update: {
          active?: boolean
          contractor_id?: string
          created_at?: string
          id?: string
          template_body?: string
          trade?: string | null
        }
        Relationships: []
      }
      radar_hire_confirmations: {
        Row: {
          candidate_id: string | null
          candidate_name: string | null
          client_id: string
          estimated_fee_saved_usd: number | null
          id: string
          notes: string | null
          outcome: string | null
          prompted_at: string
          responded_at: string | null
        }
        Insert: {
          candidate_id?: string | null
          candidate_name?: string | null
          client_id: string
          estimated_fee_saved_usd?: number | null
          id?: string
          notes?: string | null
          outcome?: string | null
          prompted_at?: string
          responded_at?: string | null
        }
        Update: {
          candidate_id?: string | null
          candidate_name?: string | null
          client_id?: string
          estimated_fee_saved_usd?: number | null
          id?: string
          notes?: string | null
          outcome?: string | null
          prompted_at?: string
          responded_at?: string | null
        }
        Relationships: []
      }
      radar_lead_outcomes: {
        Row: {
          contractor_id: string
          id: string
          lead_id: string | null
          logged_at: string
          notes: string | null
          outcome: string
          revenue_usd: number | null
        }
        Insert: {
          contractor_id: string
          id?: string
          lead_id?: string | null
          logged_at?: string
          notes?: string | null
          outcome: string
          revenue_usd?: number | null
        }
        Update: {
          contractor_id?: string
          id?: string
          lead_id?: string | null
          logged_at?: string
          notes?: string | null
          outcome?: string
          revenue_usd?: number | null
        }
        Relationships: []
      }
      radar_referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          owner_email: string | null
          owner_id: string
          owner_type: string
          reward_type: string
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          owner_email?: string | null
          owner_id: string
          owner_type: string
          reward_type?: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          owner_email?: string | null
          owner_id?: string
          owner_type?: string
          reward_type?: string
          uses?: number
        }
        Relationships: []
      }
      radar_signal_archives: {
        Row: {
          archived_at: string
          id: string
          reason: string | null
          source_id: string
          source_table: string
        }
        Insert: {
          archived_at?: string
          id?: string
          reason?: string | null
          source_id: string
          source_table: string
        }
        Update: {
          archived_at?: string
          id?: string
          reason?: string | null
          source_id?: string
          source_table?: string
        }
        Relationships: []
      }
      radar_team_members: {
        Row: {
          accepted_at: string | null
          active: boolean
          client_id: string
          client_table: string
          email: string
          id: string
          invited_at: string
          name: string | null
          role: string
        }
        Insert: {
          accepted_at?: string | null
          active?: boolean
          client_id: string
          client_table?: string
          email: string
          id?: string
          invited_at?: string
          name?: string | null
          role?: string
        }
        Update: {
          accepted_at?: string | null
          active?: boolean
          client_id?: string
          client_table?: string
          email?: string
          id?: string
          invited_at?: string
          name?: string | null
          role?: string
        }
        Relationships: []
      }
      radar_territory_locks: {
        Row: {
          active: boolean
          contractor_email: string | null
          contractor_id: string
          county: string
          expires_at: string | null
          id: string
          monthly_price_cents: number | null
          starts_at: string
          stripe_subscription_id: string | null
          trade: string
        }
        Insert: {
          active?: boolean
          contractor_email?: string | null
          contractor_id: string
          county: string
          expires_at?: string | null
          id?: string
          monthly_price_cents?: number | null
          starts_at?: string
          stripe_subscription_id?: string | null
          trade: string
        }
        Update: {
          active?: boolean
          contractor_email?: string | null
          contractor_id?: string
          county?: string
          expires_at?: string | null
          id?: string
          monthly_price_cents?: number | null
          starts_at?: string
          stripe_subscription_id?: string | null
          trade?: string
        }
        Relationships: []
      }
      raw_signals_dump: {
        Row: {
          ai_cost_usd: number | null
          duration_ms: number | null
          enriched_count: number | null
          fetched_at: string
          final_inserted: number | null
          id: string
          kept_after_gate: number | null
          notes: string | null
          pulled_count: number | null
          raw_payload: Json
          scanner: string
          source: string
          source_url: string | null
          vertical: string | null
        }
        Insert: {
          ai_cost_usd?: number | null
          duration_ms?: number | null
          enriched_count?: number | null
          fetched_at?: string
          final_inserted?: number | null
          id?: string
          kept_after_gate?: number | null
          notes?: string | null
          pulled_count?: number | null
          raw_payload?: Json
          scanner: string
          source: string
          source_url?: string | null
          vertical?: string | null
        }
        Update: {
          ai_cost_usd?: number | null
          duration_ms?: number | null
          enriched_count?: number | null
          fetched_at?: string
          final_inserted?: number | null
          id?: string
          kept_after_gate?: number | null
          notes?: string | null
          pulled_count?: number | null
          raw_payload?: Json
          scanner?: string
          source?: string
          source_url?: string | null
          vertical?: string | null
        }
        Relationships: []
      }
      re_newsletter_clients: {
        Row: {
          active: boolean | null
          agent_name: string | null
          brokerage: string | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
          subscription_status: string | null
          zip_codes: string[] | null
        }
        Insert: {
          active?: boolean | null
          agent_name?: string | null
          brokerage?: string | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          zip_codes?: string[] | null
        }
        Update: {
          active?: boolean | null
          agent_name?: string | null
          brokerage?: string | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          zip_codes?: string[] | null
        }
        Relationships: []
      }
      re_newsletter_contacts: {
        Row: {
          client_id: string | null
          created_at: string | null
          email: string
          id: string
          name: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_newsletter_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "re_newsletter_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      re_newsletter_issues: {
        Row: {
          client_id: string | null
          created_at: string | null
          html_content: string | null
          id: string
          recipients: number | null
          subject: string | null
          zip_code: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          html_content?: string | null
          id?: string
          recipients?: number | null
          subject?: string | null
          zip_code?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          html_content?: string | null
          id?: string
          recipients?: number | null
          subject?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_newsletter_issues_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "re_newsletter_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reactivation_contacts: {
        Row: {
          client_id: string
          contact_email: string
          contact_name: string | null
          created_at: string | null
          id: string
          last_active_at: string | null
          last_sent_at: string | null
          reactivation_step: number | null
        }
        Insert: {
          client_id: string
          contact_email: string
          contact_name?: string | null
          created_at?: string | null
          id?: string
          last_active_at?: string | null
          last_sent_at?: string | null
          reactivation_step?: number | null
        }
        Update: {
          client_id?: string
          contact_email?: string
          contact_name?: string | null
          created_at?: string | null
          id?: string
          last_active_at?: string | null
          last_sent_at?: string | null
          reactivation_step?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reactivation_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "reactivation_email_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reactivation_email_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      readiness_checks: {
        Row: {
          checked_at: string
          hours_slept: number
          id: string
          swaps_applied: boolean
          user_id: string
          weight_adjustment_pct: number
        }
        Insert: {
          checked_at?: string
          hours_slept: number
          id?: string
          swaps_applied?: boolean
          user_id: string
          weight_adjustment_pct?: number
        }
        Update: {
          checked_at?: string
          hours_slept?: number
          id?: string
          swaps_applied?: boolean
          user_id?: string
          weight_adjustment_pct?: number
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          credits_earned: number
          credits_redeemed: number
          id: string
          total_referrals: number
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          credits_earned?: number
          credits_redeemed?: number
          id?: string
          total_referrals?: number
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          credits_earned?: number
          credits_redeemed?: number
          id?: string
          total_referrals?: number
          user_id?: string
        }
        Relationships: []
      }
      referral_conversions: {
        Row: {
          created_at: string
          credited: boolean
          id: string
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          subscription_tier: string | null
        }
        Insert: {
          created_at?: string
          credited?: boolean
          id?: string
          referral_code: string
          referred_user_id: string
          referrer_user_id: string
          subscription_tier?: string | null
        }
        Update: {
          created_at?: string
          credited?: boolean
          id?: string
          referral_code?: string
          referred_user_id?: string
          referrer_user_id?: string
          subscription_tier?: string | null
        }
        Relationships: []
      }
      referral_kickback: {
        Row: {
          contractor_id: string | null
          contractor_phone: string | null
          created_at: string
          id: string
          kickback_amount_cents: number
          paid_at: string | null
          referred_company: string | null
          referred_contact_email: string | null
          referred_contact_name: string | null
          referred_contact_phone: string | null
          status: string
        }
        Insert: {
          contractor_id?: string | null
          contractor_phone?: string | null
          created_at?: string
          id?: string
          kickback_amount_cents?: number
          paid_at?: string | null
          referred_company?: string | null
          referred_contact_email?: string | null
          referred_contact_name?: string | null
          referred_contact_phone?: string | null
          status?: string
        }
        Update: {
          contractor_id?: string | null
          contractor_phone?: string | null
          created_at?: string
          id?: string
          kickback_amount_cents?: number
          paid_at?: string | null
          referred_company?: string | null
          referred_contact_email?: string | null
          referred_contact_name?: string | null
          referred_contact_phone?: string | null
          status?: string
        }
        Relationships: []
      }
      regulatory_monitor_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          keywords: string | null
          last_sent_at: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          keywords?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          keywords?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
        }
        Relationships: []
      }
      regulatory_monitor_items: {
        Row: {
          abstract: string | null
          agencies: string | null
          ai_summary: string | null
          client_id: string | null
          created_at: string | null
          document_number: string | null
          document_type: string | null
          id: string
          notified: boolean | null
          publication_date: string | null
          relevance_score: number | null
          title: string | null
          url: string | null
        }
        Insert: {
          abstract?: string | null
          agencies?: string | null
          ai_summary?: string | null
          client_id?: string | null
          created_at?: string | null
          document_number?: string | null
          document_type?: string | null
          id?: string
          notified?: boolean | null
          publication_date?: string | null
          relevance_score?: number | null
          title?: string | null
          url?: string | null
        }
        Update: {
          abstract?: string | null
          agencies?: string | null
          ai_summary?: string | null
          client_id?: string | null
          created_at?: string | null
          document_number?: string | null
          document_type?: string | null
          id?: string
          notified?: boolean | null
          publication_date?: string | null
          relevance_score?: number | null
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_monitor_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "regulatory_monitor_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reputation_clients: {
        Row: {
          active: boolean | null
          business_name: string
          city: string | null
          created_at: string | null
          email: string
          google_place_id: string | null
          id: string
          industry: string | null
          last_report_at: string | null
          report_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          city?: string | null
          created_at?: string | null
          email: string
          google_place_id?: string | null
          id?: string
          industry?: string | null
          last_report_at?: string | null
          report_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          city?: string | null
          created_at?: string | null
          email?: string
          google_place_id?: string | null
          id?: string
          industry?: string | null
          last_report_at?: string | null
          report_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      reputation_reports: {
        Row: {
          avg_rating: number | null
          client_id: string | null
          id: string
          report_html: string | null
          review_count: number | null
          sent_at: string | null
        }
        Insert: {
          avg_rating?: number | null
          client_id?: string | null
          id?: string
          report_html?: string | null
          review_count?: number | null
          sent_at?: string | null
        }
        Update: {
          avg_rating?: number | null
          client_id?: string | null
          id?: string
          report_html?: string | null
          review_count?: number | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reputation_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "reputation_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_menu_clients: {
        Row: {
          active: boolean | null
          business_name: string
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      retention_alerts: {
        Row: {
          alert_type: string
          avg_weekly_logs: number
          created_at: string
          days_since_last_log: number
          id: string
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          alert_type?: string
          avg_weekly_logs?: number
          created_at?: string
          days_since_last_log?: number
          id?: string
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          avg_weekly_logs?: number
          created_at?: string
          days_since_last_log?: number
          id?: string
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      review_alert_clients: {
        Row: {
          active: boolean | null
          alert_count: number | null
          bundled_from: string | null
          business_name: string
          created_at: string | null
          email: string
          google_place_id: string | null
          id: string
          industry: string | null
          last_checked_at: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          alert_count?: number | null
          bundled_from?: string | null
          business_name: string
          created_at?: string | null
          email: string
          google_place_id?: string | null
          id?: string
          industry?: string | null
          last_checked_at?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          alert_count?: number | null
          bundled_from?: string | null
          business_name?: string
          created_at?: string | null
          email?: string
          google_place_id?: string | null
          id?: string
          industry?: string | null
          last_checked_at?: string | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      review_alerts_log: {
        Row: {
          alerted_at: string | null
          client_id: string
          id: string
          rating: number | null
          review_text: string | null
          reviewer_name: string | null
        }
        Insert: {
          alerted_at?: string | null
          client_id: string
          id?: string
          rating?: number | null
          review_text?: string | null
          reviewer_name?: string | null
        }
        Update: {
          alerted_at?: string | null
          client_id?: string
          id?: string
          rating?: number | null
          review_text?: string | null
          reviewer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_alerts_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "review_alert_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      review_blast_log: {
        Row: {
          clicked_at: string | null
          client_id: string
          customer_name: string | null
          customer_phone: string
          id: string
          job_description: string | null
          reviewed_at: string | null
          sent_at: string | null
          status: string | null
          tech_name: string | null
        }
        Insert: {
          clicked_at?: string | null
          client_id: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          job_description?: string | null
          reviewed_at?: string | null
          sent_at?: string | null
          status?: string | null
          tech_name?: string | null
        }
        Update: {
          clicked_at?: string | null
          client_id?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          job_description?: string | null
          reviewed_at?: string | null
          sent_at?: string | null
          status?: string | null
          tech_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_blast_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "field_crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      review_request_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          google_review_url: string | null
          id: string
          industry: string | null
          last_sent_at: string | null
          phone: string | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          google_review_url?: string | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          phone?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          google_review_url?: string | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          phone?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      review_responder_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          google_place_id: string | null
          id: string
          industry: string | null
          last_sent_at: string | null
          response_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          google_place_id?: string | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          response_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          google_place_id?: string | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          response_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      review_response_clients: {
        Row: {
          active: boolean | null
          brand_voice: string | null
          business_name: string
          created_at: string | null
          email: string
          google_place_id: string | null
          id: string
          industry: string | null
          last_sent_at: string | null
          phone: string | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          brand_voice?: string | null
          business_name: string
          created_at?: string | null
          email: string
          google_place_id?: string | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          phone?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          brand_voice?: string | null
          business_name?: string
          created_at?: string | null
          email?: string
          google_place_id?: string | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          phone?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      rfp_alert_clients: {
        Row: {
          active: boolean | null
          business_name: string | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      sales_script_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          script_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          script_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          script_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      sample_sends: {
        Row: {
          audience_type: string
          batch_id: string
          channel: string
          cost_cents: number | null
          created_at: string
          id: string
          meta: Json | null
          preview_html: string | null
          prospect_id: string | null
          provider_id: string | null
          recipient_label: string | null
          status: string | null
        }
        Insert: {
          audience_type: string
          batch_id?: string
          channel: string
          cost_cents?: number | null
          created_at?: string
          id?: string
          meta?: Json | null
          preview_html?: string | null
          prospect_id?: string | null
          provider_id?: string | null
          recipient_label?: string | null
          status?: string | null
        }
        Update: {
          audience_type?: string
          batch_id?: string
          channel?: string
          cost_cents?: number | null
          created_at?: string
          id?: string
          meta?: Json | null
          preview_html?: string | null
          prospect_id?: string | null
          provider_id?: string | null
          recipient_label?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sample_sends_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospect_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfaction_survey_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      saved_search_alerts: {
        Row: {
          alert_channel: string
          alert_enabled: boolean
          client_id: string
          created_at: string
          filters: Json
          id: string
          label: string
          last_alerted_at: string | null
          last_match_id: string | null
          product: string
          query_text: string | null
        }
        Insert: {
          alert_channel?: string
          alert_enabled?: boolean
          client_id: string
          created_at?: string
          filters?: Json
          id?: string
          label: string
          last_alerted_at?: string | null
          last_match_id?: string | null
          product: string
          query_text?: string | null
        }
        Update: {
          alert_channel?: string
          alert_enabled?: boolean
          client_id?: string
          created_at?: string
          filters?: Json
          id?: string
          label?: string
          last_alerted_at?: string | null
          last_match_id?: string | null
          product?: string
          query_text?: string | null
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          active: boolean
          client_id: string
          client_type: string
          counties: string[]
          created_at: string
          id: string
          keywords: string[]
          name: string
        }
        Insert: {
          active?: boolean
          client_id: string
          client_type?: string
          counties?: string[]
          created_at?: string
          id?: string
          keywords?: string[]
          name: string
        }
        Update: {
          active?: boolean
          client_id?: string
          client_type?: string
          counties?: string[]
          created_at?: string
          id?: string
          keywords?: string[]
          name?: string
        }
        Relationships: []
      }
      schedule_slots: {
        Row: {
          booked_by: string | null
          booking_id: string | null
          created_at: string
          id: string
          is_available: boolean
          slot_date: string
          start_time: string
        }
        Insert: {
          booked_by?: string | null
          booking_id?: string | null
          created_at?: string
          id?: string
          is_available?: boolean
          slot_date: string
          start_time: string
        }
        Update: {
          booked_by?: string | null
          booking_id?: string | null
          created_at?: string
          id?: string
          is_available?: boolean
          slot_date?: string
          start_time?: string
        }
        Relationships: []
      }
      schema_validation_failures: {
        Row: {
          component: string
          detected_at: string
          forbidden: string[] | null
          id: string
          missing: string[] | null
          raw_error: string | null
          reason: string
          route: string | null
          select_fields: string | null
          table_name: string
          user_agent: string | null
        }
        Insert: {
          component: string
          detected_at?: string
          forbidden?: string[] | null
          id?: string
          missing?: string[] | null
          raw_error?: string | null
          reason: string
          route?: string | null
          select_fields?: string | null
          table_name: string
          user_agent?: string | null
        }
        Update: {
          component?: string
          detected_at?: string
          forbidden?: string[] | null
          id?: string
          missing?: string[] | null
          raw_error?: string | null
          reason?: string
          route?: string | null
          select_fields?: string | null
          table_name?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      scrape_errors: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          next_retry_at: string
          resolved_at: string | null
          retry_count: number
          source: string
          status_code: number | null
          url: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          next_retry_at?: string
          resolved_at?: string | null
          retry_count?: number
          source: string
          status_code?: number | null
          url: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          next_retry_at?: string
          resolved_at?: string | null
          retry_count?: number
          source?: string
          status_code?: number | null
          url?: string
        }
        Relationships: []
      }
      scrape_raw_cache: {
        Row: {
          body: Json | null
          created_at: string
          expires_at: string
          id: string
          status_code: number | null
          url: string
          url_hash: string
        }
        Insert: {
          body?: Json | null
          created_at?: string
          expires_at?: string
          id?: string
          status_code?: number | null
          url: string
          url_hash: string
        }
        Update: {
          body?: Json | null
          created_at?: string
          expires_at?: string
          id?: string
          status_code?: number | null
          url?: string
          url_hash?: string
        }
        Relationships: []
      }
      search_console_data: {
        Row: {
          clicks: number | null
          created_at: string | null
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          page_url: string
          position: number | null
          query: string | null
        }
        Insert: {
          clicks?: number | null
          created_at?: string | null
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          page_url: string
          position?: number | null
          query?: string | null
        }
        Update: {
          clicks?: number | null
          created_at?: string | null
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          page_url?: string
          position?: number | null
          query?: string | null
        }
        Relationships: []
      }
      search_query_log: {
        Row: {
          clicked_result_id: string | null
          client_id: string | null
          created_at: string
          filters: Json | null
          id: string
          latency_ms: number | null
          product: string
          query_text: string | null
          result_count: number | null
          user_id: string | null
        }
        Insert: {
          clicked_result_id?: string | null
          client_id?: string | null
          created_at?: string
          filters?: Json | null
          id?: string
          latency_ms?: number | null
          product: string
          query_text?: string | null
          result_count?: number | null
          user_id?: string | null
        }
        Update: {
          clicked_result_id?: string | null
          client_id?: string | null
          created_at?: string
          filters?: Json | null
          id?: string
          latency_ms?: number | null
          product?: string
          query_text?: string | null
          result_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      seo_guard_clients: {
        Row: {
          active: boolean | null
          business_name: string | null
          created_at: string | null
          email: string
          gsc_property_url: string | null
          id: string
          keywords: string[] | null
          last_report_at: string | null
          last_scan_at: string | null
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          website_url: string
        }
        Insert: {
          active?: boolean | null
          business_name?: string | null
          created_at?: string | null
          email: string
          gsc_property_url?: string | null
          id?: string
          keywords?: string[] | null
          last_report_at?: string | null
          last_scan_at?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          website_url: string
        }
        Update: {
          active?: boolean | null
          business_name?: string | null
          created_at?: string | null
          email?: string
          gsc_property_url?: string | null
          id?: string
          keywords?: string[] | null
          last_report_at?: string | null
          last_scan_at?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          website_url?: string
        }
        Relationships: []
      }
      seo_guard_scans: {
        Row: {
          ai_summary: string | null
          alert_sent: boolean | null
          citation_score: number | null
          client_id: string | null
          created_at: string | null
          deindexed_pages: string[] | null
          id: string
          indexed_pages: number | null
          js_gap_detected: boolean | null
          js_visibility_score: number | null
          keyword_ranks: Json | null
          rank_drops: Json | null
          report_sent_at: string | null
          scan_date: string
        }
        Insert: {
          ai_summary?: string | null
          alert_sent?: boolean | null
          citation_score?: number | null
          client_id?: string | null
          created_at?: string | null
          deindexed_pages?: string[] | null
          id?: string
          indexed_pages?: number | null
          js_gap_detected?: boolean | null
          js_visibility_score?: number | null
          keyword_ranks?: Json | null
          rank_drops?: Json | null
          report_sent_at?: string | null
          scan_date: string
        }
        Update: {
          ai_summary?: string | null
          alert_sent?: boolean | null
          citation_score?: number | null
          client_id?: string | null
          created_at?: string | null
          deindexed_pages?: string[] | null
          id?: string
          indexed_pages?: number | null
          js_gap_detected?: boolean | null
          js_visibility_score?: number | null
          keyword_ranks?: Json | null
          rank_drops?: Json | null
          report_sent_at?: string | null
          scan_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_guard_scans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "seo_guard_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_landing_pages: {
        Row: {
          created_at: string
          h1_heading: string
          id: string
          main_content: string
          meta_description: string
          page_title: string
          slug: string
          target_audience: string
        }
        Insert: {
          created_at?: string
          h1_heading?: string
          id?: string
          main_content?: string
          meta_description?: string
          page_title: string
          slug: string
          target_audience?: string
        }
        Update: {
          created_at?: string
          h1_heading?: string
          id?: string
          main_content?: string
          meta_description?: string
          page_title?: string
          slug?: string
          target_audience?: string
        }
        Relationships: []
      }
      seo_page_configs: {
        Row: {
          category: string | null
          city: string
          created_at: string | null
          id: string
          page_data: Json
          slug: string
          trade: string
        }
        Insert: {
          category?: string | null
          city: string
          created_at?: string | null
          id?: string
          page_data: Json
          slug: string
          trade: string
        }
        Update: {
          category?: string | null
          city?: string
          created_at?: string | null
          id?: string
          page_data?: Json
          slug?: string
          trade?: string
        }
        Relationships: []
      }
      seo_report_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          report_count: number | null
          stripe_customer_id: string | null
          website_url: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          report_count?: number | null
          stripe_customer_id?: string | null
          website_url?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          report_count?: number | null
          stripe_customer_id?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      sermon_prep_clients: {
        Row: {
          active: boolean | null
          church_name: string | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          church_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          church_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      service_catalog: {
        Row: {
          category: string
          created_at: string
          description: string
          exact_price: number
          id: string
          is_active: boolean
          item_name: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          exact_price: number
          id?: string
          is_active?: boolean
          item_name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          exact_price?: number
          id?: string
          is_active?: boolean
          item_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_health: {
        Row: {
          created_at: string
          disabled_until: string | null
          failure_count: number
          id: string
          last_failure_at: string | null
          last_failure_reason: string | null
          last_status_code: number | null
          last_success_at: string | null
          metadata: Json | null
          service_name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          disabled_until?: string | null
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_status_code?: number | null
          last_success_at?: string | null
          metadata?: Json | null
          service_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          disabled_until?: string | null
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_status_code?: number | null
          last_success_at?: string | null
          metadata?: Json | null
          service_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_subscriptions: {
        Row: {
          admin_notes: string | null
          cancelled_at: string | null
          client_id: string
          fulfillment_stage: string
          id: string
          monthly_price: number | null
          service_type: string
          started_at: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          cancelled_at?: string | null
          client_id: string
          fulfillment_stage?: string
          id?: string
          monthly_price?: number | null
          service_type: string
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          cancelled_at?: string | null
          client_id?: string
          fulfillment_stage?: string
          id?: string
          monthly_price?: number | null
          service_type?: string
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "b2b_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      session_bookings: {
        Row: {
          amount_cents: number
          cancelled_at: string | null
          created_at: string
          credit_id: string | null
          duration_minutes: number
          google_calendar_event_id: string | null
          id: string
          session_type: string
          slot_date: string
          start_time: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          amount_cents: number
          cancelled_at?: string | null
          created_at?: string
          credit_id?: string | null
          duration_minutes?: number
          google_calendar_event_id?: string | null
          id?: string
          session_type?: string
          slot_date: string
          start_time: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          amount_cents?: number
          cancelled_at?: string | null
          created_at?: string
          credit_id?: string | null
          duration_minutes?: number
          google_calendar_event_id?: string | null
          id?: string
          session_type?: string
          slot_date?: string
          start_time?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      session_credits: {
        Row: {
          booking_id: string | null
          credit_type: string
          granted_at: string
          id: string
          is_used: boolean
          month: number
          source: string
          used_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          booking_id?: string | null
          credit_type?: string
          granted_at?: string
          id?: string
          is_used?: boolean
          month: number
          source?: string
          used_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          booking_id?: string | null
          credit_type?: string
          granted_at?: string
          id?: string
          is_used?: boolean
          month?: number
          source?: string
          used_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_credits_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "session_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      session_referral_rewards: {
        Row: {
          created_at: string
          credited_at: string | null
          id: string
          note: string | null
          redeemed_at: string | null
          referred_friend_email: string
          referrer_user_id: string
          session_type: string
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          created_at?: string
          credited_at?: string | null
          id?: string
          note?: string | null
          redeemed_at?: string | null
          referred_friend_email: string
          referrer_user_id: string
          session_type?: string
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          created_at?: string
          credited_at?: string | null
          id?: string
          note?: string | null
          redeemed_at?: string | null
          referred_friend_email?: string
          referrer_user_id?: string
          session_type?: string
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: []
      }
      shared_workout_results: {
        Row: {
          caption: string | null
          created_at: string
          exercises: Json
          id: string
          image_status: string
          image_url: string | null
          is_public: boolean
          stats: Json
          user_id: string
          workout_log_id: string | null
          workout_title: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          exercises?: Json
          id?: string
          image_status?: string
          image_url?: string | null
          is_public?: boolean
          stats?: Json
          user_id: string
          workout_log_id?: string | null
          workout_title?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          exercises?: Json
          id?: string
          image_status?: string
          image_url?: string | null
          is_public?: boolean
          stats?: Json
          user_id?: string
          workout_log_id?: string | null
          workout_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_workout_results_workout_log_id_fkey"
            columns: ["workout_log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_correlations: {
        Row: {
          correlation_reason: string | null
          correlation_score: number
          created_at: string
          id: string
          signal_a_id: string
          signal_a_type: string
          signal_b_id: string
          signal_b_type: string
        }
        Insert: {
          correlation_reason?: string | null
          correlation_score: number
          created_at?: string
          id?: string
          signal_a_id: string
          signal_a_type: string
          signal_b_id: string
          signal_b_type: string
        }
        Update: {
          correlation_reason?: string | null
          correlation_score?: number
          created_at?: string
          id?: string
          signal_a_id?: string
          signal_a_type?: string
          signal_b_id?: string
          signal_b_type?: string
        }
        Relationships: []
      }
      signal_feedback: {
        Row: {
          client_id: string
          created_at: string
          id: string
          signal_id: string
          signal_table: string
          vote: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          signal_id: string
          signal_table: string
          vote: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          signal_id?: string
          signal_table?: string
          vote?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          content_key: string
          content_type: string
          content_value: string
          id: string
          label: string
          section: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content_key: string
          content_type?: string
          content_value?: string
          id?: string
          label?: string
          section: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content_key?: string
          content_type?: string
          content_value?: string
          id?: string
          label?: string
          section?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      site_scanner_leads: {
        Row: {
          created_at: string | null
          email: string
          id: string
          report_sent: boolean | null
          scores: Json | null
          url: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          report_sent?: boolean | null
          scores?: Json | null
          url: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          report_sent?: boolean | null
          scores?: Json | null
          url?: string
        }
        Relationships: []
      }
      site_sections: {
        Row: {
          id: string
          is_visible: boolean
          label: string
          section_key: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          is_visible?: boolean
          label: string
          section_key: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_visible?: boolean
          label?: string
          section_key?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      sms_consent_log: {
        Row: {
          client_id: string
          consent_method: string | null
          consent_text: string | null
          consented_at: string | null
          contact_name: string | null
          contact_phone: string
          id: string
          ip_address: string | null
          revoked_at: string | null
        }
        Insert: {
          client_id: string
          consent_method?: string | null
          consent_text?: string | null
          consented_at?: string | null
          contact_name?: string | null
          contact_phone: string
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
        }
        Update: {
          client_id?: string
          consent_method?: string | null
          consent_text?: string | null
          consented_at?: string | null
          contact_name?: string | null
          contact_phone?: string
          id?: string
          ip_address?: string | null
          revoked_at?: string | null
        }
        Relationships: []
      }
      sms_idempotency_keys: {
        Row: {
          body_hash: string | null
          created_at: string
          expires_at: string
          key: string
          recipient: string | null
          response: Json
        }
        Insert: {
          body_hash?: string | null
          created_at?: string
          expires_at?: string
          key: string
          recipient?: string | null
          response?: Json
        }
        Update: {
          body_hash?: string | null
          created_at?: string
          expires_at?: string
          key?: string
          recipient?: string | null
          response?: Json
        }
        Relationships: []
      }
      sms_opt_outs: {
        Row: {
          id: string
          opted_out_at: string
          phone: string
          source: string | null
        }
        Insert: {
          id?: string
          opted_out_at?: string
          phone: string
          source?: string | null
        }
        Update: {
          id?: string
          opted_out_at?: string
          phone?: string
          source?: string | null
        }
        Relationships: []
      }
      sms_reply_drafts: {
        Row: {
          created_at: string
          draft_body: string
          id: string
          inbound_body: string | null
          inbound_message_id: string | null
          metadata: Json
          phone: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          draft_body: string
          id?: string
          inbound_body?: string | null
          inbound_message_id?: string | null
          metadata?: Json
          phone: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          draft_body?: string
          id?: string
          inbound_body?: string | null
          inbound_message_id?: string | null
          metadata?: Json
          phone?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      social_caption_clients: {
        Row: {
          active: boolean | null
          business_name: string
          caption_count: number | null
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          caption_count?: number | null
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          caption_count?: number | null
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      social_captions_clients: {
        Row: {
          active: boolean | null
          business_name: string
          caption_count: number | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          caption_count?: number | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          caption_count?: number | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      social_media_clients: {
        Row: {
          access_tokens: Json | null
          active: boolean | null
          brand_voice: string | null
          business_name: string
          business_type: string | null
          city: string | null
          contact_name: string | null
          content_avoid: string | null
          content_focus: string | null
          created_at: string | null
          email: string
          fb_page_id: string | null
          gbp_account_id: string | null
          gbp_location_id: string | null
          id: string
          industry: string | null
          last_post_at: string | null
          last_posted_at: string | null
          linkedin_org_id: string | null
          plan: string | null
          platforms: string[] | null
          post_count: number | null
          state: string | null
          stripe_customer_id: string | null
          tiktok_access_token: string | null
          tiktok_open_id: string | null
        }
        Insert: {
          access_tokens?: Json | null
          active?: boolean | null
          brand_voice?: string | null
          business_name: string
          business_type?: string | null
          city?: string | null
          contact_name?: string | null
          content_avoid?: string | null
          content_focus?: string | null
          created_at?: string | null
          email: string
          fb_page_id?: string | null
          gbp_account_id?: string | null
          gbp_location_id?: string | null
          id?: string
          industry?: string | null
          last_post_at?: string | null
          last_posted_at?: string | null
          linkedin_org_id?: string | null
          plan?: string | null
          platforms?: string[] | null
          post_count?: number | null
          state?: string | null
          stripe_customer_id?: string | null
          tiktok_access_token?: string | null
          tiktok_open_id?: string | null
        }
        Update: {
          access_tokens?: Json | null
          active?: boolean | null
          brand_voice?: string | null
          business_name?: string
          business_type?: string | null
          city?: string | null
          contact_name?: string | null
          content_avoid?: string | null
          content_focus?: string | null
          created_at?: string | null
          email?: string
          fb_page_id?: string | null
          gbp_account_id?: string | null
          gbp_location_id?: string | null
          id?: string
          industry?: string | null
          last_post_at?: string | null
          last_posted_at?: string | null
          linkedin_org_id?: string | null
          plan?: string | null
          platforms?: string[] | null
          post_count?: number | null
          state?: string | null
          stripe_customer_id?: string | null
          tiktok_access_token?: string | null
          tiktok_open_id?: string | null
        }
        Relationships: []
      }
      social_proof_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          phone: string | null
          proof_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          phone?: string | null
          proof_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          phone?: string | null
          proof_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      speed_lead_clients: {
        Row: {
          active: boolean | null
          business_name: string
          client_email: string
          created_at: string | null
          id: string
          industry: string | null
          last_sent_at: string | null
          lead_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          client_email: string
          created_at?: string | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          lead_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          client_email?: string
          created_at?: string | null
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          lead_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      sport_guides: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          price_cents: number
          prompt_template: string | null
          slug: string | null
          sort_order: number
          sport: string
          stripe_price_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          price_cents?: number
          prompt_template?: string | null
          slug?: string | null
          sort_order?: number
          sport?: string
          stripe_price_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          price_cents?: number
          prompt_template?: string | null
          slug?: string | null
          sort_order?: number
          sport?: string
          stripe_price_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      staff_newsletter_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      staffing_agency_clients: {
        Row: {
          active: boolean
          agency_name: string
          annual_prepay_cents: number | null
          annual_prepay_expires_at: string | null
          annual_prepay_paid_at: string | null
          card_saved_at: string | null
          contact_email: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          demand_radar_access: boolean
          fast_track_credits: number
          id: string
          is_test_account: boolean
          monthly_retainer_cents: number | null
          notes: string | null
          per_interview_fee_cents: number
          pricing_model: string
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          territory_counties: string[] | null
          territory_exclusive: boolean
          updated_at: string
          vertical: string
        }
        Insert: {
          active?: boolean
          agency_name: string
          annual_prepay_cents?: number | null
          annual_prepay_expires_at?: string | null
          annual_prepay_paid_at?: string | null
          card_saved_at?: string | null
          contact_email: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          demand_radar_access?: boolean
          fast_track_credits?: number
          id?: string
          is_test_account?: boolean
          monthly_retainer_cents?: number | null
          notes?: string | null
          per_interview_fee_cents?: number
          pricing_model?: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          territory_counties?: string[] | null
          territory_exclusive?: boolean
          updated_at?: string
          vertical?: string
        }
        Update: {
          active?: boolean
          agency_name?: string
          annual_prepay_cents?: number | null
          annual_prepay_expires_at?: string | null
          annual_prepay_paid_at?: string | null
          card_saved_at?: string | null
          contact_email?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          demand_radar_access?: boolean
          fast_track_credits?: number
          id?: string
          is_test_account?: boolean
          monthly_retainer_cents?: number | null
          notes?: string | null
          per_interview_fee_cents?: number
          pricing_model?: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          territory_counties?: string[] | null
          territory_exclusive?: boolean
          updated_at?: string
          vertical?: string
        }
        Relationships: []
      }
      str_reputation_clients: {
        Row: {
          active: boolean | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      studio_checkins: {
        Row: {
          checked_in_at: string
          id: string
          user_id: string
        }
        Insert: {
          checked_in_at?: string
          id?: string
          user_id: string
        }
        Update: {
          checked_in_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          ai_actions: Json | null
          ai_suggestion: string | null
          body: string
          created_at: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          ai_actions?: Json | null
          ai_suggestion?: string | null
          body: string
          created_at?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          ai_actions?: Json | null
          ai_suggestion?: string | null
          body?: string
          created_at?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_comms_log: {
        Row: {
          body_full: string | null
          body_hash: string | null
          body_preview: string | null
          channel: string
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          product: string | null
          provider_id: string | null
          recipient: string
          status: string
          twilio_error_code: string | null
          twilio_status: string | null
        }
        Insert: {
          body_full?: string | null
          body_hash?: string | null
          body_preview?: string | null
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          product?: string | null
          provider_id?: string | null
          recipient: string
          status?: string
          twilio_error_code?: string | null
          twilio_status?: string | null
        }
        Update: {
          body_full?: string | null
          body_hash?: string | null
          body_preview?: string | null
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          product?: string | null
          provider_id?: string | null
          recipient?: string
          status?: string
          twilio_error_code?: string | null
          twilio_status?: string | null
        }
        Relationships: []
      }
      team_feed: {
        Row: {
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          media_url: string | null
          roster_id: string
          type: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          media_url?: string | null
          roster_id: string
          type?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          media_url?: string | null
          roster_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_feed_roster_id_fkey"
            columns: ["roster_id"]
            isOneToOne: false
            referencedRelation: "team_rosters"
            referencedColumns: ["id"]
          },
        ]
      }
      team_feed_reactions: {
        Row: {
          created_at: string
          feed_item_id: string
          id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feed_item_id: string
          id?: string
          reaction?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feed_item_id?: string
          id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_feed_reactions_feed_item_id_fkey"
            columns: ["feed_item_id"]
            isOneToOne: false
            referencedRelation: "team_feed"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          athlete_email: string
          athlete_name: string | null
          athlete_user_id: string | null
          id: string
          invited_at: string
          joined_at: string | null
          role: string
          roster_id: string
          status: string
        }
        Insert: {
          athlete_email: string
          athlete_name?: string | null
          athlete_user_id?: string | null
          id?: string
          invited_at?: string
          joined_at?: string | null
          role?: string
          roster_id: string
          status?: string
        }
        Update: {
          athlete_email?: string
          athlete_name?: string | null
          athlete_user_id?: string | null
          id?: string
          invited_at?: string
          joined_at?: string | null
          role?: string
          roster_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_roster_id_fkey"
            columns: ["roster_id"]
            isOneToOne: false
            referencedRelation: "team_rosters"
            referencedColumns: ["id"]
          },
        ]
      }
      team_rosters: {
        Row: {
          coach_user_id: string | null
          created_at: string
          id: string
          invite_code: string | null
          owner_id: string
          school_name: string | null
          season: string | null
          sport: string | null
          team_name: string
          updated_at: string
        }
        Insert: {
          coach_user_id?: string | null
          created_at?: string
          id?: string
          invite_code?: string | null
          owner_id: string
          school_name?: string | null
          season?: string | null
          sport?: string | null
          team_name?: string
          updated_at?: string
        }
        Update: {
          coach_user_id?: string | null
          created_at?: string
          id?: string
          invite_code?: string | null
          owner_id?: string
          school_name?: string | null
          season?: string | null
          sport?: string | null
          team_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_workout_completions: {
        Row: {
          completed_at: string
          id: string
          notes: string | null
          team_workout_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          notes?: string | null
          team_workout_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          notes?: string | null
          team_workout_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_workout_completions_team_workout_id_fkey"
            columns: ["team_workout_id"]
            isOneToOne: false
            referencedRelation: "team_workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      team_workouts: {
        Row: {
          assigned_by: string
          created_at: string
          description: string | null
          due_date: string | null
          exercises: Json
          id: string
          roster_id: string
          title: string
        }
        Insert: {
          assigned_by: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          exercises?: Json
          id?: string
          roster_id: string
          title: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          exercises?: Json
          id?: string
          roster_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_workouts_roster_id_fkey"
            columns: ["roster_id"]
            isOneToOne: false
            referencedRelation: "team_rosters"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_locations: {
        Row: {
          address: string | null
          client_id: string
          clocked_in_at: string | null
          clocked_out_at: string | null
          current_job: string | null
          id: string
          lat: number | null
          lng: number | null
          status: string | null
          tech_name: string
          tech_phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          client_id: string
          clocked_in_at?: string | null
          clocked_out_at?: string | null
          current_job?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          status?: string | null
          tech_name: string
          tech_phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          client_id?: string
          clocked_in_at?: string | null
          clocked_out_at?: string | null
          current_job?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          status?: string | null
          tech_name?: string
          tech_phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tech_locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "field_crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      techalert_business_prospects: {
        Row: {
          business_name: string
          city: string | null
          created_at: string | null
          email: string | null
          id: string
          outreach_sent_at: string | null
          phone: string | null
          raw_data: Json | null
          source: string
          state: string | null
          status: string | null
          trade: string | null
          website: string | null
          zip: string | null
        }
        Insert: {
          business_name: string
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          outreach_sent_at?: string | null
          phone?: string | null
          raw_data?: Json | null
          source: string
          state?: string | null
          status?: string | null
          trade?: string | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          business_name?: string
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          outreach_sent_at?: string | null
          phone?: string | null
          raw_data?: Json | null
          source?: string
          state?: string | null
          status?: string | null
          trade?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      techalert_prospect_targets: {
        Row: {
          city: string | null
          company_name: string
          created_at: string
          days_posted: number | null
          email: string | null
          id: string
          is_boiler: boolean | null
          last_contacted_at: string | null
          notes: string | null
          open_roles_count: number | null
          phone: string | null
          repost_count: number | null
          role: string | null
          score: number | null
          source_label: string | null
          source_url: string | null
          state: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          company_name: string
          created_at?: string
          days_posted?: number | null
          email?: string | null
          id?: string
          is_boiler?: boolean | null
          last_contacted_at?: string | null
          notes?: string | null
          open_roles_count?: number | null
          phone?: string | null
          repost_count?: number | null
          role?: string | null
          score?: number | null
          source_label?: string | null
          source_url?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          company_name?: string
          created_at?: string
          days_posted?: number | null
          email?: string | null
          id?: string
          is_boiler?: boolean | null
          last_contacted_at?: string | null
          notes?: string | null
          open_roles_count?: number | null
          phone?: string | null
          repost_count?: number | null
          role?: string | null
          score?: number | null
          source_label?: string | null
          source_url?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      techalert_referrals: {
        Row: {
          created_at: string | null
          credit_amount_cents: number | null
          credited_at: string | null
          id: string
          referral_code: string
          referred_email: string
          referrer_client_id: string | null
          referrer_email: string
          status: string | null
          stripe_coupon_id: string | null
        }
        Insert: {
          created_at?: string | null
          credit_amount_cents?: number | null
          credited_at?: string | null
          id?: string
          referral_code: string
          referred_email: string
          referrer_client_id?: string | null
          referrer_email: string
          status?: string | null
          stripe_coupon_id?: string | null
        }
        Update: {
          created_at?: string | null
          credit_amount_cents?: number | null
          credited_at?: string | null
          id?: string
          referral_code?: string
          referred_email?: string
          referrer_client_id?: string | null
          referrer_email?: string
          status?: string | null
          stripe_coupon_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "techalert_referrals_referrer_client_id_fkey"
            columns: ["referrer_client_id"]
            isOneToOne: false
            referencedRelation: "hire_alert_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_leads: {
        Row: {
          company_name: string | null
          created_at: string
          drip_campaign_status: Json | null
          email: string | null
          enrichment_data: Json | null
          first_name: string | null
          id: string
          job_title: string | null
          last_name: string | null
          linkedin_url: string | null
          phone: string | null
          source: string | null
          tenant_id: string
          updated_at: string
          validated_email: boolean | null
          website: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          drip_campaign_status?: Json | null
          email?: string | null
          enrichment_data?: Json | null
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          phone?: string | null
          source?: string | null
          tenant_id: string
          updated_at?: string
          validated_email?: boolean | null
          website?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string
          drip_campaign_status?: Json | null
          email?: string | null
          enrichment_data?: Json | null
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          linkedin_url?: string | null
          phone?: string | null
          source?: string | null
          tenant_id?: string
          updated_at?: string
          validated_email?: boolean | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          branding: Json | null
          company_name: string
          created_at: string
          domain: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          branding?: Json | null
          company_name?: string
          created_at?: string
          domain?: string | null
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          branding?: Json | null
          company_name?: string
          created_at?: string
          domain?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      testimonial_harvester_clients: {
        Row: {
          active: boolean | null
          business_name: string
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          author_initials: string
          author_name: string
          author_role: string
          created_at: string
          id: string
          is_active: boolean
          page: string
          quote: string
          sort_order: number
          sport: string | null
          updated_at: string
        }
        Insert: {
          author_initials?: string
          author_name: string
          author_role?: string
          created_at?: string
          id?: string
          is_active?: boolean
          page?: string
          quote: string
          sort_order?: number
          sport?: string | null
          updated_at?: string
        }
        Update: {
          author_initials?: string
          author_name?: string
          author_role?: string
          created_at?: string
          id?: string
          is_active?: boolean
          page?: string
          quote?: string
          sort_order?: number
          sport?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      text_marketing_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
          twilio_number: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          twilio_number?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          twilio_number?: string | null
        }
        Relationships: []
      }
      text_marketing_contacts: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          last_sent_at: string | null
          name: string | null
          opted_in: boolean | null
          phone: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          last_sent_at?: string | null
          name?: string | null
          opted_in?: boolean | null
          phone: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          last_sent_at?: string | null
          name?: string | null
          opted_in?: boolean | null
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "text_marketing_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "text_marketing_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      thank_you_sms_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
          twilio_number: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          twilio_number?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          twilio_number?: string | null
        }
        Relationships: []
      }
      tier_features: {
        Row: {
          created_at: string
          description: string
          feature_key: string
          feature_label: string
          id: string
          sort_order: number
          tier_basic: boolean
          tier_custom: boolean
          tier_foundation: boolean
          tier_free: boolean
          tier_legend: boolean
          tier_team_elite: boolean
          tier_vip: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          feature_key: string
          feature_label?: string
          id?: string
          sort_order?: number
          tier_basic?: boolean
          tier_custom?: boolean
          tier_foundation?: boolean
          tier_free?: boolean
          tier_legend?: boolean
          tier_team_elite?: boolean
          tier_vip?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          feature_key?: string
          feature_label?: string
          id?: string
          sort_order?: number
          tier_basic?: boolean
          tier_custom?: boolean
          tier_foundation?: boolean
          tier_free?: boolean
          tier_legend?: boolean
          tier_team_elite?: boolean
          tier_vip?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      trade_show_clients: {
        Row: {
          active: boolean | null
          business_name: string | null
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      trade_show_followup_clients: {
        Row: {
          active: boolean | null
          business_name: string
          contact_name: string | null
          created_at: string | null
          email: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          contact_name?: string | null
          created_at?: string | null
          email: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      trademark_watch_clients: {
        Row: {
          active: boolean | null
          business_name: string
          company_name: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          company_name?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          company_name?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
        }
        Relationships: []
      }
      trademark_watch_findings: {
        Row: {
          applicant: string | null
          client_id: string | null
          created_at: string | null
          filing_date: string | null
          id: string
          mark_id: string | null
          notified: boolean | null
          serial_number: string | null
          similar_mark: string | null
          similarity_score: number | null
          status: string | null
        }
        Insert: {
          applicant?: string | null
          client_id?: string | null
          created_at?: string | null
          filing_date?: string | null
          id?: string
          mark_id?: string | null
          notified?: boolean | null
          serial_number?: string | null
          similar_mark?: string | null
          similarity_score?: number | null
          status?: string | null
        }
        Update: {
          applicant?: string | null
          client_id?: string | null
          created_at?: string | null
          filing_date?: string | null
          id?: string
          mark_id?: string | null
          notified?: boolean | null
          serial_number?: string | null
          similar_mark?: string | null
          similarity_score?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trademark_watch_findings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "trademark_watch_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trademark_watch_findings_mark_id_fkey"
            columns: ["mark_id"]
            isOneToOne: false
            referencedRelation: "trademark_watch_marks"
            referencedColumns: ["id"]
          },
        ]
      }
      trademark_watch_marks: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          last_checked_at: string | null
          mark_text: string
          serial_number: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          last_checked_at?: string | null
          mark_text: string
          serial_number?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          last_checked_at?: string | null
          mark_text?: string
          serial_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trademark_watch_marks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "trademark_watch_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      training_programs: {
        Row: {
          block_type: string
          category: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          is_trial: boolean
          level: string
          periodization_config: Json | null
          price: number
          sport: string | null
          status: string
          stripe_price_id: string | null
          stripe_product_id: string | null
          title: string
          total_weeks: number
          updated_at: string
        }
        Insert: {
          block_type?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_trial?: boolean
          level?: string
          periodization_config?: Json | null
          price?: number
          sport?: string | null
          status?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title: string
          total_weeks?: number
          updated_at?: string
        }
        Update: {
          block_type?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_trial?: boolean
          level?: string
          periodization_config?: Json | null
          price?: number
          sport?: string | null
          status?: string
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title?: string
          total_weeks?: number
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          customer_email: string | null
          customer_name: string | null
          id: string
          item_name: string
          item_type: string
          status: string
          stripe_charge_id: string | null
          stripe_subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          item_name?: string
          item_type?: string
          status?: string
          stripe_charge_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          item_name?: string
          item_type?: string
          status?: string
          stripe_charge_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      trial_emails_sent: {
        Row: {
          email_type: string
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          email_type?: string
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          email_type?: string
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trial_settings: {
        Row: {
          auto_charge_tier: string
          auto_renew_default: boolean
          early_cancel_discount_pct: number
          id: number
          tech_support_auto_reply: string
          trial_days: number
          updated_at: string
        }
        Insert: {
          auto_charge_tier?: string
          auto_renew_default?: boolean
          early_cancel_discount_pct?: number
          id?: number
          tech_support_auto_reply?: string
          trial_days?: number
          updated_at?: string
        }
        Update: {
          auto_charge_tier?: string
          auto_renew_default?: boolean
          early_cancel_discount_pct?: number
          id?: number
          tech_support_auto_reply?: string
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      unenriched_leads: {
        Row: {
          created_at: string
          failure_reason: string | null
          id: string
          raw_domain: string | null
          raw_email: string | null
          raw_payload: Json | null
          source: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          raw_domain?: string | null
          raw_email?: string | null
          raw_payload?: Json | null
          source?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          raw_domain?: string | null
          raw_email?: string | null
          raw_payload?: Json | null
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unenriched_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      upsell_emails_sent: {
        Row: {
          client_email: string
          id: string
          opened: boolean | null
          recommended_services: string[] | null
          sent_at: string | null
          service_name: string
        }
        Insert: {
          client_email: string
          id?: string
          opened?: boolean | null
          recommended_services?: string[] | null
          sent_at?: string | null
          service_name: string
        }
        Update: {
          client_email?: string
          id?: string
          opened?: boolean | null
          recommended_services?: string[] | null
          sent_at?: string | null
          service_name?: string
        }
        Relationships: []
      }
      user_active_programs: {
        Row: {
          block_number: number
          completed_days: Json
          created_at: string
          current_day: number
          current_week: number
          id: string
          program_id: string
          start_date: string
          status: string
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          block_number?: number
          completed_days?: Json
          created_at?: string
          current_day?: number
          current_week?: number
          id?: string
          program_id: string
          start_date?: string
          status?: string
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          block_number?: number
          completed_days?: Json
          created_at?: string
          current_day?: number
          current_week?: number
          id?: string
          program_id?: string
          start_date?: string
          status?: string
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_active_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_active_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_content_access: {
        Row: {
          access_type: string
          granted_at: string
          granted_by: string | null
          id: string
          notes: string | null
          program_id: string | null
          protocol_id: string | null
          user_id: string
          workout_id: string | null
        }
        Insert: {
          access_type?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          program_id?: string | null
          protocol_id?: string | null
          user_id: string
          workout_id?: string | null
        }
        Update: {
          access_type?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          program_id?: string | null
          protocol_id?: string | null
          user_id?: string
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_content_access_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_content_access_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_content_access_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_content_access_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "daily_workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_linked_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_points: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          last_streak_week: string | null
          level: string
          total_points: number
          updated_at: string
          user_id: string
          weekly_streak: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          last_streak_week?: string | null
          level?: string
          total_points?: number
          updated_at?: string
          user_id: string
          weekly_streak?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          last_streak_week?: string | null
          level?: string
          total_points?: number
          updated_at?: string
          user_id?: string
          weekly_streak?: number
        }
        Relationships: []
      }
      user_privacy_settings: {
        Row: {
          created_at: string
          id: string
          show_challenges: boolean
          show_level: boolean
          show_lifts: boolean
          show_name: boolean
          show_nutrition: boolean
          show_points: boolean
          show_programs: boolean
          show_streaks: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          show_challenges?: boolean
          show_level?: boolean
          show_lifts?: boolean
          show_name?: boolean
          show_nutrition?: boolean
          show_points?: boolean
          show_programs?: boolean
          show_streaks?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          show_challenges?: boolean
          show_level?: boolean
          show_lifts?: boolean
          show_name?: boolean
          show_nutrition?: boolean
          show_points?: boolean
          show_programs?: boolean
          show_streaks?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_script_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          script_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          script_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          script_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      voicemail_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          stripe_customer_id: string | null
          transcription_count: number | null
          twilio_number: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
          transcription_count?: number | null
          twilio_number?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
          transcription_count?: number | null
          twilio_number?: string | null
        }
        Relationships: []
      }
      warranty_contacts: {
        Row: {
          client_id: string
          created_at: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          last_sent_at: string | null
          product_name: string | null
          warranty_expiry: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          last_sent_at?: string | null
          product_name?: string | null
          warranty_expiry?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          last_sent_at?: string | null
          product_name?: string | null
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranty_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "warranty_reminder_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_reminder_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      web_design_leads: {
        Row: {
          business: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          monthly_retainer: boolean | null
          name: string | null
          notes: string | null
          site_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          monthly_retainer?: boolean | null
          name?: string | null
          notes?: string | null
          site_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          monthly_retainer?: boolean | null
          name?: string | null
          notes?: string | null
          site_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      web_design_referrals: {
        Row: {
          created_at: string
          id: string
          paid_at: string | null
          payout_amount_cents: number
          payout_method: string | null
          referral_code: string
          referred_business_name: string | null
          referred_email: string
          referrer_email: string
          referrer_name: string | null
          status: string
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          paid_at?: string | null
          payout_amount_cents?: number
          payout_method?: string | null
          referral_code: string
          referred_business_name?: string | null
          referred_email: string
          referrer_email: string
          referrer_name?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          paid_at?: string | null
          payout_amount_cents?: number
          payout_method?: string | null
          referral_code?: string
          referred_business_name?: string | null
          referred_email?: string
          referrer_email?: string
          referrer_name?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      website_copy_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          refresh_count: number | null
          stripe_customer_id: string | null
          website_url: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          refresh_count?: number | null
          stripe_customer_id?: string | null
          website_url?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          refresh_count?: number | null
          stripe_customer_id?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      weekly_digest_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          digest_count: number | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          digest_count?: number | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          digest_count?: number | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      welcome_drip_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      welcome_drip_contacts: {
        Row: {
          client_id: string
          contact_email: string
          contact_name: string | null
          created_at: string | null
          drip_step: number | null
          id: string
          last_sent_at: string | null
        }
        Insert: {
          client_id: string
          contact_email: string
          contact_name?: string | null
          created_at?: string | null
          drip_step?: number | null
          id?: string
          last_sent_at?: string | null
        }
        Update: {
          client_id?: string
          contact_email?: string
          contact_name?: string | null
          created_at?: string | null
          drip_step?: number | null
          id?: string
          last_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "welcome_drip_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "welcome_drip_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      winback_sms_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_sent_at: string | null
          send_count: number | null
          stripe_customer_id: string | null
          twilio_number: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          twilio_number?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_sent_at?: string | null
          send_count?: number | null
          stripe_customer_id?: string | null
          twilio_number?: string | null
        }
        Relationships: []
      }
      winback_sms_contacts: {
        Row: {
          client_id: string
          created_at: string | null
          days_inactive: number | null
          id: string
          last_sent_at: string | null
          name: string | null
          phone: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          days_inactive?: number | null
          id?: string
          last_sent_at?: string | null
          name?: string | null
          phone: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          days_inactive?: number | null
          id?: string
          last_sent_at?: string | null
          name?: string | null
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "winback_sms_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "winback_sms_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      wire_digest_log: {
        Row: {
          id: string
          lead_id: string | null
          sent_at: string | null
          subscriber_id: string
        }
        Insert: {
          id?: string
          lead_id?: string | null
          sent_at?: string | null
          subscriber_id: string
        }
        Update: {
          id?: string
          lead_id?: string | null
          sent_at?: string | null
          subscriber_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wire_digest_log_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "wire_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      wire_subscribers: {
        Row: {
          active: boolean | null
          business_name: string | null
          cities: string[] | null
          contact_name: string | null
          created_at: string | null
          digest_enabled: boolean | null
          email: string
          id: string
          last_digest_sent_at: string | null
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          trades: string[] | null
        }
        Insert: {
          active?: boolean | null
          business_name?: string | null
          cities?: string[] | null
          contact_name?: string | null
          created_at?: string | null
          digest_enabled?: boolean | null
          email: string
          id?: string
          last_digest_sent_at?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trades?: string[] | null
        }
        Update: {
          active?: boolean | null
          business_name?: string | null
          cities?: string[] | null
          contact_name?: string | null
          created_at?: string | null
          digest_enabled?: boolean | null
          email?: string
          id?: string
          last_digest_sent_at?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trades?: string[] | null
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          created_at: string
          date: string
          energy: number | null
          id: string
          recovery_notes: string | null
          session_notes: string | null
          sleep_hours: number | null
          sleep_quality: number | null
          soreness: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          energy?: number | null
          id?: string
          recovery_notes?: string | null
          session_notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          soreness?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          energy?: number | null
          id?: string
          recovery_notes?: string | null
          session_notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          soreness?: number | null
          user_id?: string
        }
        Relationships: []
      }
      workout_logs_legacy: {
        Row: {
          created_at: string
          date: string
          exercise_name: string
          id: string
          notes: string | null
          reps: number
          sets: number
          user_id: string
          weight_lifted: number
        }
        Insert: {
          created_at?: string
          date?: string
          exercise_name: string
          id?: string
          notes?: string | null
          reps?: number
          sets?: number
          user_id: string
          weight_lifted?: number
        }
        Update: {
          created_at?: string
          date?: string
          exercise_name?: string
          id?: string
          notes?: string | null
          reps?: number
          sets?: number
          user_id?: string
          weight_lifted?: number
        }
        Relationships: []
      }
    }
    Views: {
      business_listings_public: {
        Row: {
          business_name: string | null
          city: string | null
          created_at: string | null
          description: string | null
          id: string | null
          industry: string | null
          is_active: boolean | null
          is_featured: boolean | null
          logo_url: string | null
          state: string | null
          tier: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          business_name?: string | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          industry?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          logo_url?: string | null
          state?: string | null
          tier?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          business_name?: string | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          industry?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          logo_url?: string | null
          state?: string | null
          tier?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      dlq_enrich_inspector: {
        Row: {
          candidate_id: string | null
          enqueued_at: string | null
          last_error: string | null
          msg_id: number | null
          read_ct: number | null
          stage: string | null
        }
        Insert: {
          candidate_id?: never
          enqueued_at?: string | null
          last_error?: never
          msg_id?: number | null
          read_ct?: number | null
          stage?: never
        }
        Update: {
          candidate_id?: never
          enqueued_at?: string | null
          last_error?: never
          msg_id?: number | null
          read_ct?: number | null
          stage?: never
        }
        Relationships: []
      }
      enrich_observability: {
        Row: {
          calls_24h: number | null
          hit_rate_pct: number | null
          hits_24h: number | null
          source: string | null
          spend_24h_usd: number | null
          unique_candidates: number | null
        }
        Relationships: []
      }
      enrichment_provider_health: {
        Row: {
          avg_cost: number | null
          avg_hits: number | null
          calls_7d: number | null
          last_call_at: string | null
          provider: string | null
          spent_7d: number | null
          success_rate_pct: number | null
          successes_7d: number | null
          unique_candidates_7d: number | null
        }
        Relationships: []
      }
      generated_sites_public: {
        Row: {
          business_name: string | null
          color_scheme: Json | null
          created_at: string | null
          id: string | null
          is_published: boolean | null
          published_at: string | null
          sections: Json | null
          slug: string | null
          template_key: string | null
          updated_at: string | null
        }
        Insert: {
          business_name?: string | null
          color_scheme?: Json | null
          created_at?: string | null
          id?: string | null
          is_published?: boolean | null
          published_at?: string | null
          sections?: Json | null
          slug?: string | null
          template_key?: string | null
          updated_at?: string | null
        }
        Update: {
          business_name?: string | null
          color_scheme?: Json | null
          created_at?: string | null
          id?: string | null
          is_published?: boolean | null
          published_at?: string | null
          sections?: Json | null
          slug?: string | null
          template_key?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      growth_radar_clients: {
        Row: {
          active: boolean | null
          business_name: string | null
          contact_name: string | null
          county_filter: string[] | null
          created_at: string | null
          email: string | null
          id: string | null
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          vertical_filter: string[] | null
        }
        Insert: {
          active?: never
          business_name?: string | null
          contact_name?: string | null
          county_filter?: string[] | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          vertical_filter?: never
        }
        Update: {
          active?: never
          business_name?: string | null
          contact_name?: string | null
          county_filter?: string[] | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          vertical_filter?: never
        }
        Relationships: []
      }
      growth_radar_signals: {
        Row: {
          company_name: string | null
          confidence: number | null
          county: string | null
          created_at: string | null
          detected_at: string | null
          expires_at: string | null
          id: string | null
          metadata: Json | null
          predicted_needs: string[] | null
          recommended_pitch: string | null
          signal_type: string | null
          source: string | null
          source_url: string | null
          value_usd: number | null
          vertical: string | null
        }
        Insert: {
          company_name?: string | null
          confidence?: number | null
          county?: string | null
          created_at?: string | null
          detected_at?: string | null
          expires_at?: never
          id?: string | null
          metadata?: never
          predicted_needs?: string[] | null
          recommended_pitch?: string | null
          signal_type?: string | null
          source?: never
          source_url?: never
          value_usd?: never
          vertical?: string | null
        }
        Update: {
          company_name?: string | null
          confidence?: number | null
          county?: string | null
          created_at?: string | null
          detected_at?: string | null
          expires_at?: never
          id?: string | null
          metadata?: never
          predicted_needs?: string[] | null
          recommended_pitch?: string | null
          signal_type?: string | null
          source?: never
          source_url?: never
          value_usd?: never
          vertical?: string | null
        }
        Relationships: []
      }
      training_programs_public: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          level: string | null
          price: number | null
          sport: string | null
          title: string | null
          total_weeks: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          level?: string | null
          price?: number | null
          sport?: string | null
          title?: string | null
          total_weeks?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          level?: string | null
          price?: number | null
          sport?: string | null
          title?: string | null
          total_weeks?: number | null
        }
        Relationships: []
      }
      unified_signals: {
        Row: {
          city: string | null
          confidence: number | null
          created_at: string | null
          freshness: number | null
          id: string | null
          rank_score: number | null
          signal_type: string | null
          state: string | null
          subtitle: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _extract_vault_keys: { Args: { p_command: string }; Returns: string[] }
      _validate_cron_command: {
        Args: { p_command: string; p_jobname: string; p_schedule: string }
        Returns: {
          error_msg: string
          ok: boolean
          rule: string
        }[]
      }
      _vault_key_exists: { Args: { p_name: string }; Returns: boolean }
      award_points: {
        Args: {
          _action: string
          _description?: string
          _points: number
          _reference_id?: string
          _user_id: string
        }
        Returns: number
      }
      candidates_within_radius: {
        Args: {
          p_lat: number
          p_limit?: number
          p_lng: number
          p_min_score?: number
          p_radius_miles?: number
        }
        Returns: {
          city: string
          distance_miles: number
          id: string
          name: string
          score: number
          trade: string
        }[]
      }
      check_contactability_complete: {
        Args: { p_email: string; p_linkedin?: string; p_phone: string }
        Returns: boolean
      }
      check_user_visibility: {
        Args: { _field: string; _target_user_id: string }
        Returns: boolean
      }
      compute_freshness_score: {
        Args: { p_created_at: string; p_half_life_days?: number }
        Returns: number
      }
      consume_source_budget: {
        Args: { p_estimated_cost?: number; p_provider: string }
        Returns: Json
      }
      correlate_pulse_to_candidates: {
        Args: { p_pulse_id: string }
        Returns: number
      }
      cron_job_status: { Args: { p_jobname: string }; Returns: Json }
      decrypt_cms_credentials: {
        Args: { _client_id: string }
        Returns: {
          cms_app_password: string
          cms_username: string
        }[]
      }
      dedup_candidates_fuzzy: {
        Args: { p_city?: string; p_name: string; p_threshold?: number }
        Returns: {
          city: string
          id: string
          name: string
          similarity: number
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_job: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      earth: { Args: never; Returns: number }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enqueue_job: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enqueue_stage: {
        Args: { _candidate_id: string; _stage: string }
        Returns: number
      }
      extract_domain: { Args: { input: string }; Returns: string }
      get_active_training_programs: {
        Args: never
        Returns: {
          category: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          level: string
          price: number
          sport: string
          title: string
          total_weeks: number
        }[]
      }
      get_agency_role: { Args: { _user_id: string }; Returns: string }
      get_last_net_response_for_url: {
        Args: { p_since: string; p_url: string }
        Returns: {
          created: string
          error_msg: string
          status_code: number
          url: string
        }[]
      }
      get_my_pending_actions: {
        Args: never
        Returns: {
          action_type: string
          ai_result: string
          created_at: string
          id: string
          status: string
        }[]
      }
      get_public_profiles: {
        Args: { user_ids?: string[] }
        Returns: {
          athlete_name: string
          full_name: string
          is_public_profile: boolean
          random_alias: string
          user_id: string
        }[]
      }
      get_queue_status: {
        Args: never
        Returns: {
          depth: number
          oldest_msg: string
          queue_name: string
        }[]
      }
      get_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_team_member: {
        Args: { _roster_id: string; _user_id: string }
        Returns: boolean
      }
      is_roster_owner: {
        Args: { _roster_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_coach: {
        Args: { _roster_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _roster_id: string; _user_id: string }
        Returns: boolean
      }
      log_challenge_progress: {
        Args: { _challenge_id: string; _user_id: string; _value: number }
        Returns: number
      }
      match_llm_cache: {
        Args: {
          _content_type?: string
          _embedding: string
          _model_family?: string
          _threshold?: number
        }
        Returns: {
          hit_count: number
          id: string
          response: Json
          similarity: number
        }[]
      }
      match_signals_semantic: {
        Args: {
          industry_filter?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          company_name: string
          confidence: number
          id: string
          recommended_pitch: string
          similarity: number
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_enrich_stage: { Args: { _candidate_id: string }; Returns: string }
      purge_expired_idempotency_keys: { Args: never; Returns: number }
      queue_depth_snapshot: {
        Args: never
        Returns: {
          depth: number
          oldest_age: string
          queue_name: string
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      read_job_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      rollback_cron: { Args: { p_jobname: string }; Returns: Json }
      safe_cron_schedule: {
        Args: { p_command: string; p_jobname: string; p_schedule: string }
        Returns: undefined
      }
      safe_cron_validate: {
        Args: { p_command: string; p_jobname: string; p_schedule: string }
        Returns: Json
      }
      search_candidates_hybrid: {
        Args: {
          city_filter?: string
          limit_n?: number
          min_score?: number
          query_embedding?: string
          query_text: string
          state_filter?: string
        }
        Returns: {
          blended_rank: number
          city: string
          created_at: string
          current_employer: string
          freshness: number
          fts_rank: number
          id: string
          license_type: string
          name: string
          score: number
          semantic_sim: number
          state: string
          trade: string
        }[]
      }
      search_coaching_documents: {
        Args: { match_count?: number; query: string }
        Returns: {
          content: string
          id: string
          rank: number
          title: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      toggle_points_visibility: {
        Args: { _is_public: boolean }
        Returns: undefined
      }
      validate_promo_code: {
        Args: { _code: string }
        Returns: {
          applies_to: string
          code: string
          discount_type: string
          discount_value: number
          id: string
          specific_product_id: string
        }[]
      }
      verify_tech_pin: {
        Args: { _pin: string }
        Returns: {
          client_id: string
          id: string
          name: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "parent"
        | "child"
        | "coach"
        | "agency_admin"
        | "client"
      lift_video_status: "pending_review" | "approved" | "rejected" | "archived"
      wiki_category: "core_product" | "add_on" | "system" | "process"
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "parent",
        "child",
        "coach",
        "agency_admin",
        "client",
      ],
      lift_video_status: ["pending_review", "approved", "rejected", "archived"],
      wiki_category: ["core_product", "add_on", "system", "process"],
    },
  },
} as const
