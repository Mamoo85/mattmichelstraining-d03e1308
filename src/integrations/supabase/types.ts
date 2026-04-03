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
      blog_post_clients: {
        Row: {
          active: boolean | null
          auto_publish: boolean | null
          business_name: string
          cms_app_password: string | null
          cms_app_password_enc: string | null
          cms_type: string | null
          cms_url: string | null
          cms_username: string | null
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
          cms_app_password?: string | null
          cms_app_password_enc?: string | null
          cms_type?: string | null
          cms_url?: string | null
          cms_username?: string | null
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
          cms_app_password?: string | null
          cms_app_password_enc?: string | null
          cms_type?: string | null
          cms_url?: string | null
          cms_username?: string | null
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
      contractor_clients: {
        Row: {
          active: boolean | null
          business_name: string
          created_at: string | null
          email: string
          id: string
          industry: string | null
          last_lead_at: string | null
          lead_count: number | null
          service_area: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          email: string
          id?: string
          industry?: string | null
          last_lead_at?: string | null
          lead_count?: number | null
          service_area?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          email?: string
          id?: string
          industry?: string | null
          last_lead_at?: string | null
          lead_count?: number | null
          service_area?: string | null
          stripe_customer_id?: string | null
        }
        Relationships: []
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
      contractor_leads: {
        Row: {
          client_id: string | null
          created_at: string | null
          email: string | null
          id: string
          message: string | null
          name: string
          notified_at: string | null
          phone: string
          project_type: string | null
          site_id: string | null
          source: string | null
          status: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          message?: string | null
          name: string
          notified_at?: string | null
          phone: string
          project_type?: string | null
          site_id?: string | null
          source?: string | null
          status?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          message?: string | null
          name?: string
          notified_at?: string | null
          phone?: string
          project_type?: string | null
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
          business_name: string
          created_at: string | null
          custom_message: string | null
          email: string
          id: string
          last_triggered_at: string | null
          phone: string | null
          stripe_customer_id: string | null
        }
        Insert: {
          active?: boolean | null
          business_name: string
          created_at?: string | null
          custom_message?: string | null
          email: string
          id?: string
          last_triggered_at?: string | null
          phone?: string | null
          stripe_customer_id?: string | null
        }
        Update: {
          active?: boolean | null
          business_name?: string
          created_at?: string | null
          custom_message?: string | null
          email?: string
          id?: string
          last_triggered_at?: string | null
          phone?: string | null
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
      outreach_leads: {
        Row: {
          ai_drafted_at: string | null
          ai_drafted_pitch: string | null
          ai_drafted_subject: string | null
          business_name: string
          city: string | null
          created_at: string | null
          custom_flaw: string | null
          email: string | null
          id: string
          industry: string | null
          last_contact_date: string | null
          lead_score: number | null
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
          website: string | null
          website_status: string | null
        }
        Insert: {
          ai_drafted_at?: string | null
          ai_drafted_pitch?: string | null
          ai_drafted_subject?: string | null
          business_name: string
          city?: string | null
          created_at?: string | null
          custom_flaw?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          last_contact_date?: string | null
          lead_score?: number | null
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
          website?: string | null
          website_status?: string | null
        }
        Update: {
          ai_drafted_at?: string | null
          ai_drafted_pitch?: string | null
          ai_drafted_subject?: string | null
          business_name?: string
          city?: string | null
          created_at?: string | null
          custom_flaw?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          last_contact_date?: string | null
          lead_score?: number | null
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
          created_at: string
          daily_calorie_goal: number | null
          daily_carbs_goal: number | null
          daily_fat_goal: number | null
          daily_protein_goal: number | null
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
          created_at?: string
          daily_calorie_goal?: number | null
          daily_carbs_goal?: number | null
          daily_fat_goal?: number | null
          daily_protein_goal?: number | null
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
          created_at?: string
          daily_calorie_goal?: number | null
          daily_carbs_goal?: number | null
          daily_fat_goal?: number | null
          daily_protein_goal?: number | null
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
          description: string | null
          id: string | null
          industry: string | null
          is_active: boolean | null
          is_featured: boolean | null
          logo_url: string | null
          owner_name: string | null
          state: string | null
          tier: string | null
          website: string | null
        }
        Insert: {
          business_name?: string | null
          city?: string | null
          description?: string | null
          id?: string | null
          industry?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          logo_url?: string | null
          owner_name?: string | null
          state?: string | null
          tier?: string | null
          website?: string | null
        }
        Update: {
          business_name?: string | null
          city?: string | null
          description?: string | null
          id?: string | null
          industry?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          logo_url?: string | null
          owner_name?: string | null
          state?: string | null
          tier?: string | null
          website?: string | null
        }
        Relationships: []
      }
      generated_sites_public: {
        Row: {
          address: string | null
          business_name: string | null
          color_scheme: Json | null
          created_at: string | null
          id: string | null
          is_published: boolean | null
          lead_id: string | null
          logo_url: string | null
          published_at: string | null
          sections: Json | null
          slug: string | null
          template_key: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          color_scheme?: Json | null
          created_at?: string | null
          id?: string | null
          is_published?: boolean | null
          lead_id?: string | null
          logo_url?: string | null
          published_at?: string | null
          sections?: Json | null
          slug?: string | null
          template_key?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          color_scheme?: Json | null
          created_at?: string | null
          id?: string | null
          is_published?: boolean | null
          lead_id?: string | null
          logo_url?: string | null
          published_at?: string | null
          sections?: Json | null
          slug?: string | null
          template_key?: string | null
          updated_at?: string | null
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
    }
    Functions: {
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
      check_user_visibility: {
        Args: { _field: string; _target_user_id: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
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
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
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
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "parent" | "child" | "coach"
      lift_video_status: "pending_review" | "approved" | "rejected" | "archived"
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
      app_role: ["admin", "moderator", "user", "parent", "child", "coach"],
      lift_video_status: ["pending_review", "approved", "rejected", "archived"],
    },
  },
} as const
