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
      community_workouts: {
        Row: {
          created_at: string
          creator_name: string
          description: string | null
          exercises: Json
          id: string
          is_public: boolean
          likes_count: number
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
          title?: string
          updated_at?: string
          user_id?: string
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
      exercise_library: {
        Row: {
          barbell_alternative_id: string | null
          client_type: string[]
          created_at: string
          equipment_needed: string
          fix_it_protocol: string[]
          focus_area: string[]
          id: string
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
          created_at: string
          email: string
          first_name: string | null
          id: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          source?: string
          updated_at?: string
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
          is_in_person: boolean
          is_pro: boolean
          is_vip: boolean
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
          is_in_person?: boolean
          is_pro?: boolean
          is_vip?: boolean
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
          is_in_person?: boolean
          is_pro?: boolean
          is_vip?: boolean
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
      protocol_exercises: {
        Row: {
          created_at: string
          exercise_name: string
          id: string
          notes: string | null
          protocol_id: string
          reps: string | null
          rpe: number | null
          sets: number | null
          sort_order: number
          weight: number | null
        }
        Insert: {
          created_at?: string
          exercise_name: string
          id?: string
          notes?: string | null
          protocol_id: string
          reps?: string | null
          rpe?: number | null
          sets?: number | null
          sort_order?: number
          weight?: number | null
        }
        Update: {
          created_at?: string
          exercise_name?: string
          id?: string
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
          id: string
          is_default: boolean
          is_template: boolean
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          is_template?: boolean
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          is_template?: boolean
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
      shared_workout_results: {
        Row: {
          caption: string | null
          created_at: string
          exercises: Json
          id: string
          image_status: string
          image_url: string | null
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
          created_at: string
          id: string
          owner_id: string
          sport: string | null
          team_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          sport?: string | null
          team_name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          sport?: string | null
          team_name?: string
          updated_at?: string
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
      user_active_programs: {
        Row: {
          created_at: string
          id: string
          program_id: string
          start_date: string
          status: string
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          program_id: string
          start_date?: string
          status?: string
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
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
            foreignKeyName: "user_content_access_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "daily_workouts"
            referencedColumns: ["id"]
          },
        ]
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
      [_ in never]: never
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
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
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "parent" | "child"
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
      app_role: ["admin", "moderator", "user", "parent", "child"],
      lift_video_status: ["pending_review", "approved", "rejected", "archived"],
    },
  },
} as const
